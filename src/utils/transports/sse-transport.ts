import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { logger } from '@utils/logger.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';

// Use EventSource from the 'eventsource' package for Node.js compatibility
import { EventSource } from 'eventsource';

/**
 * SSE (Server-Sent Events) transport implementation for MCP protocol communication.
 *
 * This transport provides a unidirectional communication channel from server to client
 * using the Server-Sent Events (SSE) protocol. It is designed for MCP servers that
 * support SSE for streaming notifications and responses to the client.
 *
 * **Key Features:**
 * - Automatic reconnection with exponential backoff strategy
 * - JSON-RPC message parsing and validation
 * - Configurable connection parameters (headers, reconnect interval, max attempts)
 * - Built-in error handling and logging
 * - Graceful shutdown and cleanup
 *
 * **Limitations:**
 * - SSE is unidirectional (server-to-client only)
 * - Client-to-server messages are not supported via this transport
 * - For bidirectional communication, use stdio or HTTP transports instead
 *
 * **Usage Scenario:**
 * Ideal for remote MCP servers that expose SSE endpoints for real-time updates,
 * notifications, or streaming responses where the client primarily receives data
 * from the server rather than sending requests.
 *
 * @implements {Transport}
 */
export class SseTransport implements Transport {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private isClosing = false;
  private _serverName?: string;
  private _serverId?: string;

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
   * @param serverName - Optional server name for logging
   * @param serverId - Optional server ID for logging
   */
  constructor(
    private url: string,
    private headers: Record<string, string> = {},
    private reconnectInterval: number = 3000,
    private maxReconnectAttempts: number = 5,
    serverName?: string,
    serverId?: string
  ) {
    this._serverName = serverName;
    this._serverId = serverId;
  }

  /**
   * Helper method to format log messages with server context.
   *
   * @param message - The base message
   * @returns Formatted message with server context if available
   */
  private formatLogMessage(message: string): string {
    if (this._serverId) {
      return `${message} (serverId=${this._serverId}, url=${this.url})`;
    } else if (this._serverName) {
      return `${message} (server=${this._serverName}, url=${this.url})`;
    } else {
      return `${message} (url=${this.url})`;
    }
  }

  /**
   * Initializes and starts the SSE connection to the specified URL.
   *
   * This method establishes a connection to the SSE endpoint, sets up event handlers
   * for message processing, error handling, and connection lifecycle events.
   * It also configures automatic reconnection logic for handling transient network issues.
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

    // Note: The 'eventsource' package doesn't support custom headers directly,
    // but we can pass them as options
    try {
      const options: Record<string, unknown> = {};
      if (Object.keys(this.headers).length > 0) {
        options.headers = this.headers;
      }
      this.eventSource = new EventSource(this.url, options);

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
   *
   * @returns {Promise<void>} Resolves when the connection is fully closed
   */
  async close(): Promise<void> {
    this.isClosing = true;
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
      this.onclose?.();
    }
  }

  /**
   * Attempts to send a JSON-RPC message through the SSE transport.
   *
   * **Note**: This method always throws an error because SSE is a unidirectional
   * protocol (server-to-client only). Client-to-server communication is not supported
   * by the SSE protocol specification.
   *
   * For bidirectional MCP communication, use stdio or HTTP transports instead.
   *
   * @param message - The JSON-RPC message to send (will not be actually sent)
   * @throws {Error} Always throws an error indicating that SSE transport does not support sending messages
   * @returns {Promise<void>} Never resolves successfully due to the inherent limitation of SSE
   */
  async send(message: JSONRPCMessage): Promise<void> {
    // SSE is unidirectional (server to client only)
    // For bidirectional communication, we need a separate HTTP endpoint
    // This is a limitation of SSE protocol
    const error = new Error(
      'SSE transport does not support sending messages. ' +
        'SSE is a unidirectional protocol (server-to-client only). ' +
        'For bidirectional MCP communication, use stdio or HTTP transports instead.'
    );

    // Type-safe way to access message properties
    const messageId = 'id' in message ? String(message.id) : 'unknown';
    const method = 'method' in message ? String(message.method) : 'unknown';

    logger.warn(
      this.formatLogMessage('Attempted to send message via SSE transport'),
      {
        messageId,
        method
      },
      LOG_MODULES.SSE_TRANSPORT
    );

    throw error;
  }
}
