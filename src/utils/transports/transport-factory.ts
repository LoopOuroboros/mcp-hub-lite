import { McpServerConfig } from '../../config/config.schema.js';
import { CustomStdioClientTransport } from '../custom-stdio-transport.js';
import { SseTransport } from './sse-transport.js';
import { HttpTransport } from './http-transport.js';
import { StreamableHttpTransport } from './streamable-http-transport.js';
import { Transport, ServerTransportConfig } from './transport.interface.js';
import { logger } from '../../utils/logger.js';

/**
 * 传输工厂 - 根据服务器配置创建相应的传输客户端
 */
export class TransportFactory {
  /**
   * 创建传输客户端
   * @param server 服务器配置
   * @returns 传输客户端实例
   * @throws Error 如果服务器类型不支持或配置无效
   */
  static createTransport(server: McpServerConfig): Transport {
    const transportConfig = this.validateAndConvertConfig(server);

    switch (transportConfig.type) {
      case 'stdio':
        if (!transportConfig.command) {
          throw new Error('STDIO transport requires a command');
        }
        return new CustomStdioClientTransport({
          command: transportConfig.command,
          args: transportConfig.args,
          env: transportConfig.env,
          cwd: process.cwd(),
          stderr: 'pipe'
        });

      case 'sse':
        if (!transportConfig.url) {
          throw new Error('SSE transport requires a URL');
        }
        return new SseTransport(
          transportConfig.url,
          transportConfig.headers,
          transportConfig.reconnectInterval,
          transportConfig.maxReconnectAttempts
        );

      case 'http':
        if (!transportConfig.url) {
          throw new Error('HTTP transport requires a URL');
        }
        return new HttpTransport(
          transportConfig.url,
          transportConfig.headers,
          transportConfig.timeout
        );

      case 'streamable-http':
        if (!transportConfig.url) {
          throw new Error('Streamable HTTP transport requires a URL');
        }
        return new StreamableHttpTransport(
          transportConfig.url,
          transportConfig.headers,
          transportConfig.timeout
        );

      default:
        throw new Error(`Unsupported transport type: ${server.type || 'undefined'}`);
    }
  }

  /**
   * 验证并转换服务器配置为传输配置
   */
  private static validateAndConvertConfig(server: McpServerConfig): ServerTransportConfig {
    const type = server.type || 'stdio';

    if (type === 'stdio') {
      return {
        type: 'stdio',
        command: server.command || '',
        args: server.args,
        env: server.env,
        cwd: process.cwd(),
        stderr: 'pipe'
      };
    } else if (type === 'sse') {
      return {
        type: 'sse',
        url: server.url || '',
        headers: server.env, // Reuse env as headers for simplicity
        reconnectInterval: 3000,
        maxReconnectAttempts: 5
      };
    } else if (type === 'http') {
      return {
        type: 'http',
        url: server.url || '',
        headers: server.env,
        timeout: server.timeout || 30000
      };
    } else if (type === 'streamable-http') {
      return {
        type: 'streamable-http',
        url: server.url || '',
        headers: server.env,
        timeout: server.timeout || 30000
      };
    } else {
      throw new Error(`Unsupported server type: ${type}`);
    }
  }
}