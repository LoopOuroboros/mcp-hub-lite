/**
 * 事件总线服务
 * 用于在整个应用程序中发布和订阅事件
 * 支持服务器状态变化、日志更新、工具更新等事件的传播
 */

import type { EventData } from '@models/event.model.js';

export interface EventBusEvent {
  type: string;
  data: EventData;
}

export class EventBusService {
  private listeners = new Map<string, Set<(data: EventData) => void>>();

  /**
   * 发布事件
   * @param eventType 事件类型
   * @param data 事件数据
   */
  publish(eventType: string, data: EventData): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for type ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * 订阅事件
   * @param eventType 事件类型
   * @param listener 事件监听器
   * @returns 取消订阅函数
   */
  subscribe(eventType: string, listener: (data: EventData) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // 返回取消订阅函数
    return () => this.unsubscribe(eventType, listener);
  }

  /**
   * 取消订阅事件
   * @param eventType 事件类型
   * @param listener 事件监听器
   */
  private unsubscribe(eventType: string, listener: (data: EventData) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
      // 如果该事件类型的监听器为空，删除该事件类型的条目
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  /**
   * 取消所有事件的订阅
   */
  unsubscribeAll(): void {
    this.listeners.clear();
  }

  /**
   * 获取所有已注册的事件类型
   */
  getEventTypes(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * 获取指定事件类型的监听器数量
   * @param eventType 事件类型
   */
  getListenerCount(eventType: string): number {
    const listeners = this.listeners.get(eventType);
    return listeners ? listeners.size : 0;
  }
}

// 事件类型常量
export const EventTypes = {
  // 服务器状态相关事件
  SERVER_STATUS_CHANGE: 'server-status',
  SERVER_CONNECTED: 'server-connected',
  SERVER_DISCONNECTED: 'server-disconnected',

  // 服务器管理事件
  SERVER_ADDED: 'server-added',
  SERVER_UPDATED: 'server-updated',
  SERVER_DELETED: 'server-deleted',
  SERVER_INSTANCE_ADDED: 'server-instance-added',
  SERVER_INSTANCE_UPDATED: 'server-instance-updated',
  SERVER_INSTANCE_DELETED: 'server-instance-deleted',

  // 工具相关事件
  TOOLS_UPDATED: 'tools',
  TOOL_CALL_STARTED: 'tool-call-started',
  TOOL_CALL_COMPLETED: 'tool-call-completed',
  TOOL_CALL_ERROR: 'tool-call-error',

  // 资源相关事件
  RESOURCES_UPDATED: 'resources',

  // 日志相关事件
  LOG_ENTRY: 'log',
  LOGS_CLEARED: 'logs-cleared',

  // 系统相关事件
  SYSTEM_HEALTH: 'system-health',
  CONFIGURATION_UPDATED: 'configuration-updated',

  // 客户端相关事件
  CLIENT_CONNECTED: 'client-connected',
  CLIENT_DISCONNECTED: 'client-disconnected'
} as const;

// 创建全局事件总线实例
export const eventBus = new EventBusService();
