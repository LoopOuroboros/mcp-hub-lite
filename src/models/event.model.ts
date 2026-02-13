/**
 * 事件数据模型
 * 包含所有事件总线使用的数据接口定义
 */

import type { ServerConfig, ServerInstanceConfig } from '@config/config.schema.js';
import type { Tool } from '@shared-models/tool.model.js';
import type { Resource } from '@shared-models/resource.model.js';
import type { LogLevel } from '@shared-types/common.types.js';

// 服务器相关事件数据
export interface ServerAddedEventData {
  name: string;
  config: ServerConfig;
}

export interface ServerUpdatedEventData {
  name: string;
  config: ServerConfig;
}

// ServerDeletedEventData is just a string (server name)
export type ServerDeletedEventData = string;

export interface ServerInstanceAddedEventData {
  name: string;
  instance: ServerInstanceConfig;
}

export interface ServerInstanceUpdatedEventData {
  name: string;
  index: number;
  updates: Partial<ServerInstanceConfig>;
}

export interface ServerInstanceDeletedEventData {
  name: string;
  index: number;
}

// 连接状态事件数据
export interface ServerConnectedEventData {
  serverId: string;
  status: 'online';
  timestamp: number;
}

export interface ServerDisconnectedEventData {
  serverId: string;
  status: 'offline';
  timestamp: number;
}

export interface ServerStatusChangeEventData {
  serverId: string;
  status: 'online' | 'offline' | 'error';
  error?: string;
  timestamp: number;
}

// 工具相关事件数据
export interface ToolsUpdatedEventData {
  serverId: string;
  tools: Tool[];
}

export interface ToolCallStartedEventData {
  requestId: string;
  serverId: string;
  serverName: string;
  toolName: string;
  timestamp: number;
  args: Record<string, unknown>;
}

export interface ToolCallCompletedEventData {
  requestId: string;
  serverId: string;
  serverName: string;
  toolName: string;
  timestamp: number;
  result: unknown;
}

export interface ToolCallErrorEventData {
  requestId: string;
  serverId: string;
  serverName: string;
  toolName: string;
  timestamp: number;
  error: string;
  stack?: string;
}

// 资源相关事件数据
export interface ResourcesUpdatedEventData {
  serverId: string;
  resources: Resource[];
}

// 日志相关事件数据
export interface LogEntryEventData {
  serverId: string;
  logs: Array<{
    level: LogLevel;
    message: string;
    timestamp: number;
  }>;
}

export interface LogsClearedEventData {
  serverId: string;
}

// 系统相关事件数据
export interface ConfigurationUpdatedEventData {
  timestamp: number;
  config: unknown;
  changes?: unknown;
}

// 客户端相关事件数据
export interface ClientConnectedEventData {
  timestamp: number;
  client: unknown;
}

export interface ClientDisconnectedEventData {
  timestamp: number;
  clientId: string;
  client?: unknown;
}

// 事件数据类型的联合类型
// 使用 unknown 作为基础类型以保持向后兼容性
export type EventData = unknown;