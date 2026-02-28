import { logger, LOG_MODULES } from '@utils/logger.js';
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

/**
 * Service for managing and storing log entries for MCP servers.
 *
 * This service provides centralized log storage with memory-efficient management,
 * real-time event notifications, and query capabilities for debugging and monitoring
 * MCP server activities. It maintains separate log streams for each server identified
 * by their unique server ID and supports configurable log retention limits.
 *
 * Key features:
 * - Memory-efficient log storage with automatic cleanup
 * - Real-time log event publishing via EventBus
 * - Listener registration for immediate log notifications
 * - Queryable log retrieval with filtering and pagination
 * - Configurable maximum log entries per server to prevent memory leaks
 *
 * Usage scenarios:
 * - Debugging MCP server communication issues
 * - Monitoring server activity and status changes
 * - Providing log data for UI log viewers
 * - Supporting audit trails for server operations
 */
export class LogStorageService {
  private serverLogs = new Map<string, LogEntry[]>();
  private maxLogsPerServer = 1000; // Configurable maximum number of log entries
  private logListeners = new Map<string, Array<(log: LogEntry) => void>>();

  /**
   * Appends a new log entry for the specified server.
   *
   * Creates a timestamped log entry with the provided level and message,
   * stores it in memory, and notifies all registered listeners and the
   * global event bus about the new log entry.
   *
   * @param serverId - The unique identifier of the MCP server to log for
   * @param level - The log level (e.g., 'debug', 'info', 'warn', 'error')
   * @param message - The log message content (will be trimmed of whitespace)
   * @returns The created LogEntry object containing timestamp, level, and message
   *
   * @example
   * ```typescript
   * const logEntry = logStorage.append('server-123', 'info', 'Server connected successfully');
   * console.log(logEntry.timestamp); // Current timestamp in milliseconds
   * ```
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
   * Retrieves log entries for the specified server with optional filtering and pagination.
   *
   * Returns a filtered and paginated subset of log entries based on the provided query options.
   * The method supports filtering by log level, timestamp range, and pagination parameters.
   *
   * @param serverId - The unique identifier of the MCP server to retrieve logs for
   * @param options - Optional query parameters for filtering and pagination
   * @param options.level - Filter logs by specific log level (e.g., 'error', 'warn')
   * @param options.since - Filter logs with timestamps greater than or equal to this value (milliseconds since epoch)
   * @param options.offset - Number of log entries to skip (for pagination, default: 0)
   * @param options.limit - Maximum number of log entries to return (default: all matching entries)
   * @returns Array of LogEntry objects matching the query criteria, empty array if no logs exist
   *
   * @example
   * ```typescript
   * // Get last 10 error logs
   * const errorLogs = logStorage.getLogs('server-123', { level: 'error', limit: 10 });
   *
   * // Get logs from the last hour
   * const recentLogs = logStorage.getLogs('server-123', { since: Date.now() - 3600000 });
   *
   * // Get logs with pagination
   * const paginatedLogs = logStorage.getLogs('server-123', { offset: 20, limit: 10 });
   * ```
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
   * Clears all log entries for the specified server.
   *
   * Removes all stored log entries for the given server ID, effectively resetting
   * the log history for that server. This operation is immediate and cannot be undone.
   *
   * @param serverId - The unique identifier of the MCP server to clear logs for
   *
   * @example
   * ```typescript
   * // Clear all logs for a specific server
   * logStorage.clearLogs('server-123');
   * ```
   */
  clearLogs(serverId: string): void {
    this.serverLogs.set(serverId, []);
  }

  /**
   * Gets the total number of log entries stored for the specified server.
   *
   * @param serverId - The unique identifier of the MCP server to get log count for
   * @returns The number of log entries stored for the server, or 0 if no logs exist
   *
   * @example
   * ```typescript
   * const logCount = logStorage.getLogCount('server-123');
   * console.log(`Server has ${logCount} log entries`);
   * ```
   */
  getLogCount(serverId: string): number {
    return this.serverLogs.get(serverId)?.length || 0;
  }

  /**
   * Sets the maximum number of log entries to store per server.
   *
   * Configures the memory limit for log storage and immediately trims existing logs
   * for all servers that exceed the new limit. This helps prevent memory leaks in
   * long-running applications with high log volume.
   *
   * @param max - The maximum number of log entries to store per server (must be positive)
   *
   * @example
   * ```typescript
   * // Limit logs to 500 entries per server
   * logStorage.setMaxLogsPerServer(500);
   * ```
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
   * Adds a listener function that will be called whenever a new log entry is appended for the specified server.
   *
   * Listeners are called synchronously when new logs are added and should handle errors gracefully
   * as exceptions are caught and logged but will not prevent other listeners from being called.
   *
   * @param serverId - The unique identifier of the MCP server to listen for logs
   * @param listener - Function to be called with each new LogEntry for the server
   *
   * @example
   * ```typescript
   * const listener = (log: LogEntry) => {
   *   console.log(`New log for server: ${log.message}`);
   * };
   * logStorage.addLogListener('server-123', listener);
   * ```
   */
  addLogListener(serverId: string, listener: (log: LogEntry) => void): void {
    if (!this.logListeners.has(serverId)) {
      this.logListeners.set(serverId, []);
    }
    this.logListeners.get(serverId)!.push(listener);
  }

  /**
   * Removes a previously registered log listener for the specified server.
   *
   * @param serverId - The unique identifier of the MCP server to remove the listener from
   * @param listener - The listener function to remove (must be the exact same function reference)
   *
   * @example
   * ```typescript
   * // Remove the listener
   * logStorage.removeLogListener('server-123', listener);
   * ```
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
          logger.error(`Error in log listener for server ${serverId}:`, error, LOG_MODULES.dynamic(serverId));
        }
      });
    }
  }

  /**
   * Gets an array of all server IDs that currently have stored log entries.
   *
   * @returns Array of server ID strings that have logs, empty array if no servers have logs
   *
   * @example
   * ```typescript
   * const serverIds = logStorage.getServersWithLogs();
   * console.log(`Servers with logs: ${serverIds.join(', ')}`);
   * ```
   */
  getServersWithLogs(): string[] {
    return Array.from(this.serverLogs.keys());
  }
}

export const logStorage = new LogStorageService();
