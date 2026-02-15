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

export class StdioTransport implements Transport {
  private _process?: ChildProcess;
  private _readBuffer = new ReadBuffer();
  private _stderrStream: PassThrough | null = null;
  private _serverParams: StdioServerParameters;
  private _serverName?: string;

  public get pid(): number | undefined {
    return this._process?.pid;
  }

  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage) => void;
  public onstdout?: (data: string) => void;
  public onstderr?: (data: string) => void;

  constructor(server: StdioServerParameters, serverName?: string) {
    this._serverParams = server;
    this._serverName = serverName;
    if (server.stderr === 'pipe') {
      this._stderrStream = new PassThrough();
    }
  }

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

      if (this._stderrStream && this._process.stderr) {
        this._process.stderr.on('data', (chunk: Buffer) => {
          const dataStr = chunk.toString('utf8');
          // Forward raw stderr data
          this.onstderr?.(dataStr);

          if (this._serverName) {
            logger.serverLog('error', this._serverName, dataStr.trim(), {
              pid: this._process?.pid
            });
          } else {
            logger.serverLog('error', 'Unknown Server', dataStr.trim(), {
              pid: this._process?.pid
            });
          }
          // Also write stderr data to PassThrough stream
          this._stderrStream?.write(chunk);
        });
      } else if (this._process.stderr) {
        // If stderr is not in pipe mode, listen directly
        this._process.stderr.on('data', (chunk: Buffer) => {
          const dataStr = chunk.toString('utf8');
          this.onstderr?.(dataStr);

          if (this._serverName) {
            logger.serverLog('error', this._serverName, dataStr.trim(), {
              pid: this._process?.pid
            });
          } else {
            logger.serverLog('error', 'Unknown Server', dataStr.trim(), {
              pid: this._process?.pid
            });
          }
        });
      }
    });
  }

  get stderr() {
    return this._stderrStream ?? this._process?.stderr ?? null;
  }

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

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._process?.stdin) {
      throw new Error('Not connected');
    }
    const json = JSON.stringify(message) + '\n';
    this._process.stdin.write(json);
  }
}
