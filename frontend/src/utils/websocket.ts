/**
 * WebSocket 客户端工具
 * 管理与后端的 WebSocket 连接和消息处理
 */

// 客户端到服务器的消息类型
import type { WebSocketEventType } from '@shared/types/websocket.types'

export interface SubscribeMessage {
  type: 'subscribe';
  eventTypes: WebSocketEventType[];
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  eventTypes: Array<string>;
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

// 服务器到客户端的消息类型
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
      level: 'info' | 'warn' | 'error' | 'debug';
      message: string;
      timestamp: number;
    }>;
  };
}

export interface ToolsEvent {
  type: 'tools';
  data: {
    serverId: string;
    tools: any[];
  };
}

export interface ResourcesEvent {
  type: 'resources';
  data: {
    serverId: string;
    resources: any[];
  };
}

export interface ServerAddedEvent {
  type: 'server-added';
  data: any;
}

export interface ServerUpdatedEvent {
  type: 'server-updated';
  data: any;
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
    result: any;
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
    config: any;
    changes?: any;
  };
}

export interface ClientConnectedEvent {
  type: 'client-connected';
  data: {
    timestamp: number;
    client: any;
  };
}

export interface ClientDisconnectedEvent {
  type: 'client-disconnected';
  data: {
    timestamp: number;
    clientId: string;
    client?: any;
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

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval?: number;

  constructor(private url: string) {}

  connect(
    onMessage: (message: ServerMessage) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onError?: (error: Event) => void
  ): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      onOpen?.();
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      onMessage(message);
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      onClose?.();
      this.attemptReconnect(onMessage, onOpen, onClose, onError);
    };

    this.ws.onerror = (error) => {
      onError?.(error);
    };
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private attemptReconnect(
    onMessage: (message: ServerMessage) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onError?: (error: Event) => void
  ): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect(onMessage, onOpen, onClose, onError);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      this.send({ type: 'ping', timestamp: Date.now() });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      window.clearInterval(this.heartbeatInterval);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.ws?.close();
  }
}

// 创建全局 WebSocket 客户端实例
export function createWebSocketClient(url: string): WebSocketClient {
  return new WebSocketClient(url);
}
