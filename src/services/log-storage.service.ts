import { logger } from '@utils/logger.js';
import { eventBus, EventTypes } from '@services/event-bus.service.js';
import type { LogLevel } from '@shared-types/common.types.js';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
}

export interface LogQueryOptions {
  level?: LogLevel;
  limit?: number;
  offset?: number;
  since?: number;
}

export class LogStorageService {
  private serverLogs = new Map<string, LogEntry[]>();
  private maxLogsPerServer = 1000; // 可配置的最大日志条数
  private logListeners = new Map<string, Array<(log: LogEntry) => void>>();

  /**
   * 为服务器添加日志
   */
  append(serverId: string, level: LogLevel, message: string): LogEntry {
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      message: message.trim()
    };

    if (!this.serverLogs.has(serverId)) {
      this.serverLogs.set(serverId, []);
    }

    const logs = this.serverLogs.get(serverId)!;
    logs.push(logEntry);

    // 限制日志条数，防止内存泄漏
    if (logs.length > this.maxLogsPerServer) {
      logs.splice(0, logs.length - this.maxLogsPerServer);
    }

    // 通知监听者
    this.notifyListeners(serverId, logEntry);

    // 发布日志事件
    eventBus.publish(EventTypes.LOG_ENTRY, {
      serverId,
      logs: [logEntry]
    });

    return logEntry;
  }

  /**
   * 获取服务器的日志
   */
  getLogs(serverId: string, options?: LogQueryOptions): LogEntry[] {
    let logs = this.serverLogs.get(serverId) || [];

    // 按级别过滤
    if (options?.level) {
      logs = logs.filter(log => log.level === options.level);
    }

    // 按时间过滤
    if (options?.since != null) {
      const since = options.since as number;
      logs = logs.filter(log => log.timestamp >= since);
    }

    // 分页
    const offset = options?.offset || 0;
    const limit = options?.limit || logs.length;

    return logs.slice(offset, offset + limit);
  }

  /**
   * 清除服务器的所有日志
   */
  clearLogs(serverId: string): void {
    this.serverLogs.set(serverId, []);
  }

  /**
   * 获取服务器的日志条数
   */
  getLogCount(serverId: string): number {
    return this.serverLogs.get(serverId)?.length || 0;
  }

  /**
   * 设置每个服务器的最大日志条数
   */
  setMaxLogsPerServer(max: number): void {
    this.maxLogsPerServer = max;
    // 修剪所有服务器的日志
    for (const [serverId, logs] of this.serverLogs.entries()) {
      if (logs.length > max) {
        this.serverLogs.set(serverId, logs.slice(-max));
      }
    }
  }

  /**
   * 添加日志监听器
   */
  addLogListener(serverId: string, listener: (log: LogEntry) => void): void {
    if (!this.logListeners.has(serverId)) {
      this.logListeners.set(serverId, []);
    }
    this.logListeners.get(serverId)!.push(listener);
  }

  /**
   * 移除日志监听器
   */
  removeLogListener(serverId: string, listener: (log: LogEntry) => void): void {
    const listeners = this.logListeners.get(serverId);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 通知监听器
   */
  private notifyListeners(serverId: string, log: LogEntry): void {
    const listeners = this.logListeners.get(serverId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(log);
        } catch (error) {
          logger.error(`Error in log listener for server ${serverId}:`, error, { subModule: serverId });
        }
      });
    }
  }

  /**
   * 获取所有有日志的服务器ID
   */
  getServersWithLogs(): string[] {
    return Array.from(this.serverLogs.keys());
  }
}

export const logStorage = new LogStorageService();
