import type { ServerStatus, ServerTransport, ServerType, LogLevel } from '@shared/types';
import type { Tool } from './tool.model';
import type { Resource } from './resource.model';

export type { ServerStatus, ServerTransport, ServerType, LogLevel };

// 服务器配置接口
export interface McpServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  timeout?: number;
  enabled?: boolean;
  allowedTools?: string[];
  type: ServerTransport;
  tags?: Record<string, string>;
  description?: string;
}

// 服务器实例配置接口
export interface ServerInstanceConfig {
  id: string;
  timestamp: number;
  hash: string;
}

// 日志条目接口
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
}

// 服务器状态信息接口
export interface McpStatus {
  id: string;
  status: {
    connected: boolean;
    error?: string;
    lastCheck: number;
    toolsCount: number;
    resourcesCount: number;
    pid?: number;
    startTime?: number;
    version?: string;
  };
}

// 统一的服务器模型接口
export interface Server {
  id: string;
  name: string;
  status: ServerStatus;
  type: ServerType;
  config: McpServerConfig;
  instance: ServerInstanceConfig;
  logs: LogEntry[];
  uptime?: string;
  startTime?: number;
  pid?: number;
  tools?: Tool[];
  resources?: Resource[];
  toolsCount?: number;
  resourcesCount?: number;
  version?: string;
}
