import { StdioTransport } from './stdio-transport.js';
import { SseTransport } from './sse-transport.js';
import { StreamableHttpTransport } from './streamable-http-transport.js';
import { ServerTransportConfig } from './transport.interface.js';
import type { ServerConfig } from '@config/config.schema.js';
import { logStorage } from '@services/log-storage.service.js';

/**
 * Transport Factory - creates appropriate transport client based on server configuration
 */
export class TransportFactory {
  /**
   * Create transport client
   * @param server Server configuration, including base configuration and instance configuration
   * @param serverId Optional server ID for log storage integration
   * @returns Transport client instance
   * @throws Error if server type is not supported or configuration is invalid
   */
  static createTransport(
    server: ServerConfig & { name: string },
    serverId?: string
  ): import('@modelcontextprotocol/sdk/shared/transport.js').Transport {
    const transportConfig = this.validateAndConvertConfig(server);

    // Use type assertion to ensure TypeScript can correctly infer types
    const config = transportConfig as ServerTransportConfig;

    switch (config.type) {
      case 'stdio':
        if (!config.command) {
          throw new Error('STDIO transport requires a command');
        }
        return new StdioTransport(
          {
            command: config.command,
            args: config.args,
            env: config.env,
            cwd: process.cwd(),
            stderr: 'pipe'
          },
          server.name,
          {
            serverId,
            logStorage: serverId ? logStorage : undefined
          }
        );

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
      case 'http': // Compatibility with http type, treat as streamable-http
        if (!config.url) {
          throw new Error('Streamable HTTP transport requires a URL');
        }
        return new StreamableHttpTransport(config.url, config.headers, config.timeout);

      default:
        throw new Error(
          `Unsupported transport type: ${(config as ServerTransportConfig).type || 'undefined'}`
        );
    }
  }

  /**
   * Build system environment variables
   * Add necessary system environment variables for stdio transport
   */
  private static buildSystemEnv(): Record<string, string> {
    return {};
  }

  /**
   * Validate and convert server configuration to transport configuration
   */
  private static validateAndConvertConfig(
    server: ServerConfig & { name: string }
  ): ServerTransportConfig {
    const type = server.type || 'stdio';

    if (type === 'stdio') {
      return {
        type: 'stdio',
        command: server.command || '',
        args: server.args,
        env: {
          ...this.buildSystemEnv(), // System environment variables
          ...(server.env || {}) // User-defined environment variables (can override system defaults)
        },
        cwd: process.cwd(),
        stderr: 'pipe'
      };
    } else if (type === 'sse') {
      return {
        type: 'sse',
        url: server.url || '',
        headers: server.headers || server.env, // Prefer headers, fallback to env for backward compatibility
        reconnectInterval: 3000,
        maxReconnectAttempts: 5
      };
    } else if (type === 'streamable-http' || type === 'http') {
      return {
        type: 'streamable-http', // Unified conversion to streamable-http
        url: server.url || '',
        headers: server.headers || server.env, // Prefer headers, fallback to env for backward compatibility
        timeout: server.timeout || 30000
      };
    } else {
      // Default to stdio type to avoid returning never type
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
