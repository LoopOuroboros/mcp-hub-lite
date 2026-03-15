import type { ServerConfig, ServerInstanceConfig } from '@config/config.schema.js';

/**
 * Configuration options for server instance selection in multi-instance scenarios.
 *
 * This interface defines request options that can be used to select specific server instances
 * when multiple instances of the same MCP server are available. The current implementation
 * uses the first available instance, but the interface is designed to support future
 * extensions for intelligent instance selection based on various criteria.
 *
 * @interface RequestOptions
 * @property {string} [sessionId] - Session identifier for selecting instance associated with specific session
 * @property {Record<string, string>} [tags] - Key-value tags for matching against server instance tags
 *
 * @example
 * ```typescript
 * // Select instance based on session
 * const options: RequestOptions = { sessionId: 'session-123' };
 *
 * // Select instance based on tags
 * const options: RequestOptions = { tags: { environment: 'production' } };
 * ```
 */
export interface RequestOptions {
  sessionId?: string; // Session ID (for selecting specific instance)
  tags?: Record<string, string>; // Tags (for future support)
  // Future options that may be added
  // clientId?: string;  // Client ID (for selecting dedicated instance)
}

/**
 * Type for server information with configuration and instance details.
 */
export type ServerInstanceInfo = {
  name: string;
  config: ServerConfig;
  instance: ServerInstanceConfig & Record<string, unknown>;
};

/**
 * Type guard return type.
 */
export type ValidServer = { name: string; config: ServerConfig };
