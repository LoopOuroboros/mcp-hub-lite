/**
 * STDIO 传输配置
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
 * SSE 传输配置
 */
export interface SseTransportConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * Streamable HTTP 传输配置
 */
export interface StreamableHttpTransportConfig {
  type: 'streamable-http' | 'http';
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * 通用服务器配置
 */
export type ServerTransportConfig =
  | StdioTransportConfig
  | SseTransportConfig
  | StreamableHttpTransportConfig;
