/**
 * WebSocket 连接管理器
 * 管理单个 WebSocket 连接的生命周期和消息处理
 */

import { WebSocket } from 'ws';
import { EventTypes } from '../../services/event-bus.service.js';
import { logStorage } from '../../services/log-storage.service.js';

// 事件类型映射
const eventTypeMap: Record<string, string> = {
  [EventTypes.SERVER_STATUS_CHANGE]: 'server-status',
  [EventTypes.SERVER_CONNECTED]: 'server-connected',
  [EventTypes.SERVER_DISCONNECTED]: 'server-disconnected',
  [EventTypes.SERVER_ADDED]: 'server-added',
  [EventTypes.SERVER_UPDATED]: 'server-updated',
  [EventTypes.SERVER_DELETED]: 'server-deleted',
  [EventTypes.TOOLS_UPDATED]: 'tools',
  [EventTypes.RESOURCES_UPDATED]: 'resources',
  [EventTypes.LOG_ENTRY]: 'log'
};

// 客户端到服务器的消息类型
export interface SubscribeMessage {
  type: 'subscribe';
  eventTypes: Array<keyof typeof EventTypes>;
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  eventTypes: Array<keyof typeof EventTypes>;
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
  | ErrorMessage;

export class WebSocketHandler {
  private subscriptions = new Set<keyof typeof EventTypes>();
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(
    private socket: WebSocket,
    private eventBus: any // 事件总线实例
  ) {}

  /**
   * 初始化 WebSocket 连接
   */
  initialize(): void {
    this.socket.on('message', this.handleMessage.bind(this));
    this.socket.on('close', this.handleClose.bind(this));
    this.socket.on('error', this.handleError.bind(this));

    // 启动心跳检测
    this.startHeartbeat();

    console.log('WebSocket connection established');
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(data: Buffer | string): void {
    try {
      const message: ClientMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(message);
          break;
        case 'ping':
          this.handlePing(message);
          break;
        case 'fetch-logs':
          this.handleFetchLogs(message);
          break;
        default:
          console.warn('Unknown message type:', (message as any).type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.sendError('Invalid message format');
    }
  }

  /**
   * 处理获取历史日志请求
   */
  private handleFetchLogs(message: FetchLogsMessage): void {
    const logs = logStorage.getLogs(message.serverId, {
      limit: message.limit || 100,
      since: message.since
    });

    this.send({
      type: 'log',
      data: {
        serverId: message.serverId,
        logs: logs
      }
    });
  }

  /**
   * 处理订阅事件
   */
  private handleSubscribe(message: SubscribeMessage): void {
    message.eventTypes.forEach(eventType => {
      if (!this.subscriptions.has(eventType)) {
        this.subscriptions.add(eventType);

        // 订阅事件总线
        const unsubscribe = this.eventBus.subscribe(eventType, (data: any) => {
          const mappedType = eventTypeMap[eventType] as any;
          if (mappedType) {
            this.send({
              type: mappedType,
              data
            });
          }
        });

        // 监听连接关闭时取消订阅
        this.socket.once('close', unsubscribe);
      }
    });

    console.log('Subscribed to events:', Array.from(this.subscriptions));
  }

  /**
   * 处理取消订阅事件
   */
  private handleUnsubscribe(message: UnsubscribeMessage): void {
    message.eventTypes.forEach(eventType => {
      this.subscriptions.delete(eventType);
    });

    console.log('Remaining subscriptions:', Array.from(this.subscriptions));
  }

  /**
   * 处理心跳请求
   */
  private handlePing(_message: PingMessage): void {
    this.send({
      type: 'pong',
      timestamp: Date.now()
    });
  }

  /**
   * 处理连接关闭
   */
  private handleClose(): void {
    console.log('WebSocket connection closed');
    this.stopHeartbeat();
  }

  /**
   * 处理连接错误
   */
  private handleError(error: Event): void {
    console.error('WebSocket error:', error);
  }

  /**
   * 发送消息到客户端
   */
  private send(message: ServerMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /**
   * 发送错误消息
   */
  private sendError(message: string): void {
    this.send({
      type: 'error',
      data: { message }
    } as any);
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({
        type: 'pong',
        timestamp: Date.now()
      });
    }, 30000); // 每30秒发送一次心跳
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
