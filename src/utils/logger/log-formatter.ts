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
 * Caller information extracted from stack trace.
 */
export interface CallerInfo {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}

/**
 * Check if we're running via tsx (development mode).
 * In tsx mode, stack traces already show TypeScript file names and line numbers.
 *
 * @returns true if running via tsx
 */
function isTsxMode(): boolean {
  return (
    process.argv.some((arg) => arg.includes('tsx')) ||
    process.execArgv.some((arg) => arg.includes('tsx')) ||
    !!process.env.TSX ||
    (process.mainModule?.filename.includes('tsx') ?? false)
  );
}

/**
 * Check if a file path is a project source file.
 *
 * @param filePath - The file path to check
 * @returns true if the file is within the project's src directory
 */
function isProjectSourceFile(filePath: string): boolean {
  return filePath.includes('/src/') || filePath.includes('\\src\\');
}

/**
 * Clean up a file path to make it more readable.
 * Extracts the relative path from the src directory if present.
 * In tsx mode, keeps the .ts extension; in compiled mode, converts .js to .ts.
 *
 * @param filePath - The full file path to clean
 * @returns Cleaned file path
 */
function cleanFilePath(filePath: string): string {
  let cleanFileName = filePath;

  // If it's a full path, try to extract just the file name or relative path
  if (cleanFileName.includes('/')) {
    // Extract everything after the last /src/ if present
    const srcIndex = cleanFileName.lastIndexOf('/src/');
    if (srcIndex !== -1) {
      cleanFileName = 'src' + cleanFileName.substring(srcIndex + 4);
    } else {
      // Otherwise just take the base name
      cleanFileName = cleanFileName.substring(cleanFileName.lastIndexOf('/') + 1);
    }
  } else if (cleanFileName.includes('\\')) {
    // Handle Windows paths
    const srcIndex = cleanFileName.lastIndexOf('\\src\\');
    if (srcIndex !== -1) {
      cleanFileName = 'src' + cleanFileName.substring(srcIndex + 4);
    } else {
      cleanFileName = cleanFileName.substring(cleanFileName.lastIndexOf('\\') + 1);
    }
  }

  // In non-tsx mode (compiled JS), convert .js to .ts for TypeScript source files
  if (!isTsxMode() && cleanFileName.endsWith('.js')) {
    // Check if there's likely a .ts source file
    // For our project, all .js files in src/ are compiled from .ts
    if (cleanFileName.startsWith('src/') || cleanFileName.startsWith('src\\')) {
      cleanFileName = cleanFileName.replace(/\.js$/, '.ts');
    }
  }

  return cleanFileName;
}

/**
 * Get caller information from stack trace.
 * Extracts the file name, line number, and column number from the call stack.
 * This method traverses the stack to find the first project source file (in src/),
 * skipping external dependencies and Node.js internals.
 *
 * In tsx (development) mode: Parses default stack string for accurate .ts line numbers
 * In production mode: Shows .ts file names but without line numbers (inaccurate)
 *
 * @param skipFrames - Number of stack frames to skip before starting the search (default: 3 to skip logger internal frames)
 * @returns CallerInfo with fileName, lineNumber, columnNumber or null if cannot be determined
 */
export function getCallerInfo(skipFrames = 3): CallerInfo | null {
  // In tsx mode, parse the default stack string for accurate line numbers
  if (isTsxMode()) {
    return getCallerInfoFromStackString(skipFrames);
  }

  // In production mode, use structured stack frames but without line numbers
  return getCallerInfoFromStructuredStack(skipFrames);
}

/**
 * Parse caller information from default stack string (for tsx mode).
 * In tsx mode, the default stack string already contains accurate TypeScript
 * file names and line numbers, so we parse it directly.
 *
 * @param skipFrames - Number of stack frames to skip
 * @returns CallerInfo or null if cannot be determined
 */
function getCallerInfoFromStackString(skipFrames: number): CallerInfo | null {
  const err = new Error();
  const stackStr = err.stack;

  if (!stackStr) return null;

  const lines = stackStr.split('\n').slice(1); // Skip first line ("Error")

  // Find the first project source file in the stack
  for (let i = skipFrames; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Match patterns like:
    // at ... (file:///D:/path/src/file.ts:123:45)
    // at ... (D:\path\src\file.ts:123:45)
    // at file:///D:/path/src/file.ts:123:45
    const match = line.match(/(?:\(|at\s+)([^:\s]+\/src\/[^:\s\)]+|\S+\\src\\[^:\s\)]+):(\d+)(?::(\d+))?/);

    if (match) {
      let filePath = match[1];
      const lineNumber = parseInt(match[2], 10) || 0;
      const columnNumber = match[3] ? parseInt(match[3], 10) : 0;

      // Remove file:// prefix if present
      if (filePath.startsWith('file://')) {
        filePath = filePath.replace('file://', '');
        // On Windows, file:///D:/path becomes /D:/path - fix that
        if (filePath.startsWith('/') && filePath.length > 2 && filePath[2] === ':') {
          filePath = filePath.substring(1);
        }
      }

      const cleanFileName = cleanFilePath(filePath);
      return {
        fileName: cleanFileName,
        lineNumber,
        columnNumber
      };
    }
  }

  return null;
}

/**
 * Get caller information from structured stack frames (for production mode).
 * In production mode, we show the .ts file name but without line numbers
 * since they would be inaccurate.
 *
 * @param skipFrames - Number of stack frames to skip
 * @returns CallerInfo or null if cannot be determined
 */
function getCallerInfoFromStructuredStack(skipFrames: number): CallerInfo | null {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  let callerInfo: CallerInfo | null = null;

  try {
    // Override prepareStackTrace to get structured stack frames
    Error.prepareStackTrace = (_err, stack) => stack;

    const err = new Error();
    const stack = err.stack as unknown as NodeJS.CallSite[];

    if (stack && stack.length > skipFrames) {
      let selectedFrame: NodeJS.CallSite | null = null;

      // Traverse stack frames starting from skipFrames
      // Look for the first project source file (contains /src/ or \src\)
      for (let i = skipFrames; i < stack.length; i++) {
        const frame = stack[i];
        if (!frame) continue;

        const fileName = frame.getFileName() || '';

        // If this is a project source file, use it
        if (isProjectSourceFile(fileName)) {
          selectedFrame = frame;
          break;
        }
      }

      // If no project source file found, fall back to the original skipFrames approach
      if (!selectedFrame) {
        selectedFrame = stack[skipFrames] || null;
      }

      if (selectedFrame) {
        const fileName = selectedFrame.getFileName() || 'unknown';

        // Clean up file path to make it more readable
        const cleanFileName = cleanFilePath(fileName);

        // In production mode, line numbers are inaccurate - don't show them
        callerInfo = {
          fileName: cleanFileName,
          lineNumber: 0,
          columnNumber: 0
        };
      }
    }
  } catch {
    // Ignore errors - caller info is best effort
  } finally {
    // Restore original prepareStackTrace
    Error.prepareStackTrace = originalPrepareStackTrace;
  }

  return callerInfo;
}

/**
 * Format caller information for display.
 *
 * @param callerInfo - Caller info to format
 * @returns Formatted string like "file.ts:123" or just "file.ts" in production
 */
export function formatCallerInfo(callerInfo: CallerInfo): string {
  if (callerInfo.lineNumber > 0) {
    return `${callerInfo.fileName}:${callerInfo.lineNumber}`;
  }
  return callerInfo.fileName;
}

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
  const moduleColor = COLORS.brightMagenta;
  const traceColor = COLORS.yellow;
  const callerColor = COLORS.brightBlue;
  const resetColor = getResetColor();

  let result = `${timestampColor}[${timestamp}]${resetColor} ${levelColor}[${formattedLevel}]${resetColor} ${pidColor}[${formattedPid}]${resetColor}`;

  if (context?.traceId) {
    result += ` ${traceColor}[TID:${context.traceId}]${resetColor}`;
  }

  if (context?.spanId) {
    result += ` ${traceColor}[SID:${context.spanId}]${resetColor}`;
  }

  result += ` ${serverColor}[${actualServerName}]${resetColor}`;

  if (context?.module) {
    result += ` ${moduleColor}[${context.module}]${resetColor}`;
  }

  if (context?.caller) {
    result += ` ${callerColor}[${context.caller}]${resetColor}`;
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
export function createLogMessage(level: LogLevel, message: string, context?: LogContext): string {
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

  if (context?.module) {
    result += ` [${context.module}]`;
  }

  if (context?.caller) {
    result += ` [${context.caller}]`;
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
    if ('module' in error || 'traceId' in error || 'spanId' in error) {
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
