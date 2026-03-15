/**
 * ANSI color codes for logging.
 * This file contains all color-related constants and helpers.
 */

import type { LogLevel } from '@shared-types/common.types.js';

// ANSI color codes
export const COLORS = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  brightCyan: '\x1b[96m',
  brightMagenta: '\x1b[95m'
} as const;

/**
 * Get color code for a specific log level.
 * @param level - The log level
 * @returns ANSI color code string
 */
export function getColorCodeForLevel(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return COLORS.cyan;
    case 'info':
      return COLORS.green;
    case 'warn':
      return COLORS.yellow;
    case 'error':
      return COLORS.red;
    default:
      return COLORS.reset;
  }
}

/**
 * Get reset color code.
 * @returns ANSI reset color code
 */
export function getResetColor(): string {
  return COLORS.reset;
}
