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
  private maxLogsPerServer = 1000; // Configurable maximum number of log entries
  private logListeners = new Map<string, Array<(log: LogEntry) => void>>();

  /**
   * Add log for server
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

    // Limit log entries to prevent memory leaks
    if (logs.length > this.maxLogsPerServer) {
      logs.splice(0, logs.length - this.maxLogsPerServer);
    }

    // Notify listeners
    this.notifyListeners(serverId, logEntry);

    // Publish log event
    eventBus.publish(EventTypes.LOG_ENTRY, {
      serverId,
      logs: [logEntry]
    });

    return logEntry;
  }

  /**
   * Get logs for server
   */
  getLogs(serverId: string, options?: LogQueryOptions): LogEntry[] {
    let logs = this.serverLogs.get(serverId) || [];

    // Filter by level
    if (options?.level) {
      logs = logs.filter((log) => log.level === options.level);
    }

    // Filter by time
    if (options?.since != null) {
      const since = options.since as number;
      logs = logs.filter((log) => log.timestamp >= since);
    }

    // Pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || logs.length;

    return logs.slice(offset, offset + limit);
  }

  /**
   * Clear all logs for server
   */
  clearLogs(serverId: string): void {
    this.serverLogs.set(serverId, []);
  }

  /**
   * Get log count for server
   */
  getLogCount(serverId: string): number {
    return this.serverLogs.get(serverId)?.length || 0;
  }

  /**
   * Set maximum number of log entries per server
   */
  setMaxLogsPerServer(max: number): void {
    this.maxLogsPerServer = max;
    // Trim logs for all servers
    for (const [serverId, logs] of this.serverLogs.entries()) {
      if (logs.length > max) {
        this.serverLogs.set(serverId, logs.slice(-max));
      }
    }
  }

  /**
   * Add log listener
   */
  addLogListener(serverId: string, listener: (log: LogEntry) => void): void {
    if (!this.logListeners.has(serverId)) {
      this.logListeners.set(serverId, []);
    }
    this.logListeners.get(serverId)!.push(listener);
  }

  /**
   * Remove log listener
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
   * Notify listeners
   */
  private notifyListeners(serverId: string, log: LogEntry): void {
    const listeners = this.logListeners.get(serverId);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(log);
        } catch (error) {
          logger.error(`Error in log listener for server ${serverId}:`, error, {
            subModule: serverId
          });
        }
      });
    }
  }

  /**
   * Get all server IDs with logs
   */
  getServersWithLogs(): string[] {
    return Array.from(this.serverLogs.keys());
  }
}

export const logStorage = new LogStorageService();
