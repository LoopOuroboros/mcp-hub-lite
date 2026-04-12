import {
  StdioClientTransport,
  StdioServerParameters
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@utils/logger.js';
import type { LogStorageService } from '@services/log-storage.service.js';
import { PassThrough } from 'stream';

export interface StdioTransportOptions {
  serverId?: string;
  logStorage?: LogStorageService;
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
  private _serverId?: string;
  private _logStorage?: LogStorageService;
  private _stderrStream: PassThrough | null = null;

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
    this._serverId = options?.serverId;
    this._logStorage = options?.logStorage;
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

    // Handle stderr data by listening to the transport's stderr stream
    if (this._transport.stderr) {
      this._transport.stderr.on('data', (chunk: Buffer | string) => {
        const dataStr = chunk.toString('utf8').trim();
        if (!dataStr) return;

        // Forward raw stderr data
        this.onstderr?.(dataStr);

        // Log stderr output (per MCP spec, stderr is not necessarily errors)
        const serverIdentifier = this._serverId || this._serverName || 'Unknown Server';
        logger.serverLog('info', serverIdentifier, dataStr, { pid: this.pid });

        if (this._logStorage && this._serverId) {
          this._logStorage.append(this._serverId, 'info', dataStr);
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
