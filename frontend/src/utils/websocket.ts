/**
 * WebSocket client utility
 * Manages WebSocket connection and message handling with backend
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

// Re-export types for backward compatibility
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
  private pendingMessages: ClientMessage[] = [];

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
      this.flushPendingMessages();
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
    } else {
      this.pendingMessages.push(message);
    }
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0) {
      const msg = this.pendingMessages.shift()!;
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
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

// Create global WebSocket client instance
export function createWebSocketClient(url: string): WebSocketClient {
  return new WebSocketClient(url);
}
