/**
 * Logger module exports.
 * This file provides backward-compatible exports for the refactored logger module.
 */

// Re-export types
export type { LogContext, LogOptions } from './log-context.js';

// Re-export log module constants
export { LOG_MODULES } from './log-modules.js';
export type { LogModuleKey, LogModule } from './log-modules.js';

// Re-export color utilities
export { COLORS, getColorCodeForLevel, getResetColor } from './log-colors.js';

// Re-export formatter utilities
export {
  formatTimestamp,
  formatLogLevel,
  formatPid,
  createColoredLogMessage,
  createLogMessage,
  formatError
} from './log-formatter.js';

// Re-export output utilities
export { isToolsListResponse, simplifyToolsListResponse } from './log-output.js';

// Re-export main Logger class
export { Logger } from './logger.js';

// Create and export the default logger instance
import { Logger } from './logger.js';
import { createColoredLogMessage, createLogMessage } from './log-formatter.js';
import type { LogContext } from './log-context.js';

export const logger = new Logger();

/**
 * Log a message with color formatting for console and plain text for file output.
 *
 * This function provides a convenient way to log messages that appear with
 * ANSI color codes in the console but are written as plain text to log files.
 * It uses the logger's internal formatting methods to ensure consistent output.
 *
 * @param coloredMessage - The message to display in the console with color formatting
 * @param plainMessage - The message to write to log files in plain text format
 * @param context - Optional logging context including PID, server name, trace ID, etc.
 *
 * @example
 * ```typescript
 * logWithColor(
 *   '\x1b[32m[SUCCESS]\x1b[0m Server started',
 *   '[SUCCESS] Server started',
 *   { serverName: 'mcp-hub', pid: process.pid }
 * );
 * ```
 */
export function logWithColor(
  coloredMessage: string,
  plainMessage: string,
  context?: LogContext
): void {
  const coloredLogMsg = createColoredLogMessage('info', coloredMessage, context);
  console.info(coloredLogMsg);

  if (logger.logFileStream) {
    const plainLogMsg = createLogMessage('info', plainMessage, context);
    (logger.logFileStream as { write: (data: string) => void }).write(plainLogMsg + '\n');
  }
}
