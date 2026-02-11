/**
 * WebSocket 客户端工具
 * 管理与后端的 WebSocket 连接和消息处理
 */

import type {
  WebSocketEventType,
  ClientMessage,
  ServerMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  PingMessage,
  FetchLogsMessage,
  ServerStatusEvent,
  LogEvent,
  ToolsEvent,
  ResourcesEvent,
  ServerAddedEvent,
  ServerUpdatedEvent,
  ServerDeletedEvent,
  ServerConnectedEvent,
  ServerDisconnectedEvent,
  PongMessage,
  ToolCallStartedEvent,
  ToolCallCompletedEvent,
  ToolCallErrorEvent,
  ConfigurationUpdatedEvent,
  ClientConnectedEvent,
  ClientDisconnectedEvent,
  ErrorMessage
} from '@shared-types/websocket.types';

// 重新导出类型以保持向后兼容性
export type {
  WebSocketEventType,
  ClientMessage,
  ServerMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  PingMessage,
  FetchLogsMessage,
  ServerStatusEvent,
  LogEvent,
  ToolsEvent,
  ResourcesEvent,
  ServerAddedEvent,
  ServerUpdatedEvent,
  ServerDeletedEvent,
  ServerConnectedEvent,
  ServerDisconnectedEvent,
  PongMessage,
  ToolCallStartedEvent,
  ToolCallCompletedEvent,
  ToolCallErrorEvent,
  ConfigurationUpdatedEvent,
  ClientConnectedEvent,
  ClientDisconnectedEvent,
  ErrorMessage
};

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
