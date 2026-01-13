import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Transport } from './transport.interface.js';
import { logger } from '../../utils/logger.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { URL } from 'url';

/**
 * Streamable HTTP 传输客户端
 * 用于连接支持 MCP Streamable HTTP 协议的服务器
 *
 * Streamable HTTP 使用:
 * - HTTP POST 发送消息
 * - HTTP GET + Server-Sent Events (SSE) 接收消息
 */
export class StreamableHttpTransport implements Transport {
  private transport: StreamableHTTPClientTransport | null = null;
  private isClosing = false;

  public onmessage?: (message: JSONRPCMessage) => void;
  public onerror?: (error: Error) => void;
  public onclose?: () => void;

  constructor(
    private url: string,
    private headers: Record<string, string> = {},
    private timeout: number = 30000
  ) {}

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
        timeout: this.timeout
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

  async close(): Promise<void> {
    this.isClosing = true;
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.onclose?.();
  }

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