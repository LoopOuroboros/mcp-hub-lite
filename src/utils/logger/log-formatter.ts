/**
 * Log formatting utilities.
 * This file contains all log message formatting logic.
 */

import type { LogLevel } from '@shared-types/common.types.js';
import { stringifyForLogging } from '../json-utils.js';
import type { LogContext } from './log-context.js';
import { getColorCodeForLevel, getResetColor, COLORS } from './log-colors.js';

// PID formatting configuration
const PID_WIDTH = 8;

/**
 * Format a timestamp for logging.
 * @param date - The date to format
 * @returns Formatted timestamp string
 */
export function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * Format a log level for display.
 * @param level - The log level
 * @returns Formatted log level string
 */
export function formatLogLevel(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return 'DBG';
    case 'info':
      return 'INF';
    case 'warn':
      return 'WRN';
    case 'error':
      return 'ERR';
    default:
      return 'UNK';
  }
}

/**
 * Format a PID for display.
 * @param pid - The process ID
 * @returns Formatted PID string
 */
export function formatPid(pid: number): string {
  const pidStr = pid.toString();
  if (pidStr.length > PID_WIDTH) {
    return `PID:${pidStr.substring(0, PID_WIDTH)}`;
  }
  return `PID:${pidStr.padStart(PID_WIDTH, ' ')}`;
}

/**
 * Create a colored log message for console output.
 * @param level - The log level
 * @param message - The log message
 * @param context - Optional log context
 * @returns Colored log message string
 */
export function createColoredLogMessage(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const timestamp = formatTimestamp(new Date());
  const processPid = context?.pid ?? process.pid;
  const formattedLevel = formatLogLevel(level);
  const formattedPid = formatPid(processPid);
  const actualServerName = context?.serverName || 'mcp-hub';

  const timestampColor = COLORS.gray;
  const levelColor = getColorCodeForLevel(level);
  const pidColor = COLORS.cyan;
  const serverColor = COLORS.brightCyan;
  const subModuleColor = COLORS.brightMagenta;
  const traceColor = COLORS.yellow;
  const resetColor = getResetColor();

  let result = `${timestampColor}[${timestamp}]${resetColor} ${levelColor}[${formattedLevel}]${resetColor} ${pidColor}[${formattedPid}]${resetColor}`;

  if (context?.traceId) {
    result += ` ${traceColor}[TID:${context.traceId}]${resetColor}`;
  }

  if (context?.spanId) {
    result += ` ${traceColor}[SID:${context.spanId}]${resetColor}`;
  }

  result += ` ${serverColor}[${actualServerName}]${resetColor}`;

  if (context?.subModule) {
    result += ` ${subModuleColor}[${context.subModule}]${resetColor}`;
  }

  result += ` ${message}`;
  return result;
}

/**
 * Create a plain text log message for file output.
 * @param level - The log level
 * @param message - The log message
 * @param context - Optional log context
 * @returns Plain text log message string
 */
export function createLogMessage(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const timestamp = formatTimestamp(new Date());
  const processPid = context?.pid ?? process.pid;
  const formattedLevel = formatLogLevel(level);
  const pidStr = processPid.toString().padStart(PID_WIDTH, ' ');
  const serverIdentifier = context?.serverName || 'mcp-hub';

  let result = `[${timestamp}] [${formattedLevel}] [PID:${pidStr}]`;

  if (context?.traceId) {
    result += ` [TID:${context.traceId}]`;
  }

  if (context?.spanId) {
    result += ` [SID:${context.spanId}]`;
  }

  result += ` [${serverIdentifier}]`;

  if (context?.subModule) {
    result += ` [${context.subModule}]`;
  }

  result += ` ${message}`;
  return result;
}

/**
 * Format an error object for logging.
 * @param error - The error to format
 * @returns Formatted error string
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    let result = error.message;
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(1, 6);
      if (stackLines.length > 0) {
        result += '\n' + stackLines.join('\n');
      }
    }
    return result;
  }

  if (typeof error === 'object' && error !== null) {
    if ('subModule' in error || 'traceId' in error || 'spanId' in error) {
      return '';
    }

    if (Array.isArray(error) && error.length === 0) {
      return '';
    }

    if (Object.keys(error).length === 0) {
      return '';
    }

    try {
      return stringifyForLogging(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}
