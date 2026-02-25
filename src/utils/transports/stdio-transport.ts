import { spawn, ChildProcess } from 'child_process';
import { PassThrough } from 'stream';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { logger } from '@utils/logger.js';

// Re-implement ReadBuffer as it is not exported from SDK root
class ReadBuffer {
  private _buffer?: Buffer;

  append(chunk: Buffer) {
    this._buffer = this._buffer ? Buffer.concat([this._buffer, chunk]) : chunk;
  }

  readMessage(): JSONRPCMessage | null {
    if (!this._buffer) {
      return null;
    }
    const index = this._buffer.indexOf('\n');
    if (index === -1) {
      return null;
    }
    const line = this._buffer.toString('utf8', 0, index).replace(/\r$/, '');
    this._buffer = this._buffer.subarray(index + 1);
    try {
      return JSON.parse(line);
    } catch {
      return JSON.parse(line);
    }
  }

  clear() {
    this._buffer = undefined;
  }
}

export interface StdioServerParameters {
  command: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
  stderr?: 'inherit' | 'pipe' | 'ignore';
  cwd?: string;
}

/**
 * A transport implementation for communicating with MCP (Model Context Protocol) servers
 * via standard input/output streams. This transport spawns a child process and establishes
 * bidirectional communication using stdin/stdout for JSON-RPC message exchange.
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
  private _process?: ChildProcess;
  private _readBuffer = new ReadBuffer();
  private _stderrStream: PassThrough | null = null;
  private _serverParams: StdioServerParameters;
  private _serverName?: string;

  /**
   * Gets the process ID of the spawned child process.
   *
   * @returns {number | undefined} The PID of the child process, or undefined if not started
   */
  public get pid(): number | undefined {
    return this._process?.pid;
  }

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
   */
  constructor(server: StdioServerParameters, serverName?: string) {
    this._serverParams = server;
    this._serverName = serverName;
    if (server.stderr === 'pipe') {
      this._stderrStream = new PassThrough();
    }
  }

  /**
   * Starts the transport by spawning the child process and establishing communication channels.
   *
   * This method handles platform-specific considerations:
   * - On Windows, it automatically wraps batch commands (like npx, npm, etc.) with cmd.exe /c
   * - Sets up proper stdio configuration based on the server parameters
   * - Configures event listeners for process lifecycle events
   * - Establishes data flow for stdout and stderr handling
   *
   * @returns {Promise<void>} Resolves when the child process is successfully spawned
   * @throws {Error} If the transport is already started
   */
  async start(): Promise<void> {
    if (this._process) {
      throw new Error('StdioTransport already started!');
    }

    let command = this._serverParams.command;
    let args = this._serverParams.args ?? [];

    // Windows compatibility: Batch files (npx, npm, etc.) need cmd.exe /c to run with shell: false
    if (process.platform === 'win32') {
      const knownBatchCommands = ['npx', 'npm', 'pnpm', 'yarn', 'uvx'];
      if (
        knownBatchCommands.includes(command) ||
        command.endsWith('.cmd') ||
        command.endsWith('.bat')
      ) {
        // Use cmd.exe /c to execute the batch file
        args = ['/c', command, ...args];
        command = 'cmd.exe';
      }
    }

    return new Promise((resolve, reject) => {
      this._process = spawn(command, args, {
        env: { ...process.env, ...this._serverParams.env },
        stdio: [
          'pipe',
          'pipe',
          this._serverParams.stderr === 'pipe' ? 'pipe' : this._serverParams.stderr || 'inherit'
        ],
        shell: false,
        windowsHide: true, // Force hide window on Windows
        cwd: this._serverParams.cwd
      });

      this._process.on('error', (error: Error) => {
        reject(error);
        this.onerror?.(error);
      });

      this._process.on('spawn', () => {
        resolve();
      });

      this._process.on('close', () => {
        this._process = undefined;
        this.onclose?.();
      });

      this._process.stdin?.on('error', (error: Error) => {
        this.onerror?.(error);
      });

      this._process.stdout?.on('data', (chunk: Buffer) => {
        const dataStr = chunk.toString('utf8');

        // Forward raw stdout data
        this.onstdout?.(dataStr);

        // Don't log raw JSON-RPC communication to avoid log noise
        // Only need to view raw communication during development debugging
        // Parse JSON-RPC messages
        this._readBuffer.append(chunk);
        this.processReadBuffer();
      });

      this._process.stdout?.on('error', (error: Error) => {
        this.onerror?.(error);
      });

      /**
       * Handles stderr data with common processing logic.
       *
       * @param chunk - The stderr data chunk
       * @param writeToStream - Whether to write data to the PassThrough stream
       */
      const handleStderrData = (chunk: Buffer, writeToStream: boolean = false) => {
        const dataStr = chunk.toString('utf8');
        // Forward raw stderr data
        this.onstderr?.(dataStr);

        const trimmedData = dataStr.trim();
        let logLevel: 'error' | 'warn' | 'info' = 'error';

        // Identify normal information patterns
        if (
          trimmedData.includes('Installed') ||
          trimmedData.includes('running on') ||
          trimmedData.includes('Server running') ||
          trimmedData.includes('INFO:') ||
          trimmedData.includes('Loaded') ||
          trimmedData.includes('Ready') ||
          trimmedData.includes('Started')
        ) {
          logLevel = 'info';
        } else if (trimmedData.includes('WARN:') || trimmedData.includes('Warning') || trimmedData.includes('warning')) {
          logLevel = 'warn';
        }

        if (this._serverName) {
          logger.serverLog(logLevel, this._serverName, trimmedData, {
            pid: this._process?.pid
          });
        } else {
          logger.serverLog(logLevel, 'Unknown Server', trimmedData, {
            pid: this._process?.pid
          });
        }

        // Optionally write to PassThrough stream if configured
        if (writeToStream) {
          this._stderrStream?.write(chunk);
        }
      };

      if (this._stderrStream && this._process.stderr) {
        this._process.stderr.on('data', (chunk: Buffer) => {
          handleStderrData(chunk, true); // Write to PassThrough stream for piped stderr
        });
      } else if (this._process.stderr) {
        // If stderr is not in pipe mode, listen directly
        this._process.stderr.on('data', (chunk: Buffer) => {
          handleStderrData(chunk, false); // No PassThrough stream for non-piped stderr
        });
      }
    });
  }

  /**
   * Gets the stderr stream for the child process.
   *
   * Returns a PassThrough stream if stderr is configured as 'pipe', otherwise returns
   * the actual stderr stream from the child process, or null if no stderr is available.
   *
   * @returns {PassThrough | NodeJS.ReadableStream | null} The stderr stream or null
   */
  get stderr() {
    return this._stderrStream ?? this._process?.stderr ?? null;
  }

  /**
   * Processes the internal read buffer to extract and dispatch JSON-RPC messages.
   *
   * This method continuously reads complete JSON-RPC messages from the buffer
   * and dispatches them to the onmessage callback. It handles partial messages
   * by leaving incomplete data in the buffer for future processing.
   *
   * The method uses a while loop to process all available complete messages
   * in a single call, ensuring efficient message handling without blocking.
   *
   * @private
   */
  processReadBuffer() {
    while (true) {
      try {
        const message = this._readBuffer.readMessage();
        if (message === null) {
          break;
        }
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error as Error);
      }
    }
  }

  /**
   * Closes the transport by gracefully terminating the child process.
   *
   * This method implements a graceful shutdown sequence:
   * 1. Sends SIGTERM to allow the child process to clean up
   * 2. Waits up to 5 seconds for graceful termination
   * 3. Forces termination with SIGKILL if the process doesn't exit
   * 4. Cleans up internal state and resolves the promise
   *
   * The method ensures proper cleanup of the read buffer and handles
   * any errors that occur during the shutdown process.
   *
   * @returns {Promise<void>} Resolves when the transport is fully closed
   */
  async close(): Promise<void> {
    if (this._process) {
      return new Promise((resolve) => {
        // Listen for child process exit events
        const cleanup = () => {
          this._process = undefined;
          this._readBuffer.clear();
          resolve();
        };

        if (this._process) {
          this._process.once('close', cleanup);
          this._process.once('exit', cleanup);

          // Send SIGTERM signal to give child process a chance to shut down gracefully
          try {
            this._process.kill('SIGTERM');

            // Set timeout protection to force kill if child process doesn't exit within 5 seconds
            const timeout = setTimeout(() => {
              if (this._process) {
                logger.warn('Child process did not exit gracefully, force killing...');
                this._process.kill('SIGKILL');
              }
            }, 5000);

            // Ensure timeout timer is cleared after process exits
            this._process.once('close', () => clearTimeout(timeout));
            this._process.once('exit', () => clearTimeout(timeout));
          } catch (error) {
            logger.error('Error closing stdio transport:', error);
            cleanup();
          }
        } else {
          // Process is already undefined, just resolve
          resolve();
        }
      });
    }
    this._readBuffer.clear();
  }

  /**
   * Sends a JSON-RPC message to the child process via stdin.
   *
   * This method serializes the message to JSON, appends a newline character,
   * and writes it to the child process's stdin stream. It validates that
   * the transport is connected before attempting to send the message.
   *
   * @param {JSONRPCMessage} message - The JSON-RPC message to send
   * @returns {Promise<void>} Resolves when the message is written to stdin
   * @throws {Error} If the transport is not connected (no active child process)
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._process?.stdin) {
      throw new Error('Not connected');
    }
    const json = JSON.stringify(message) + '\n';
    this._process.stdin.write(json);
  }
}
