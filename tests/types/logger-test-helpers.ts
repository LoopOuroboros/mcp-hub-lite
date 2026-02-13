/**
 * Logger test helper types for accessing private methods in tests
 */

import type { LogLevel } from '@shared-types/common.types.js';
import type { LogContext } from '@utils/logger.js';
import type { WriteStream } from 'node:fs';

// Logger with private methods exposed for testing
export interface LoggerWithPrivateMethods {
  shouldLog: (level: string) => boolean;
  formatTimestamp: (date: Date) => string;
  formatLogLevel: (level: LogLevel) => string;
  formatPid: (pid: number) => string;
  createColoredLogMessage: (level: LogLevel, message: string, context?: LogContext) => string;
  createLogMessage: (level: LogLevel, message: string, context?: LogContext) => string;
  formatError: (error: unknown) => string;
  logFileStream: WriteStream | null;
}