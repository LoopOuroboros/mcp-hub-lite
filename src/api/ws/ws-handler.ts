/**
 * WebSocket 连接管理器
 * 管理单个 WebSocket 连接的生命周期和消息处理
 */

import { WebSocket } from 'ws';
import { EventTypes } from '@services/event-bus.service.js';
import { logStorage } from '@services/log-storage.service.js';
import { logger } from '@utils/logger.js';
import { WEB_SOCKET_EVENT_TYPES } from '@shared-types/websocket.types';
import type {
  ClientMessage,
  ServerMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  PingMessage,
  FetchLogsMessage
} from '@shared-types/websocket.types';

// 事件类型映射
const eventTypeMap: Record<string, string> = {
  [EventTypes.SERVER_STATUS_CHANGE]: WEB_SOCKET_EVENT_TYPES.SERVER_STATUS,
  [EventTypes.SERVER_CONNECTED]: WEB_SOCKET_EVENT_TYPES.SERVER_CONNECTED,
  [EventTypes.SERVER_DISCONNECTED]: WEB_SOCKET_EVENT_TYPES.SERVER_DISCONNECTED,
  [EventTypes.SERVER_ADDED]: WEB_SOCKET_EVENT_TYPES.SERVER_ADDED,
  [EventTypes.SERVER_UPDATED]: WEB_SOCKET_EVENT_TYPES.SERVER_UPDATED,
  [EventTypes.SERVER_DELETED]: WEB_SOCKET_EVENT_TYPES.SERVER_DELETED,
  [EventTypes.TOOLS_UPDATED]: WEB_SOCKET_EVENT_TYPES.TOOLS,
  [EventTypes.RESOURCES_UPDATED]: WEB_SOCKET_EVENT_TYPES.RESOURCES,
  [EventTypes.LOG_ENTRY]: WEB_SOCKET_EVENT_TYPES.LOG,
  [EventTypes.TOOL_CALL_STARTED]: WEB_SOCKET_EVENT_TYPES.TOOL_CALL_STARTED,
  [EventTypes.TOOL_CALL_COMPLETED]: WEB_SOCKET_EVENT_TYPES.TOOL_CALL_COMPLETED,
  [EventTypes.TOOL_CALL_ERROR]: WEB_SOCKET_EVENT_TYPES.TOOL_CALL_ERROR,
  [EventTypes.CONFIGURATION_UPDATED]: WEB_SOCKET_EVENT_TYPES.CONFIGURATION_UPDATED,
  [EventTypes.CLIENT_CONNECTED]: WEB_SOCKET_EVENT_TYPES.CLIENT_CONNECTED,
  [EventTypes.CLIENT_DISCONNECTED]: WEB_SOCKET_EVENT_TYPES.CLIENT_DISCONNECTED
};

export class WebSocketHandler {
  private subscriptions = new Map<keyof typeof EventTypes, () => void>(); // 存储订阅和对应的取消函数
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

    logger.info('connection established', { subModule: 'WebSocket' });
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
          logger.warn(`Unknown message type: ${(message as any).type}`, { subModule: 'WebSocket' });
      }
    } catch (error) {
      logger.error(`Failed to parse WebSocket message: ${error}`, { subModule: 'WebSocket' });
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
    } as ServerMessage);
  }

  /**
   * 处理订阅事件
   */
  private handleSubscribe(message: SubscribeMessage): void {
    message.eventTypes.forEach(eventType => {
      // 将 WebSocket 事件类型映射到内部事件类型
      const internalEventType = Object.entries(eventTypeMap).find(
        ([, wsType]) => wsType === eventType
      )?.[0] as keyof typeof EventTypes;

      if (internalEventType && !this.subscriptions.has(internalEventType)) {
        // 订阅事件总线
        const unsubscribe = this.eventBus.subscribe(internalEventType, (data: any) => {
          const mappedType = eventTypeMap[internalEventType] as any;
          if (mappedType) {
            this.send({
              type: mappedType,
              data
            } as ServerMessage);
          }
        });

        this.subscriptions.set(internalEventType, unsubscribe);
      }
    });

    logger.info(`Subscribed to events: ${Array.from(this.subscriptions.keys()).sort().join(', ')}`, { subModule: 'WebSocket' });
  }

  /**
   * 处理取消订阅事件
   */
  private handleUnsubscribe(message: UnsubscribeMessage): void {
    message.eventTypes.forEach(eventType => {
      // 将 WebSocket 事件类型映射到内部事件类型
      const internalEventType = Object.entries(eventTypeMap).find(
        ([, wsType]) => wsType === eventType
      )?.[0] as keyof typeof EventTypes;

      if (internalEventType) {
        const unsubscribe = this.subscriptions.get(internalEventType);
        if (unsubscribe) {
          unsubscribe(); // 调用取消订阅函数
          this.subscriptions.delete(internalEventType);
        }
      }
    });

    logger.info(`Remaining subscriptions: ${Array.from(this.subscriptions.keys()).sort().join(', ')}`, { subModule: 'WebSocket' });
  }

  /**
   * 处理连接关闭
   */
  private handleClose(): void {
    logger.info('connection closed', { subModule: 'WebSocket' });
    this.stopHeartbeat();

    // 取消所有订阅
    this.subscriptions.forEach(unsubscribe => {
      unsubscribe();
    });
    this.subscriptions.clear();
  }

  /**
   * 处理心跳请求
   */
  private handlePing(_message: PingMessage): void {
    this.send({
      type: 'pong',
      timestamp: Date.now()
    } as ServerMessage);
  }

  /**
   * 处理连接错误
   */
  private handleError(error: Error): void {
    logger.error(`error: ${error}`, { subModule: 'WebSocket' });
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
    } as ServerMessage);
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({
        type: 'pong',
        timestamp: Date.now()
      } as ServerMessage);
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
