/**
 * WebSocket 事件类型定义
 * 前后端共享的 WebSocket 协议类型定义
 */

import type { Tool } from '@shared-models/tool.model';
import type { Resource } from '@shared-models/resource.model';
import type { LogLevel } from '@shared-types/common.types';

// WebSocket 事件类型常量
export const WEB_SOCKET_EVENT_TYPES = {
  SERVER_STATUS: 'server-status',
  LOG: 'log',
  TOOLS: 'tools',
  RESOURCES: 'resources',
  SERVER_ADDED: 'server-added',
  SERVER_UPDATED: 'server-updated',
  SERVER_DELETED: 'server-deleted',
  SERVER_CONNECTED: 'server-connected',
  SERVER_DISCONNECTED: 'server-disconnected',
  TOOL_CALL_STARTED: 'tool-call-started',
  TOOL_CALL_COMPLETED: 'tool-call-completed',
  TOOL_CALL_ERROR: 'tool-call-error',
  CONFIGURATION_UPDATED: 'configuration-updated',
  CLIENT_CONNECTED: 'client-connected',
  CLIENT_DISCONNECTED: 'client-disconnected',
  PONG: 'pong'
} as const;

// 有效事件类型数组
export const VALID_WS_EVENT_TYPES = Object.values(WEB_SOCKET_EVENT_TYPES);

// 导出类型定义
export type WebSocketEventType = (typeof VALID_WS_EVENT_TYPES)[number];

// ============================================================================
// 客户端到服务器的消息类型
// ============================================================================

export interface SubscribeMessage {
  type: 'subscribe';
  eventTypes: WebSocketEventType[];
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  eventTypes: WebSocketEventType[];
}

export interface PingMessage {
  type: 'ping';
  timestamp: number;
}

export interface FetchLogsMessage {
  type: 'fetch-logs';
  serverId: string;
  limit?: number; // 可选：返回最新的 N 条日志
  since?: number; // 可选：返回指定时间后的日志
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage | FetchLogsMessage;

// ============================================================================
// 服务器到客户端的消息类型
// ============================================================================

export interface ServerStatusEvent {
  type: 'server-status';
  data: {
    serverId: string;
    status: 'online' | 'offline' | 'error';
    error?: string;
    timestamp: number;
  };
}

export interface LogEvent {
  type: 'log';
  data: {
    serverId: string;
    logs: Array<{
      level: LogLevel;
      message: string;
      timestamp: number;
    }>;
  };
}

export interface ToolsEvent {
  type: 'tools';
  data: {
    serverId: string;
    tools: Tool[];
  };
}

export interface ResourcesEvent {
  type: 'resources';
  data: {
    serverId: string;
    resources: Resource[];
  };
}

export interface ServerAddedEvent {
  type: 'server-added';
  data: unknown;
}

export interface ServerUpdatedEvent {
  type: 'server-updated';
  data: unknown;
}

export interface ServerDeletedEvent {
  type: 'server-deleted';
  data: string;
}

export interface ServerConnectedEvent {
  type: 'server-connected';
  data: {
    serverId: string;
    status: 'online';
    timestamp: number;
  };
}

export interface ServerDisconnectedEvent {
  type: 'server-disconnected';
  data: {
    serverId: string;
    status: 'offline';
    timestamp: number;
  };
}

export interface PongMessage {
  type: 'pong';
  timestamp: number;
}

export interface ToolCallStartedEvent {
  type: 'tool-call-started';
  data: {
    requestId: string;
    serverId: string;
    serverName: string;
    toolName: string;
    timestamp: number;
    args: Record<string, unknown>;
  };
}

export interface ToolCallCompletedEvent {
  type: 'tool-call-completed';
  data: {
    requestId: string;
    serverId: string;
    serverName: string;
    toolName: string;
    timestamp: number;
    result: unknown;
  };
}

export interface ToolCallErrorEvent {
  type: 'tool-call-error';
  data: {
    requestId: string;
    serverId: string;
    serverName: string;
    toolName: string;
    timestamp: number;
    error: string;
    stack?: string;
  };
}

export interface ConfigurationUpdatedEvent {
  type: 'configuration-updated';
  data: {
    timestamp: number;
    config: unknown;
    changes?: unknown;
  };
}

export interface ClientConnectedEvent {
  type: 'client-connected';
  data: {
    timestamp: number;
    client: unknown;
  };
}

export interface ClientDisconnectedEvent {
  type: 'client-disconnected';
  data: {
    timestamp: number;
    clientId: string;
    client?: unknown;
  };
}

export interface ErrorMessage {
  type: 'error';
  data: {
    message: string;
  };
}

export type ServerMessage =
  | ServerStatusEvent
  | LogEvent
  | ToolsEvent
  | ResourcesEvent
  | ServerAddedEvent
  | ServerUpdatedEvent
  | ServerDeletedEvent
  | ServerConnectedEvent
  | ServerDisconnectedEvent
  | PongMessage
  | ToolCallStartedEvent
  | ToolCallCompletedEvent
  | ToolCallErrorEvent
  | ConfigurationUpdatedEvent
  | ClientConnectedEvent
  | ClientDisconnectedEvent
  | ErrorMessage;
