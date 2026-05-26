import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { logger } from '@utils/logger.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

// Use EventSource from the 'eventsource' package for Node.js compatibility
import { EventSource } from 'eventsource';

/**
 * SSE (Server-Sent Events) transport implementation for MCP protocol communication.
 *
 * This transport implements the **Legacy SSE MCP protocol** (2024-11-05 spec):
 * 1. Connect to SSE endpoint (e.g., `/sse`)
 * 2. Listen for `endpoint` event containing the message POST URL
 * 3. Send JSON-RPC messages via HTTP POST to the dynamic endpoint
 *
 * **Key Features:**
 * - Legacy SSE MCP protocol support (endpoint event discovery)
 * - Automatic reconnection with exponential backoff strategy
 * - JSON-RPC message parsing and validation
 * - Configurable connection parameters (headers, reconnect interval, max attempts)
 * - Built-in error handling and logging
 * - Graceful shutdown and cleanup
 * - Same-origin validation for endpoint security
 *
 * **Protocol Flow:**
 * 1. Client connects to SSE URL via EventSource
 * 2. Server sends `endpoint` event with POST URL (may include session_id query)
 * 3. Client sends JSON-RPC messages via HTTP POST to that endpoint
 * 4. Server sends responses/notifications via SSE `message` events
 *
 * @implements {Transport}
 */
export class SseTransport implements Transport {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private isClosing = false;
  private _serverName?: string;
  private _compositeKey?: string;

  // Legacy SSE endpoint discovery
  private messageEndpointUrl: URL | null = null;
  private endpointReady!: Promise<void>;
  private endpointReadyResolver: (() => void) | null = null;
  private closeReject: ((reason: Error) => void) | null = null;

  // Parsed SSE base URL for relative endpoint resolution
  private sseBaseUrl: URL;

  public onmessage?: (message: JSONRPCMessage) => void;
  public onerror?: (error: Error) => void;
  public onclose?: () => void;

  /**
   * Creates a new SSE transport instance.
   *
   * @param url - The SSE endpoint URL to connect to
   * @param headers - Optional HTTP headers to include in the SSE connection request
   * @param reconnectInterval - Time interval (in milliseconds) between reconnection attempts (default: 3000ms)
   * @param maxReconnectAttempts - Maximum number of reconnection attempts before giving up (default: 5)
   * @param proxy - Optional proxy configuration
   * @param serverName - Optional server name for logging
   * @param compositeKey - Optional composite key (serverName-serverIndex) for logging
   * @param endpointTimeout - Timeout (in milliseconds) for waiting for endpoint event (default: 10000ms)
   * @param strictOriginCheck - Whether to enforce same-origin check for endpoint (default: true)
   */
  constructor(
    private url: string,
    private headers: Record<string, string> = {},
    private reconnectInterval: number = 3000,
    private maxReconnectAttempts: number = 5,
    private proxy?: { url: string },
    serverName?: string,
    compositeKey?: string,
    private endpointTimeout: number = 10000,
    private strictOriginCheck: boolean = true
  ) {
    this._serverName = serverName;
    this._compositeKey = compositeKey;
    this.sseBaseUrl = new URL(url);

    // Initialize endpoint ready promise
    this.resetEndpointReady();
  }

  /**
   * Reset the endpoint ready promise.
   * Must be called before each connection/reconnection attempt.
   */
  private resetEndpointReady(): void {
    this.closeReject = null;
    this.messageEndpointUrl = null;
    this.endpointReady = new Promise<void>((resolve, reject) => {
      this.endpointReadyResolver = resolve;
      this.closeReject = reject;
    });
    // Prevent unhandled rejection if close() is called without any pending send()
    this.endpointReady.catch(() => {});
  }

  /**
   * Helper method to format log messages with server context.
   *
   * @param message - The base message
   * @returns Formatted message with server context if available
   */
  private formatLogMessage(message: string): string {
    if (this._compositeKey) {
      return `${message} (compositeKey=${this._compositeKey}, url=${this.url})`;
    } else if (this._serverName) {
      return `${message} (server=${this._serverName}, url=${this.url})`;
    } else {
      return `${message} (url=${this.url})`;
    }
  }

  /**
   * Sanitize endpoint URL for logging (hide query parameters).
   */
  private sanitizeEndpointForLog(endpoint: URL): string {
    return `${endpoint.origin}${endpoint.pathname}`;
  }

  /**
   * Initializes and starts the SSE connection to the specified URL.
   *
   * This method establishes a connection to the SSE endpoint, sets up event handlers
   * for message processing, error handling, and connection lifecycle events.
   * It also configures automatic reconnection logic for handling transient network issues.
   *
   * **Legacy SSE Protocol**: Listens for `endpoint` event to discover the POST URL.
   *
   * @throws {Error} If the transport is already started or if connection creation fails
   * @returns {Promise<void>} Resolves when the connection is successfully established
   */
  async start(): Promise<void> {
    if (this.eventSource) {
      throw new Error('SSE Transport already started!');
    }

    this.isClosing = false;
    this.reconnectAttempts = 0;

    // Reset endpoint ready promise before each connection
    this.resetEndpointReady();

    // Note: The 'eventsource' package doesn't support custom headers directly,
    // but we can pass them as options
    try {
      const options: Record<string, unknown> = {};
      if (Object.keys(this.headers).length > 0) {
        options.headers = this.headers;
      }

      const proxyInfo = this.proxy?.url ? `, proxy=${this.proxy.url}` : '';
      logger.info(
        this.formatLogMessage(`Attempting to connect to SSE server${proxyInfo}`),
        LOG_MODULES.SSE_TRANSPORT
      );

      // Add proxy support if configured
      if (this.proxy?.url) {
        const agent = new ProxyAgent(this.proxy.url);

        // Create custom fetch function with proxy
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const customFetch = (input: any, init?: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fetchOptions: any = {
            ...init,
            dispatcher: agent
          };
          return undiciFetch(input, fetchOptions) as unknown as Promise<Response>;
        };

        options.fetch = customFetch;
        logger.info(
          this.formatLogMessage(`SSE transport configured with proxy: ${this.proxy.url}`),
          LOG_MODULES.SSE_TRANSPORT
        );
      }

      this.eventSource = new EventSource(this.url, options as Record<string, unknown>);

      // Listen for 'endpoint' event (Legacy SSE MCP protocol)
      this.eventSource.addEventListener('endpoint', (event) => {
        this.handleEndpointEvent(event);
      });

      this.eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as JSONRPCMessage;
          this.onmessage?.(message);
          this.reconnectAttempts = 0; // Reset on successful message
        } catch (error) {
          logger.error(
            this.formatLogMessage('Failed to parse SSE message'),
            error,
            LOG_MODULES.SSE_TRANSPORT
          );
          this.onerror?.(new Error(`Invalid JSON in SSE message: ${event.data}`));
        }
      };

      this.eventSource.onerror = () => {
        const error = new Error(`SSE connection error for ${this.url}`);
        logger.error(
          this.formatLogMessage('SSE connection error'),
          error,
          LOG_MODULES.SSE_TRANSPORT
        );

        if (!this.isClosing) {
          this.reconnectAttempts++;
          if (this.reconnectAttempts <= this.maxReconnectAttempts) {
            logger.info(
              this.formatLogMessage(
                `Attempting to reconnect SSE (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
              ),
              LOG_MODULES.SSE_TRANSPORT
            );
            setTimeout(() => {
              this.restart();
            }, this.reconnectInterval);
          } else {
            logger.error(
              this.formatLogMessage('Max reconnection attempts reached for SSE'),
              LOG_MODULES.SSE_TRANSPORT
            );
            this.onerror?.(error);
            this.closeInternal();
          }
        }
      };

      this.eventSource.onopen = () => {
        logger.info(this.formatLogMessage('SSE connection opened'), LOG_MODULES.SSE_TRANSPORT);
      };
    } catch (error) {
      logger.error(
        this.formatLogMessage('Failed to create SSE connection'),
        error,
        LOG_MODULES.SSE_TRANSPORT
      );
      throw error;
    }
  }

  /**
   * Handle the 'endpoint' event from SSE server (Legacy SSE MCP protocol).
   * Parses the endpoint URL and validates same-origin policy.
   */
  private handleEndpointEvent(event: MessageEvent): void {
    try {
      const endpointData = event.data as string;

      if (!endpointData || endpointData.trim() === '') {
        logger.error(
          this.formatLogMessage('Received empty endpoint event'),
          LOG_MODULES.SSE_TRANSPORT
        );
        return;
      }

      // Parse endpoint URL (supports relative paths)
      const endpoint = new URL(endpointData, this.sseBaseUrl);

      // Same-origin validation
      if (this.strictOriginCheck && endpoint.origin !== this.sseBaseUrl.origin) {
        const error = new Error(
          `Endpoint origin mismatch: expected ${this.sseBaseUrl.origin}, got ${endpoint.origin}`
        );
        logger.error(
          this.formatLogMessage(
            `[SSE] Endpoint origin mismatch: expected ${this.sseBaseUrl.origin}, got ${endpoint.origin}`
          ),
          LOG_MODULES.SSE_TRANSPORT
        );
        this.onerror?.(error);
        return;
      }

      // Store the endpoint URL
      this.messageEndpointUrl = endpoint;

      logger.info(
        this.formatLogMessage(
          `[SSE] Received message endpoint: ${this.sanitizeEndpointForLog(endpoint)}`
        ),
        LOG_MODULES.SSE_TRANSPORT
      );

      // Resolve the endpoint ready promise and clear closeReject
      this.endpointReadyResolver?.();
      this.endpointReadyResolver = null;
      this.closeReject = null;
    } catch (error) {
      logger.error(
        this.formatLogMessage('Failed to parse endpoint event'),
        error,
        LOG_MODULES.SSE_TRANSPORT
      );
    }
  }

  /**
   * Restarts the SSE connection by closing the current connection and starting a new one.
   *
   * This method is used internally for automatic reconnection after connection failures.
   * It ensures proper cleanup of the existing connection before attempting to establish
   * a new one, preventing resource leaks or duplicate connections.
   *
   * @returns {Promise<void>} Resolves when the restart process is complete
   */
  private async restart(): Promise<void> {
    await this.closeInternal();
    if (!this.isClosing) {
      await this.start();
    }
  }

  /**
   * Gracefully closes the SSE connection and prevents further reconnection attempts.
   *
   * This method sets the closing flag to prevent automatic reconnection and then
   * delegates to the internal close implementation for actual cleanup.
   * It also rejects any pending send() calls waiting for endpoint.
   *
   * @returns {Promise<void>} Resolves when the connection is fully closed
   */
  async close(): Promise<void> {
    this.isClosing = true;

    // Reject any pending send() calls waiting for endpoint
    // Only reject if endpointReady hasn't been resolved yet (i.e. send() is still waiting)
    if (this.closeReject) {
      this.closeReject(new Error('Transport closing'));
      this.closeReject = null;
    }

    await this.closeInternal();
  }

  /**
   * Performs the actual cleanup of the SSE connection resources.
   *
   * This internal method handles the low-level closing of the EventSource connection,
   * nullifies the reference, and triggers the onclose callback if defined.
   * It is used by both the public close method and the restart method.
   *
   * @returns {Promise<void>} Resolves when internal cleanup is complete
   */
  private async closeInternal(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.messageEndpointUrl = null;
      this.onclose?.();
    }
  }

  /**
   * Sends a JSON-RPC message through the SSE transport via HTTP POST.
   *
   * **Legacy SSE Protocol**: Messages are sent via HTTP POST to the endpoint
   * URL received from the `endpoint` SSE event.
   *
   * @param message - The JSON-RPC message to send
   * @throws {Error} If endpoint is not received within timeout, or if POST fails
   * @returns {Promise<void>} Resolves when the message is successfully sent
   */
  async send(message: JSONRPCMessage): Promise<void> {
    // Wait for endpoint if not yet received
    if (!this.messageEndpointUrl) {
      try {
        // Race between endpoint ready, timeout, and close
        await Promise.race([
          this.endpointReady,
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(
                new Error(`SSE endpoint not received within timeout (${this.endpointTimeout}ms)`)
              );
            }, this.endpointTimeout);
          })
        ]);
      } catch (error) {
        // Log the error with sanitized info
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(this.formatLogMessage(`[SSE] ${errorMessage}`), LOG_MODULES.SSE_TRANSPORT);
        throw error;
      }
    }

    // Double-check endpoint is available (could be cleared by close)
    if (!this.messageEndpointUrl) {
      throw new Error('SSE endpoint not available');
    }

    const endpoint = this.messageEndpointUrl;

    // Type-safe way to access message properties for logging
    const messageId = 'id' in message ? String(message.id) : 'unknown';
    const method = 'method' in message ? String(message.method) : 'unknown';

    logger.debug(
      this.formatLogMessage(`[SSE] POST to endpoint: ${this.sanitizeEndpointForLog(endpoint)}`),
      {
        messageId,
        method
      },
      LOG_MODULES.SSE_TRANSPORT
    );

    try {
      // Prepare fetch options
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchOptions: any = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(this.endpointTimeout)
      };

      // Add proxy if configured
      if (this.proxy?.url) {
        const agent = new ProxyAgent(this.proxy.url);
        fetchOptions.dispatcher = agent;
      }

      const response = await undiciFetch(endpoint.toString(), fetchOptions);

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '(unable to read body)');
        const truncatedBody = bodyText.length > 200 ? bodyText.slice(0, 200) + '...' : bodyText;
        const error = new Error(
          `POST to endpoint failed: ${response.status} ${response.statusText} - ${truncatedBody}`
        );
        logger.error(
          this.formatLogMessage(
            `[SSE] POST to ${this.sanitizeEndpointForLog(endpoint)} failed: ${response.status} ${response.statusText}`
          ),
          { body: truncatedBody },
          LOG_MODULES.SSE_TRANSPORT
        );
        throw error;
      }
    } catch (error) {
      // Re-throw if already an Error with our message
      if (error instanceof Error && error.message.includes('POST to endpoint failed')) {
        throw error;
      }

      // Wrap other errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        this.formatLogMessage(`[SSE] Failed to send message to endpoint`),
        error,
        LOG_MODULES.SSE_TRANSPORT
      );
      throw new Error(`Failed to send message via SSE transport: ${errorMessage}`);
    }
  }
}
