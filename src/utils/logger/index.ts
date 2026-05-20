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
export {
  isToolsListResponse,
  simplifyToolsListResponse,
  hasImageContent,
  simplifyImageContent,
  formatMcpMessageForLogging,
  isNotificationMessage,
  logNotificationMessage
} from './log-output.js';

// Re-export main Logger class
export { Logger } from './logger.js';

// Create and export the default logger instance
import { Logger } from './logger.js';

export const logger = new Logger();
