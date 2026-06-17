import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { logger, LOG_MODULES } from '@utils/logger/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { LogStorageService } from '@services/log-storage.service.js';
import { ProcessLauncher, type LaunchedProcess } from '@utils/process-launcher.js';

/**
 * Hybrid transport: launches a local process (via ProcessLauncher) and communicates via StreamableHTTP.
 * Used for MCP servers that are started locally with --http flags (e.g. via uvx/npx)
 * and expose an HTTP endpoint instead of using stdio for MCP protocol.
 *
 * Internally delegates process management to ProcessLauncher (zero MCP dependency)
 * and MCP communication to SDK's StreamableHTTPClientTransport.
 */
export class StreamableHttpLocalTransport implements Transport {
  private _process: LaunchedProcess | null = null;
  private _httpTransport: StreamableHTTPClientTransport | null = null;
  private _isStarted = false;
  private _isClosing = false;
  private _serverName?: string;
  private _compositeKey?: string;
  private _logStorage?: LogStorageService;

  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage) => void;
  public onstderr?: (data: string) => void;

  constructor(
    private _command: string,
    private _args: string[],
    private _env: Record<string, string> | undefined,
    private _url: string,
    private _headers: Record<string, string> = {},
    private _timeout: number = 30000,
    private _proxy?: { url: string },
    private _authProvider?: OAuthClientProvider,
    serverName?: string,
    compositeKey?: string,
    private _readyPatterns?: string[],
    private _readyTimeout: number = 120000,
    logStorage?: LogStorageService
  ) {
    this._serverName = serverName;
    this._compositeKey = compositeKey;
    this._logStorage = logStorage;
  }

  private formatLogMessage(message: string): string {
    const id = this._compositeKey || this._serverName || 'Unknown';
    return `${message} (server=${id}, url=${this._url})`;
  }

  get pid(): number | undefined {
    return this._process?.pid;
  }

  get stderr() {
    return this._process?.stderr ?? null;
  }

  async start(): Promise<void> {
    if (this._isStarted) {
      throw new Error('Streamable HTTP Local Transport already started!');
    }

    this._isClosing = false;

    logger.info(
      this.formatLogMessage(
        `Starting local process: command=${this._command}, args=${JSON.stringify(this._args)}`
      ),
      LOG_MODULES.STREAMABLE_HTTP_LOCAL_TRANSPORT
    );

    // Phase 1: Launch process via ProcessLauncher (zero MCP dependency)
    this._process = ProcessLauncher.launch({
      command: this._command,
      args: this._args,
      env: this._env
    });

    // Register stderr → logStorage + onstderr callback
    if (this._process.stderr) {
      this._process.stderr.on('data', (chunk: Buffer) => {
        const dataStr = chunk.toString('utf8').trim();
        if (!dataStr) return;
        this.onstderr?.(dataStr);
        if (this._logStorage && this._compositeKey) {
          this._logStorage.append(this._compositeKey, 'info', dataStr);
        }
      });
    }

    // Wait for ready pattern
    if (this._readyPatterns && this._readyPatterns.length > 0) {
      logger.info(
        this.formatLogMessage(`Waiting for ready patterns: ${JSON.stringify(this._readyPatterns)}`),
        LOG_MODULES.STREAMABLE_HTTP_LOCAL_TRANSPORT
      );
      try {
        await ProcessLauncher.waitForReady(
          this._process.stderr,
          this._readyPatterns,
          this._readyTimeout
        );
        logger.info(
          this.formatLogMessage('Ready pattern detected, proceeding with HTTP connection'),
          LOG_MODULES.STREAMABLE_HTTP_LOCAL_TRANSPORT
        );
      } catch (error) {
        await this._process.stop();
        this._process = null;
        throw error;
      }
    }

    // Resolve host:port from URL and probe port until listening
    const parsedUrl = new URL(this._url);
    const host = parsedUrl.hostname || 'localhost';
    const port = parseInt(parsedUrl.port || '80', 10);
    logger.info(
      this.formatLogMessage(`Probing port ${host}:${port}...`),
      LOG_MODULES.STREAMABLE_HTTP_LOCAL_TRANSPORT
    );
    await ProcessLauncher.waitForPort(host, port, this._readyTimeout);
    logger.info(
      this.formatLogMessage(`Port ${host}:${port} is listening, waiting 5s before HTTP connect`),
      LOG_MODULES.STREAMABLE_HTTP_LOCAL_TRANSPORT
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Phase 2: Connect via StreamableHTTP (standard MCP transport)
    logger.info(
      this.formatLogMessage('Connecting to local HTTP endpoint'),
      LOG_MODULES.STREAMABLE_HTTP_LOCAL_TRANSPORT
    );

    try {
      const url = new URL(this._url);
      const requestInit: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          ...this._headers
        },
        signal: AbortSignal.timeout(this._timeout)
      };

      const transportOptions: Record<string, unknown> = { requestInit };

      if (this._authProvider) {
        transportOptions.authProvider = this._authProvider;
      }

      if (this._proxy?.url) {
        const agent = new ProxyAgent(this._proxy.url);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const customFetch = (input: any, init?: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fetchOptions: any = { ...init, dispatcher: agent };
          return undiciFetch(input, fetchOptions) as unknown as Promise<Response>;
        };
        transportOptions.fetch = customFetch;
      }

      this._httpTransport = new StreamableHTTPClientTransport(
        url,
        transportOptions as Record<string, unknown>
      );

      this._httpTransport.onmessage = (message: JSONRPCMessage) => {
        this.onmessage?.(message);
      };

      this._httpTransport.onerror = (error: Error) => {
        logger.error(
          this.formatLogMessage(`HTTP transport error: ${error.message}`),
          error,
          LOG_MODULES.STREAMABLE_HTTP_LOCAL_TRANSPORT
        );
        this.onerror?.(error);
      };

      this._httpTransport.onclose = () => {
        logger.info(
          this.formatLogMessage('HTTP transport closed'),
          LOG_MODULES.STREAMABLE_HTTP_LOCAL_TRANSPORT
        );
        if (!this._isClosing) {
          this.onclose?.();
        }
      };

      await this._httpTransport.start();
      this._isStarted = true;

      logger.info(
        this.formatLogMessage('Streamable HTTP Local transport started successfully'),
        LOG_MODULES.STREAMABLE_HTTP_LOCAL_TRANSPORT
      );
    } catch (error) {
      logger.error(
        this.formatLogMessage(
          `Failed to connect HTTP transport: ${error instanceof Error ? error.message : String(error)}`
        ),
        LOG_MODULES.STREAMABLE_HTTP_LOCAL_TRANSPORT
      );
      // Clean up child process on connection failure
      if (this._process) {
        await this._process.stop();
        this._process = null;
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this._isClosing) return;

    this._isClosing = true;

    try {
      if (this._httpTransport) {
        await this._httpTransport.close();
        this._httpTransport = null;
      }
    } catch (error) {
      logger.warn(
        this.formatLogMessage(
          `Error closing HTTP transport: ${error instanceof Error ? error.message : String(error)}`
        ),
        LOG_MODULES.STREAMABLE_HTTP_LOCAL_TRANSPORT
      );
    }

    if (this._process) {
      await this._process.stop();
      this._process = null;
    }

    this._isStarted = false;
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this._isClosing) {
      throw new Error('Transport is closing');
    }

    if (!this._httpTransport) {
      throw new Error('HTTP transport not started');
    }

    await this._httpTransport.send(message);
  }

  /**
   * Returns the OAuth provider if configured, for connection manager to handle auth flow.
   */
  getOAuthProvider(): OAuthClientProvider | undefined {
    return this._authProvider;
  }

  /**
   * Returns the underlying SDK transport for auth flow management.
   */
  getSdkTransport(): StreamableHTTPClientTransport | null {
    return this._httpTransport;
  }
}
