import { spawn } from 'child_process';
import { PassThrough } from 'stream';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

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
    } catch (e) {
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
    stderr?: "inherit" | "pipe" | "ignore"; 
    cwd?: string;
}

export class CustomStdioClientTransport implements Transport {
    private _process?: any;
    private _readBuffer = new ReadBuffer();
    private _stderrStream: PassThrough | null = null;
    private _serverParams: StdioServerParameters;

    public get pid(): number | undefined {
        return this._process?.pid;
    }
    
    public onclose?: () => void;
    public onerror?: (error: Error) => void;
    public onmessage?: (message: JSONRPCMessage) => void;

    constructor(server: StdioServerParameters) {
        this._serverParams = server;
        if (server.stderr === 'pipe') {
            this._stderrStream = new PassThrough();
        }
    }

    async start(): Promise<void> {
        if (this._process) {
            throw new Error('StdioClientTransport already started!');
        }

        return new Promise((resolve, reject) => {
            this._process = spawn(this._serverParams.command, this._serverParams.args ?? [], {
                env: { ...process.env, ...this._serverParams.env },
                stdio: ['pipe', 'pipe', this._serverParams.stderr === 'pipe' ? 'pipe' : (this._serverParams.stderr || 'inherit')],
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

            this._process.on('close', (code: number) => {
                this._process = undefined;
                this.onclose?.();
            });

            this._process.stdin?.on('error', (error: Error) => {
                this.onerror?.(error);
            });

            this._process.stdout?.on('data', (chunk: Buffer) => {
                this._readBuffer.append(chunk);
                this.processReadBuffer();
            });

            this._process.stdout?.on('error', (error: Error) => {
                this.onerror?.(error);
            });

            if (this._stderrStream && this._process.stderr) {
                this._process.stderr.pipe(this._stderrStream);
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
            } catch (error: any) {
                this.onerror?.(error);
            }
        }
    }

    async close() {
        if (this._process) {
            this._process.kill();
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
