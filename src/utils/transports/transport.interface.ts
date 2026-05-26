/**
 * STDIO transport configuration
 */
export interface StdioTransportConfig {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  stderr?: 'inherit' | 'pipe' | 'ignore';
}

/**
 * SSE transport configuration
 *
 * Supports Legacy SSE MCP protocol (2024-11-05 spec):
 * - Connect to SSE endpoint, listen for `endpoint` event
 * - Send JSON-RPC messages via HTTP POST to the dynamic endpoint
 */
export interface SseTransportConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  proxy?: {
    url: string;
  };
  /**
   * Timeout (in milliseconds) for waiting for endpoint event.
   * Default: 10000 (10 seconds)
   */
  endpointTimeout?: number;
  /**
   * Whether to enforce same-origin check for endpoint URL.
   * Default: true
   */
  strictOriginCheck?: boolean;
}

import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';

/**
 * Streamable HTTP transport configuration
 */
export interface StreamableHttpTransportConfig {
  type: 'streamable-http' | 'http';
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  proxy?: {
    url: string;
  };
  authProvider?: OAuthClientProvider;
}

/**
 * Generic server configuration
 */
export type ServerTransportConfig =
  | StdioTransportConfig
  | SseTransportConfig
  | StreamableHttpTransportConfig;
