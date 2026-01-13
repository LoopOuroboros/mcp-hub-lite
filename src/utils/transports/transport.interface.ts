import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * 通用传输接口
 * 所有传输类型都必须实现此接口
 */
export interface Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  start(): Promise<void>;
  close(): Promise<void>;
  send(message: JSONRPCMessage): Promise<void>;
}

/**
 * STDIO 传输配置
 */
export interface StdioTransportConfig {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  stderr?: "inherit" | "pipe" | "ignore";
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
 * HTTP 传输配置
 */
export interface HttpTransportConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * 通用服务器配置
 */
export type ServerTransportConfig = StdioTransportConfig | SseTransportConfig | HttpTransportConfig;