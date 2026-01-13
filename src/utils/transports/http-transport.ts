import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Transport } from './transport.interface.js';
import { logger } from '../../utils/logger.js';
import https from 'https';
import http from 'http';
import { URL } from 'url';

/**
 * HTTP 传输客户端
 * 用于连接支持 HTTP JSON-RPC 的 MCP 服务器
 */
export class HttpTransport implements Transport {
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
    // HTTP transport doesn't maintain a persistent connection
    // It's stateless, so start() is essentially a no-op
    logger.info(`HTTP transport initialized for ${this.url}`);
  }

  async close(): Promise<void> {
    this.isClosing = true;
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.isClosing) {
      throw new Error('Transport is closing');
    }

    const url = new URL(this.url);
    const options: any = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...this.headers
      },
      timeout: this.timeout
    };

    const requestBody = JSON.stringify(message);

    return new Promise((resolve, reject) => {
      const protocol = url.protocol === 'https:' ? https : http;
      const req = protocol.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const response = JSON.parse(data) as JSONRPCMessage;
              this.onmessage?.(response);
              resolve();
            } else {
              const error = new Error(`HTTP ${res.statusCode}: ${data}`);
              this.onerror?.(error);
              reject(error);
            }
          } catch (parseError) {
            const error = new Error(`Failed to parse HTTP response: ${parseError}`);
            this.onerror?.(error);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        logger.error('HTTP request error:', error);
        this.onerror?.(error);
        reject(error);
      });

      req.on('timeout', () => {
        const error = new Error(`HTTP request timeout after ${this.timeout}ms`);
        req.destroy();
        this.onerror?.(error);
        reject(error);
      });

      req.write(requestBody);
      req.end();
    });
  }
}