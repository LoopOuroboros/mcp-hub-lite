import { StdioTransport } from './stdio-transport.js';
import { SseTransport } from './sse-transport.js';
import { StreamableHttpTransport } from './streamable-http-transport.js';
import { ServerTransportConfig } from './transport.interface.js';
import type { ServerConfig } from '@config/config.schema.js';

/**
 * 传输工厂 - 根据服务器配置创建相应的传输客户端
 */
export class TransportFactory {
  /**
   * 创建传输客户端
   * @param server 服务器配置，包含基础配置和实例配置
   * @returns 传输客户端实例
   * @throws Error 如果服务器类型不支持或配置无效
   */
  static createTransport(server: ServerConfig & { name: string }): import('@modelcontextprotocol/sdk/shared/transport.js').Transport {
    const transportConfig = this.validateAndConvertConfig(server);

    // 使用类型断言确保 TypeScript 能够正确推断类型
    const config = transportConfig as ServerTransportConfig;

    switch (config.type) {
      case 'stdio':
        if (!config.command) {
          throw new Error('STDIO transport requires a command');
        }
        return new StdioTransport({
          command: config.command,
          args: config.args,
          env: config.env,
          cwd: process.cwd(),
          stderr: 'pipe'
        }, server.name);

      case 'sse':
        if (!config.url) {
          throw new Error('SSE transport requires a URL');
        }
        return new SseTransport(
          config.url,
          config.headers,
          config.reconnectInterval,
          config.maxReconnectAttempts
        );

      case 'streamable-http':
      case 'http':  // 兼容 http 类型，视为 streamable-http
        if (!config.url) {
          throw new Error('Streamable HTTP transport requires a URL');
        }
        return new StreamableHttpTransport(
          config.url,
          config.headers,
          config.timeout
        );

      default:
        throw new Error(`Unsupported transport type: ${(config as ServerTransportConfig).type || 'undefined'}`);
    }
  }

  /**
   * 构建系统环境变量
   * 为 stdio 传输添加必要的系统环境变量
   */
  private static buildSystemEnv(): Record<string, string> {
    return {
    };
  }

  /**
   * 验证并转换服务器配置为传输配置
   */
  private static validateAndConvertConfig(server: ServerConfig & { name: string }): ServerTransportConfig {
    const type = server.type || 'stdio';

    if (type === 'stdio') {
      return {
        type: 'stdio',
        command: server.command || '',
        args: server.args,
        env: {
          ...this.buildSystemEnv(), // 系统环境变量
          ...(server.env || {}) // 用户自定义的环境变量（可覆盖系统默认值）
        },
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
    } else if (type === 'streamable-http' || type === 'http') {
      return {
        type: 'streamable-http', // 统一转换为 streamable-http
        url: server.url || '',
        headers: server.env,
        timeout: server.timeout || 30000
      };
    } else {
      // 默认返回 stdio 类型，避免返回 never 类型
      return {
        type: 'stdio',
        command: '',
        args: [],
        env: this.buildSystemEnv(),
        cwd: process.cwd(),
        stderr: 'pipe'
      };
    }
  }
}