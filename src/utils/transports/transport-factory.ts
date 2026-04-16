import { StdioTransport } from './stdio-transport.js';
import { SseTransport } from './sse-transport.js';
import { StreamableHttpTransport } from './streamable-http-transport.js';
import { ServerTransportConfig } from './transport.interface.js';
import type { ServerRuntimeConfig } from '@shared-models/server.model.js';
import { logStorage } from '@services/log-storage.service.js';

/**
 * Transport Factory - creates appropriate transport client based on server configuration
 */
export class TransportFactory {
  /**
   * Create transport client
   * @param server Server configuration, including base configuration and instance configuration
   * @param compositeKey Optional composite key (serverName-serverIndex) for log storage integration
   * @param options Optional transport options including readyPatterns and readyTimeout
   * @returns Transport client instance
   * @throws Error if server type is not supported or configuration is invalid
   */
  static createTransport(
    server: ServerRuntimeConfig & { name: string },
    compositeKey?: string,
    options?: {
      readyPatterns?: string[];
      readyTimeout?: number;
    }
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
            compositeKey,
            logStorage: compositeKey ? logStorage : undefined,
            readyPatterns: options?.readyPatterns,
            readyTimeout: options?.readyTimeout ?? 120000
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
          config.maxReconnectAttempts,
          config.proxy,
          server.name,
          compositeKey
        );

      case 'streamable-http':
      case 'http': // Compatibility with http type, treat as streamable-http
        if (!config.url) {
          throw new Error('Streamable HTTP transport requires a URL');
        }
        return new StreamableHttpTransport(
          config.url,
          config.headers,
          config.timeout,
          config.proxy,
          server.name,
          compositeKey
        );

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
  private static buildSystemEnv(command?: string): Record<string, string> {
    const env: Record<string, string> = {};

    // For Python-related commands, set PYTHONUTF8=1 to ensure proper UTF-8 handling
    if (command && this.isPythonCommand(command)) {
      env.PYTHONUTF8 = '1';
    }

    return env;
  }

  /**
   * Check if a command is related to Python execution
   * Detects python, python3, py, uv, uvx, and similar commands
   */
  private static isPythonCommand(command: string): boolean {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return false;

    // Extract the basename (last part after / or \)
    const parts = trimmedCommand.split(/[\\/]/);
    const basename = parts[parts.length - 1].toLowerCase();

    return basename.includes('python') || basename.startsWith('uv') || basename.startsWith('py');
  }

  /**
   * Validate and convert server configuration to transport configuration
   */
  private static validateAndConvertConfig(
    server: ServerRuntimeConfig & { name: string }
  ): ServerTransportConfig {
    const type = server.type || 'stdio';

    if (type === 'stdio') {
      return {
        type: 'stdio',
        command: server.command || '',
        args: server.args,
        env: {
          ...this.buildSystemEnv(server.command), // System environment variables
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
        maxReconnectAttempts: 5,
        proxy: server.proxy
      };
    } else if (type === 'streamable-http' || type === 'http') {
      return {
        type: 'streamable-http', // Unified conversion to streamable-http
        url: server.url || '',
        headers: server.headers || server.env, // Prefer headers, fallback to env for backward compatibility
        timeout: server.timeout || 30000,
        proxy: server.proxy
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
