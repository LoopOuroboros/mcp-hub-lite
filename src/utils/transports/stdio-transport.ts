import {
  StdioClientTransport,
  StdioServerParameters
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { logger, LOG_MODULES } from '@utils/logger.js';
import type { LogStorageService } from '@services/log-storage.service.js';
import { PassThrough } from 'stream';

export interface StdioTransportOptions {
  compositeKey?: string;
  logStorage?: LogStorageService;
  // Ready patterns for startup detection (stdout/stderr containing any pattern = server ready)
  readyPatterns?: string[];
  // Ready detection timeout in ms
  readyTimeout: number;
}

/**
 * A transport implementation for communicating with MCP (Model Context Protocol) servers
 * via standard input/output streams. This transport wraps the official SDK's StdioClientTransport
 * and provides consistent logging and integration with the MCP Hub Lite system.
 *
 * The StdioTransport handles:
 * - Cross-platform process spawning (including Windows batch file compatibility)
 * - JSON-RPC message parsing and serialization
 * - Proper process lifecycle management with graceful shutdown
 * - Error handling and logging
 * - Separate handling of stdout (for JSON-RPC) and stderr (for logging)
 *
 * This transport is primarily used for local MCP servers that communicate through
 * standard I/O streams, such as those launched via npx, npm, or other package managers.
 *
 * @implements {Transport}
 */
export class StdioTransport implements Transport {
  private _transport: StdioClientTransport;
  private _serverName?: string;
  private _compositeKey?: string;
  private _logStorage?: LogStorageService;
  private _stderrStream: PassThrough | null = null;
  private _readyPatterns?: string[];
  private _readyTimeout: number = 120000;

  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage) => void;
  public onstdout?: (data: string) => void;
  public onstderr?: (data: string) => void;

  /**
   * Creates a new StdioTransport instance.
   *
   * @param {StdioServerParameters} server - Configuration parameters for the child process
   * @param {string} [serverName] - Optional name for the server used in logging
   * @param {StdioTransportOptions} [options] - Additional options for the transport
   */
  constructor(server: StdioServerParameters, serverName?: string, options?: StdioTransportOptions) {
    // Convert our server parameters to match SDK format
    const sdkParams = {
      command: server.command,
      args: server.args,
      env: server.env,
      stderr: 'pipe' as const, // Always use pipe for stderr to enable logging
      cwd: server.cwd
    };

    this._transport = new StdioClientTransport(sdkParams);
    this._serverName = serverName;
    this._compositeKey = options?.compositeKey;
    this._logStorage = options?.logStorage;
    this._readyPatterns = options?.readyPatterns;
    this._readyTimeout = options?.readyTimeout ?? 120000;
    this._stderrStream = new PassThrough();
  }

  /**
   * Starts the transport by spawning the child process and establishing communication channels.
   *
   * This method delegates to the SDK's StdioClientTransport.start() method which handles:
   * - Platform-specific process spawning (including Windows batch file compatibility)
   * - Proper stdio configuration
   * - Event listeners for process lifecycle events
   * - Data flow for stdout and stderr handling
   *
   * @returns {Promise<void>} Resolves when the child process is successfully spawned
   * @throws {Error} If the transport is already started
   */
  async start(): Promise<void> {
    // Set up event handlers before starting
    this._transport.onmessage = (message: JSONRPCMessage) => {
      this.onmessage?.(message);
    };

    this._transport.onerror = (error: Error) => {
      this.onerror?.(error);
    };

    this._transport.onclose = () => {
      this.onclose?.();
    };

    // Start the underlying transport
    await this._transport.start();

    // Ready detection: wait for server to output ready pattern
    if (this._readyPatterns && this._readyPatterns.length > 0) {
      logger.info(
        `Waiting for server ready patterns: ${JSON.stringify(this._readyPatterns)}`,
        LOG_MODULES.STDIO_TRANSPORT
      );
      await this.waitForReady(this._readyPatterns, this._readyTimeout);
      logger.info(
        `Server ready pattern detected, proceeding with MCP handshake`,
        LOG_MODULES.STDIO_TRANSPORT
      );
    }

    // Handle stderr data by listening to the transport's stderr stream
    if (this._transport.stderr) {
      this._transport.stderr.on('data', (chunk: Buffer | string) => {
        const dataStr = chunk.toString('utf8').trim();
        if (!dataStr) return;

        // Forward raw stderr data
        this.onstderr?.(dataStr);

        // Log stderr output (per MCP spec, stderr is not necessarily errors)
        const serverIdentifier = this._compositeKey || this._serverName || 'Unknown Server';
        logger.serverLog('info', serverIdentifier, dataStr, {
          pid: this.pid,
          module: LOG_MODULES.STDERR.module
        });

        if (this._logStorage && this._compositeKey) {
          this._logStorage.append(this._compositeKey, 'info', dataStr);
        }

        // Also write to our PassThrough stream for compatibility
        // Guard against write after end during close() race condition
        if (this._stderrStream && !this._stderrStream.writableEnded) {
          this._stderrStream.write(chunk);
        }
      });
    }
  }

  /**
   * Waits for the server to emit a ready pattern in stderr.
   *
   * @param patterns - Array of string patterns to match (any match = ready)
   * @param timeout - Timeout in milliseconds
   * @returns Promise that resolves when a pattern is matched, or rejects on timeout
   */
  private waitForReady(patterns: string[], timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Server did not emit any ready pattern within ${timeout}ms`));
      }, timeout);

      // Hook into stderr before it's set up in start()
      // The ready detection needs to intercept stderr BEFORE the normal stderr handler
      const readyStderrHandler = (chunk: Buffer | string) => {
        const dataStr = chunk.toString('utf8').trim();
        if (!dataStr) return;

        // Check if any pattern matches
        for (const pattern of patterns) {
          if (dataStr.includes(pattern)) {
            clearTimeout(timeoutId);
            // Remove this listener - normal stderr handling will be set up in start()
            this._transport.stderr?.off('data', readyStderrHandler);
            logger.info(`Server ready pattern matched: "${pattern}"`, LOG_MODULES.STDIO_TRANSPORT);
            resolve();
            return;
          }
        }
      };

      // Add the ready detection listener to stderr
      if (this._transport.stderr) {
        this._transport.stderr.on('data', readyStderrHandler);
      }
    });
  }

  /**
   * Gets the stderr stream for the child process.
   *
   * Returns our PassThrough stream that captures stderr data.
   *
   * @returns {PassThrough | null} The stderr stream or null
   */
  get stderr() {
    return this._stderrStream;
  }

  /**
   * Gets the process ID of the spawned child process.
   *
   * @returns {number | undefined} The PID of the child process, or undefined if not started
   */
  public get pid(): number | undefined {
    return this._transport.pid ?? undefined;
  }

  /**
   * Closes the transport by gracefully terminating the child process.
   *
   * This method delegates to the SDK's StdioClientTransport.close() method which handles:
   * - Graceful shutdown sequence with SIGTERM/SIGKILL
   * - Proper cleanup of internal state
   *
   * @returns {Promise<void>} Resolves when the transport is fully closed
   */
  async close(): Promise<void> {
    await this._transport.close();
    this._stderrStream?.end();
  }

  /**
   * Sends a JSON-RPC message to the child process via stdin.
   *
   * This method delegates to the SDK's StdioClientTransport.send() method.
   *
   * @param {JSONRPCMessage} message - The JSON-RPC message to send
   * @returns {Promise<void>} Resolves when the message is written to stdin
   */
  async send(message: JSONRPCMessage): Promise<void> {
    await this._transport.send(message);
  }
}
