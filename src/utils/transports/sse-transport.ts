import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Transport } from './transport.interface.js';
import { logger } from '../../utils/logger.js';

// Use EventSource from the 'eventsource' package for Node.js compatibility
import { EventSource } from 'eventsource';

/**
 * SSE (Server-Sent Events) 传输客户端
 * 用于连接支持 SSE 的 MCP 服务器
 */
export class SseTransport implements Transport {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private isClosing = false;

  public onmessage?: (message: JSONRPCMessage) => void;
  public onerror?: (error: Error) => void;
  public onclose?: () => void;

  constructor(
    private url: string,
    private headers: Record<string, string> = {},
    private reconnectInterval: number = 3000,
    private maxReconnectAttempts: number = 5
  ) {}

  async start(): Promise<void> {
    if (this.eventSource) {
      throw new Error('SSE Transport already started!');
    }

    this.isClosing = false;
    this.reconnectAttempts = 0;

    // Note: The 'eventsource' package doesn't support custom headers directly,
    // but we can pass them as options
    try {
      const options: any = {};
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
          logger.error('Failed to parse SSE message:', error);
          this.onerror?.(new Error(`Invalid JSON in SSE message: ${event.data}`));
        }
      };

      this.eventSource.onerror = (event) => {
        const error = new Error(`SSE connection error for ${this.url}`);
        logger.error('SSE connection error:', error);

        if (!this.isClosing) {
          this.reconnectAttempts++;
          if (this.reconnectAttempts <= this.maxReconnectAttempts) {
            logger.info(`Attempting to reconnect SSE (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => {
              this.restart();
            }, this.reconnectInterval);
          } else {
            logger.error('Max reconnection attempts reached for SSE');
            this.onerror?.(error);
            this.closeInternal();
          }
        }
      };

      this.eventSource.onopen = () => {
        logger.info(`SSE connection opened to ${this.url}`);
      };
    } catch (error) {
      logger.error('Failed to create SSE connection:', error);
      throw error;
    }
  }

  private async restart(): Promise<void> {
    await this.closeInternal();
    if (!this.isClosing) {
      await this.start();
    }
  }

  async close(): Promise<void> {
    this.isClosing = true;
    await this.closeInternal();
  }

  private async closeInternal(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.onclose?.();
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    // SSE is unidirectional (server to client only)
    // For bidirectional communication, we need a separate HTTP endpoint
    // This is a limitation of SSE protocol
    throw new Error('SSE transport does not support sending messages (unidirectional protocol)');
  }
}