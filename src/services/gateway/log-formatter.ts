/**
 * Log formatting utilities for Gateway service.
 */

import { stringifyForLogging, stringifyForLoggingWithReplacer } from '@utils/json-utils.js';

/**
 * Safely formats tool arguments for logging with circular reference handling and size limits.
 *
 * This method provides safe JSON serialization of tool arguments for logging purposes,
 * handling circular references by replacing them with '[Circular Reference]' and
 * truncating large strings and outputs to prevent log noise and performance issues.
 *
 * @param {unknown} args - Tool arguments to format
 * @returns {string} Safe formatted string representation of the arguments
 */
export function formatToolArgs(args: unknown): string {
  try {
    const seen = new WeakSet();
    const replacer = (_key: string, value: unknown): unknown => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      // Limit string length and truncate large objects
      if (typeof value === 'string' && value.length > 500) {
        return value.substring(0, 500) + '... [truncated]';
      }
      return value;
    };

    const formatted = stringifyForLoggingWithReplacer(args, replacer);
    // Limit total output length
    if (formatted.length > 2000) {
      return formatted.substring(0, 2000) + '... [truncated]';
    }
    return formatted;
  } catch (error) {
    return (
      '[Error formatting args: ' + (error instanceof Error ? error.message : String(error)) + ']'
    );
  }
}

/**
 * Safely formats tool responses for logging with size limits.
 *
 * This method provides safe JSON serialization of tool responses for logging purposes,
 * truncating large outputs to prevent log noise and performance issues while maintaining
 * readability through pretty-printed JSON formatting.
 *
 * @param {unknown} response - Tool response to format
 * @returns {string} Safe formatted string representation of the response
 */
export function formatToolResponse(response: unknown): string {
  try {
    const formatted = stringifyForLogging(response);
    // Limit total output length
    if (formatted.length > 2000) {
      return formatted.substring(0, 2000) + '... [truncated]';
    }
    return formatted;
  } catch (error) {
    return (
      '[Error formatting response: ' +
      (error instanceof Error ? error.message : String(error)) +
      ']'
    );
  }
}
