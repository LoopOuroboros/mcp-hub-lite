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
 * Streamable HTTP Local transport configuration
 * Local process launched with command, connected via StreamableHTTP URL
 */
export interface StreamableHttpLocalTransportConfig {
  type: 'streamable-http-local';
  command: string;
  args?: string[];
  env?: Record<string, string>;
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
  | StreamableHttpTransportConfig
  | StreamableHttpLocalTransportConfig;
