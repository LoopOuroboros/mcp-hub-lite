/**
 * Log context types and interfaces.
 * This file contains all type definitions for logging context.
 */

export interface LogContext {
  pid?: number;
  serverName?: string;
  module?: string;
  traceId?: string;
  spanId?: string;
}

export type LogOptions = Omit<LogContext, 'pid' | 'serverName'>;
