import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { logger } from '@utils/logger.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { URL } from 'url';

/**
 * Streamable HTTP Transport implementation for MCP (Model Context Protocol)
 *
 * This transport enables communication with MCP servers that support the Streamable HTTP protocol,
 * which provides bidirectional communication over HTTP using a combination of POST requests for
 * sending messages and Server-Sent Events (SSE) for receiving streamed responses.
 *
 * The Streamable HTTP protocol is particularly useful for:
 * - Remote MCP servers accessible via HTTP/HTTPS
 * - Scenarios requiring streaming responses from tools
 * - Environments where WebSocket connections are restricted
 * - Integration with existing HTTP infrastructure
 *
 * Protocol Details:
 * - **Outbound Messages**: Sent via HTTP POST requests with JSON-RPC 2.0 formatted payloads
 * - **Inbound Messages**: Received via HTTP GET requests using Server-Sent Events (SSE) for real-time streaming
 * - **Headers**: Custom headers can be provided for authentication, authorization, or other HTTP requirements
 * - **Timeout**: Configurable request timeout to prevent hanging connections
 *
 * This transport wraps the official MCP SDK's StreamableHTTPClientTransport and provides
 * consistent error handling, logging, and lifecycle management integrated with the MCP Hub Lite system.
 *
 * @implements {Transport}
 * @see {@link https://modelcontextprotocol.io/transports/streamable-http} - Official MCP Streamable HTTP specification
 */
export class StreamableHttpTransport implements Transport {
  /**
   * Internal reference to the underlying MCP SDK transport instance
   * @private
   */
  private transport: StreamableHTTPClientTransport | null = null;

  /**
   * Flag indicating whether the transport is in the process of closing
   * Prevents sending messages during shutdown and handles unexpected closures
   * @private
   */
  private isClosing = false;

  /**
   * Event handler called when a JSON-RPC message is received from the server
   * @public
   */
  public onmessage?: (message: JSONRPCMessage) => void;

  /**
   * Event handler called when an error occurs in the transport connection
   * @public
   */
  public onerror?: (error: Error) => void;

  /**
   * Event handler called when the transport connection is closed
   * @public
   */
  public onclose?: () => void;

  /**
   * Creates a new Streamable HTTP Transport instance
   *
   * @param url - The base URL of the MCP server endpoint (e.g., "https://api.example.com/mcp")
   * @param headers - Optional HTTP headers to include with all requests (default: {})
   *                 Commonly used for authentication tokens, API keys, or custom headers
   * @param timeout - Request timeout in milliseconds (default: 30000 = 30 seconds)
   *                  Controls how long to wait for HTTP responses before timing out
   */
  constructor(
    private url: string,
    private headers: Record<string, string> = {},
    private timeout: number = 30000
  ) {}

  /**
   * Initializes and starts the Streamable HTTP transport connection
   *
   * This method establishes the connection to the MCP server by:
   * 1. Validating that the transport hasn't already been started
   * 2. Creating a new StreamableHTTPClientTransport instance from the MCP SDK
   * 3. Configuring HTTP request options including headers and timeout
   * 4. Setting up event handlers for message, error, and close events
   * 5. Starting the underlying transport connection
   *
   * The transport will automatically handle:
   * - Message routing to the onmessage handler
   * - Error logging and propagation to the onerror handler
   * - Connection lifecycle management with proper cleanup
   *
   * @returns {Promise<void>} Resolves when the transport is successfully started
   * @throws {Error} If the transport is already started or if connection fails
   *
   * @example
   * ```typescript
   * const transport = new StreamableHttpTransport('https://api.example.com/mcp', {
   *   'Authorization': 'Bearer your-token'
   * });
   * await transport.start();
   * ```
   */
  async start(): Promise<void> {
    if (this.transport) {
      throw new Error('Streamable HTTP Transport already started!');
    }

    this.isClosing = false;

    try {
      const url = new URL(this.url);
      const requestInit: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        },
        signal: AbortSignal.timeout(this.timeout)
      };

      this.transport = new StreamableHTTPClientTransport(url, {
        requestInit
      });

      // Set up event handlers
      this.transport.onmessage = (message: JSONRPCMessage) => {
        this.onmessage?.(message);
      };

      this.transport.onerror = (error: Error) => {
        logger.error('Streamable HTTP transport error:', error);
        this.onerror?.(error);
      };

      this.transport.onclose = () => {
        logger.info('Streamable HTTP transport closed');
        if (!this.isClosing) {
          // Unexpected close, trigger error
          const error = new Error('Streamable HTTP transport closed unexpectedly');
          this.onerror?.(error);
        }
        this.onclose?.();
      };

      await this.transport.start();
      logger.info(`Streamable HTTP transport initialized for ${this.url}`);
    } catch (error) {
      logger.error('Failed to create Streamable HTTP transport:', error);
      throw error;
    }
  }

  /**
   * Gracefully closes the Streamable HTTP transport connection
   *
   * This method performs a clean shutdown of the transport by:
   * 1. Setting the closing flag to prevent new message sends
   * 2. Closing the underlying MCP SDK transport connection
   * 3. Cleaning up the internal transport reference
   * 4. Triggering the onclose event handler
   *
   * The method is idempotent and can be called multiple times safely.
   * It ensures proper resource cleanup and prevents memory leaks.
   *
   * @returns {Promise<void>} Resolves when the transport is successfully closed
   *
   * @example
   * ```typescript
   * await transport.close();
   * // Transport is now closed and cannot send/receive messages
   * ```
   */
  async close(): Promise<void> {
    this.isClosing = true;
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.onclose?.();
  }

  /**
   * Sends a JSON-RPC message to the connected MCP server
   *
   * This method transmits the provided JSON-RPC message to the server using the
   * Streamable HTTP protocol. The message is sent as an HTTP POST request with
   * the appropriate Content-Type header and any configured custom headers.
   *
   * The method includes comprehensive validation and error handling:
   * - Prevents sending messages when the transport is closing
   * - Ensures the transport has been properly initialized
   * - Logs transmission errors for debugging purposes
   * - Re-throws errors to allow caller error handling
   *
   * @param message - The JSON-RPC 2.0 formatted message to send to the server
   * @returns {Promise<void>} Resolves when the message is successfully sent
   * @throws {Error} If the transport is closing, not started, or if sending fails
   *
   * @example
   * ```typescript
   * const request: JSONRPCMessage = {
   *   jsonrpc: '2.0',
   *   id: 1,
   *   method: 'textDocument/completion',
   *   params: { /* completion parameters *\/ }
   * };
   * await transport.send(request);
   * ```
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (this.isClosing) {
      throw new Error('Transport is closing');
    }

    if (!this.transport) {
      throw new Error('Streamable HTTP transport not started');
    }

    try {
      await this.transport.send(message);
    } catch (error) {
      logger.error('Failed to send message via Streamable HTTP:', error);
      throw error;
    }
  }
}
