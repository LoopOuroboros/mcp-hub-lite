import fs from 'fs';
import path from 'path';
import type { LogLevel } from '@shared-types/common.types.js';

export interface LogContext {
  pid?: number;
  serverName?: string;
  subModule?: string;
  traceId?: string;
  spanId?: string;
}

export type LogOptions = Omit<LogContext, 'pid' | 'serverName'>;

// PID formatting configuration
const PID_WIDTH = 8;

/**
 * Advanced structured logger with color support, file output, and context-aware logging.
 *
 * This logger provides comprehensive logging capabilities with the following features:
 * - ANSI color-coded console output with different colors for each log level
 * - Structured context information including PID, server name, trace ID, span ID
 * - File output with plain text formatting (no colors) for log analysis
 * - Development mode with automatic log file creation and clearing
 * - Context-aware logging with subModule, traceId, and spanId support
 * - Error formatting with stack trace truncation to prevent overly verbose logs
 * - MCP server-specific logging with serverName context
 *
 * The logger supports four log levels: debug, info, warn, and error, with configurable
 * minimum log level threshold.
 *
 * @example
 * ```typescript
 * // Basic usage
 * logger.info('Server started', { port: 7788 });
 *
 * // With context
 * logger.error('Connection failed', { error: err.message, serverName: 'my-server' });
 *
 * // Development mode
 * logger.enableDevLog();
 * ```
 */
export class Logger {
  private level: LogLevel = 'info';
  private useStderr: boolean = false;
  private logFileStream: fs.WriteStream | null = null;

  constructor(level: LogLevel = 'info') {
    this.level = level;

    // Check if development log file is enabled
    if (process.env.DEV_LOG_FILE) {
      this.enableDevLog();
    }
  }

  /**
   * Enables development logging mode with file output and enhanced debugging.
   *
   * This method configures the logger to:
   * - Write all log output to a file in the logs/ directory
   * - Enable communication debug logging (MCP_COMM_DEBUG)
   * - Enable session debug logging (SESSION_DEBUG)
   * - Clear the log file on startup to avoid interference from stale logs
   *
   * The log file is created at logs/dev-server.log and will contain plain text
   * formatted logs without ANSI color codes for easier analysis.
   *
   * @example
   * ```typescript
   * const logger = new Logger();
   * logger.enableDevLog(); // Logs will be written to logs/dev-server.log
   * ```
   */
  public enableDevLog() {
    if (this.logFileStream) return;

    // Enable dev logging to file via environment variable
    process.env.DEV_LOG_FILE = '1';

    // Enable communication debug logging for development
    process.env.MCP_COMM_DEBUG = '1';

    // Enable session debug logging for development
    process.env.SESSION_DEBUG = '1';

    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'dev-server.log');

    // Clear log file in development mode to avoid interference from stale logs
    if (fs.existsSync(logFile)) {
      fs.truncateSync(logFile, 0);
    }

    this.logFileStream = fs.createWriteStream(logFile, { flags: 'a' });
    this.debug(`[DEV LOG] Writing logs to: ${logFile} (cleared on startup)`);
  }

  public setUseStderr(use: boolean) {
    this.useStderr = use;
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(messageLevel) >= levels.indexOf(this.level);
  }

  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  // ANSI color codes
  private getColorCodeForLevel(level: LogLevel): string {
    switch (level) {
      case 'debug':
        return '\x1b[36m'; // Cyan
      case 'info':
        return '\x1b[32m'; // Green
      case 'warn':
        return '\x1b[33m'; // Yellow
      case 'error':
        return '\x1b[31m'; // Red
      default:
        return '\x1b[0m';
    }
  }

  private getResetColor(): string {
    return '\x1b[0m';
  }

  private formatLogLevel(level: LogLevel): string {
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
        // This branch will never be reached in TypeScript because LogLevel is a union type
        // but we return a default value to satisfy the compiler
        return 'UNK';
    }
  }

  private formatPid(pid: number): string {
    // Fixed width for numeric part, right-aligned, padded with spaces if necessary
    const pidStr = pid.toString();
    if (pidStr.length > PID_WIDTH) {
      return `PID:${pidStr.substring(0, PID_WIDTH)}`; // Truncate overly long PID
    }
    return `PID:${pidStr.padStart(PID_WIDTH, ' ')}`;
  }

  private createColoredLogMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = this.formatTimestamp(new Date());
    const processPid = context?.pid ?? process.pid;
    const formattedLevel = this.formatLogLevel(level);
    const formattedPid = this.formatPid(processPid);
    const actualServerName = context?.serverName || 'mcp-hub';

    // Timestamp - white/gray
    const timestampColor = '\x1b[90m';
    // Log level - colored according to level
    const levelColor = this.getColorCodeForLevel(level);
    // PID - cyan
    const pidColor = '\x1b[36m';
    // Server name or mcp-hub - light cyan (bright cyan)
    const serverColor = '\x1b[96m';
    // Submodule - light purple
    const subModuleColor = '\x1b[95m';
    // TraceId and SpanId - yellow
    const traceColor = '\x1b[33m';
    // Reset color
    const resetColor = this.getResetColor();

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

  private createLogMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = this.formatTimestamp(new Date());
    const processPid = context?.pid ?? process.pid;
    const formattedLevel = this.formatLogLevel(level);
    // For plain text logs, keep PID format simple
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

  // Helper method: format error object
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      let result = error.message;
      if (error.stack) {
        // Add stack trace but limit length to avoid being too long
        const stackLines = error.stack.split('\n').slice(1, 6); // Take first 5 stack lines
        if (stackLines.length > 0) {
          result += '\n' + stackLines.join('\n');
        }
      }
      return result;
    }
    // For non-Error object arguments, we need to format them properly
    if (typeof error === 'object' && error !== null) {
      // Check if it's a LogOptions object
      if ('subModule' in error || 'traceId' in error || 'spanId' in error) {
        // If it's a LogOptions object, we should ignore it as it shouldn't be output as an argument
        return '';
      }
      // Check if it's an empty array or empty object
      if (Array.isArray(error) && error.length === 0) {
        return '';
      }
      if (Object.keys(error).length === 0) {
        return '';
      }
      // For other objects, we should convert them to JSON string
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }
    return String(error);
  }

  // Generic logging method to eliminate code duplication
  private log(level: LogLevel, message: string, args: unknown[], options?: LogOptions): void {
    if (!this.shouldLog(level)) {
      return;
    }

    // Handle multiple arguments
    let fullMessage = message;
    if (args.length > 0) {
      const formattedArgs = args.map((arg) => this.formatError(arg)).join(' ');
      fullMessage = `${message} ${formattedArgs}`;
    }

    // Convert LogOptions to LogContext
    const context: LogContext | undefined = options
      ? {
          subModule: options.subModule,
          traceId: options.traceId,
          spanId: options.spanId
        }
      : undefined;

    const coloredLogMsg = this.createColoredLogMessage(level, fullMessage, context);
    const plainLogMsg = this.createLogMessage(level, fullMessage, context);

    // Console output
    if (this.useStderr) {
      console.error(coloredLogMsg);
    } else {
      switch (level) {
        case 'debug':
          console.debug(coloredLogMsg);
          break;
        case 'info':
          console.info(coloredLogMsg);
          break;
        case 'warn':
          console.warn(coloredLogMsg);
          break;
        case 'error':
          console.error(coloredLogMsg);
          break;
      }
    }

    // File output (if enabled) - use plain text format
    if (this.logFileStream) {
      this.logFileStream.write(plainLogMsg + '\n');
    }
  }

  /**
   * Logs a debug message with optional context and additional arguments.
   *
   * Debug messages are only output when the logger's level is set to 'debug'.
   * This method supports structured logging with context options and multiple
   * arguments that will be formatted appropriately.
   *
   * @param {string} message - The primary log message
   * @param {...unknown[]} args - Additional arguments to include in the log
   * @param {LogOptions} [args[0]] - Optional logging context (subModule, traceId, spanId)
   *
   * @example
   * ```typescript
   * // Basic debug message
   * logger.debug('Processing request');
   *
   * // With context
   * logger.debug('Tool called', { subModule: 'Gateway', traceId: 'abc123' }, toolName, args);
   * ```
   */
  debug(message: string, ...args: unknown[]): void {
    const [options, ...restArgs] = this.extractOptionsAndArgs(args);
    this.log('debug', message, restArgs, options);
  }

  /**
   * Logs an informational message with optional context and additional arguments.
   *
   * Info messages are output when the logger's level is 'info', 'warn', or 'error'.
   * This method supports structured logging with context options and multiple
   * arguments that will be formatted appropriately.
   *
   * @param {string} message - The primary log message
   * @param {...unknown[]} args - Additional arguments to include in the log
   * @param {LogOptions} [args[0]] - Optional logging context (subModule, traceId, spanId)
   *
   * @example
   * ```typescript
   * // Basic info message
   * logger.info('Server started successfully');
   *
   * // With context and additional data
   * logger.info('Request processed', { subModule: 'API' }, { duration: 150, statusCode: 200 });
   * ```
   */
  info(message: string, ...args: unknown[]): void {
    const [options, ...restArgs] = this.extractOptionsAndArgs(args);
    this.log('info', message, restArgs, options);
  }

  /**
   * Logs a warning message with optional context and additional arguments.
   *
   * Warning messages are output when the logger's level is 'warn' or 'error'.
   * This method supports structured logging with context options and multiple
   * arguments that will be formatted appropriately.
   *
   * @param {string} message - The primary log message
   * @param {...unknown[]} args - Additional arguments to include in the log
   * @param {LogOptions} [args[0]] - Optional logging context (subModule, traceId, spanId)
   *
   * @example
   * ```typescript
   * // Basic warning message
   * logger.warn('Deprecated API usage detected');
   *
   * // With context and error details
   * logger.warn('Connection timeout', { subModule: 'Network' }, { server: 'api.example.com', timeout: 5000 });
   * ```
   */
  warn(message: string, ...args: unknown[]): void {
    const [options, ...restArgs] = this.extractOptionsAndArgs(args);
    this.log('warn', message, restArgs, options);
  }

  /**
   * Logs an error message with optional context and additional arguments.
   *
   * Error messages are always output regardless of the logger's level setting.
   * This method supports structured logging with context options and multiple
   * arguments that will be formatted appropriately, including proper error
   * object formatting with stack traces.
   *
   * @param {string} message - The primary log message
   * @param {...unknown[]} args - Additional arguments to include in the log
   * @param {LogOptions} [args[0]] - Optional logging context (subModule, traceId, spanId)
   *
   * @example
   * ```typescript
   * // Basic error message
   * logger.error('Database connection failed');
   *
   * // With error object and context
   * logger.error('Request processing failed', { subModule: 'API' }, error, { requestId: '123' });
   * ```
   */
  error(message: string, ...args: unknown[]): void {
    const [options, ...restArgs] = this.extractOptionsAndArgs(args);
    this.log('error', message, restArgs, options);
  }

  private extractOptionsAndArgs(args: unknown[]): [LogOptions | undefined, unknown[]] {
    if (
      args.length > 0 &&
      typeof args[0] === 'object' &&
      args[0] !== null &&
      !Array.isArray(args[0])
    ) {
      const firstArg = args[0] as Record<string, unknown>;
      if ('subModule' in firstArg || 'traceId' in firstArg || 'spanId' in firstArg) {
        return [args[0] as LogOptions, args.slice(1)];
      }
    }
    return [undefined, args];
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  // Method specifically for MCP Server logging
  serverLog(
    level: LogLevel,
    serverName: string,
    message: string,
    context?: Omit<LogContext, 'serverName'>
  ): void {
    if (this.shouldLog(level)) {
      const logContext: LogContext = {
        ...context,
        serverName
      };
      const coloredLogMsg = this.createColoredLogMessage(level, message, logContext);
      const plainLogMsg = this.createLogMessage(level, message, logContext);

      // Use correct console method
      if (this.useStderr) {
        console.error(coloredLogMsg);
      } else {
        switch (level) {
          case 'debug':
            console.debug(coloredLogMsg);
            break;
          case 'info':
            console.info(coloredLogMsg);
            break;
          case 'warn':
            console.warn(coloredLogMsg);
            break;
          case 'error':
            console.error(coloredLogMsg);
            break;
        }
      }

      // File output (if enabled) - use plain text format
      if (this.logFileStream) {
        this.logFileStream.write(plainLogMsg + '\n');
      }
    }
  }
}

export const logger = new Logger();

/**
 * Colored logging function
 * @param coloredMessage Message displayed in console (with ANSI color codes)
 * @param plainMessage Message for file logs (plain text)
 */
/**
 * Check if data is a tools/list response
 * @param data stdout or response data
 * @returns true if it's a tools/list response
 */
export function isToolsListResponse(data: string): boolean {
  try {
    const trimmed = data.trim();

    // Handle SSE format responses (event: message followed by data: JSON)
    if (trimmed.includes('event: message') && trimmed.includes('data:')) {
      const dataMatch = trimmed.match(/data: ([^\n]+)/);
      if (dataMatch) {
        const jsonData = dataMatch[1].trim();
        return isToolsListResponse(jsonData); // Recursive call to check data field content
      }
    }

    if (trimmed.startsWith('{')) {
      const message = JSON.parse(trimmed) as unknown;
      // Check if it's a response containing tools or resources fields
      if (typeof message === 'object' && message !== null) {
        const msg = message as { result?: unknown };
        if (msg.result && typeof msg.result === 'object' && msg.result !== null) {
          const result = msg.result as Record<string, unknown>;
          // Match tools/list response format: {"result":{"tools": [...]} }
          if ('tools' in result) {
            return true;
          }
          // Match resources/list response format: {"result":{"resources": [...]} }
          if ('resources' in result) {
            return true;
          }
          // Match initialize response format: {"result":{"capabilities":{"tools": {...}} } }
          if (
            'capabilities' in result &&
            typeof result.capabilities === 'object' &&
            result.capabilities !== null
          ) {
            const capabilities = result.capabilities as Record<string, unknown>;
            if ('tools' in capabilities || 'resources' in capabilities) {
              return true;
            }
          }
        }
      }
    }
  } catch {
    // Non-JSON data, ignore
  }
  return false;
}

/**
 * Simplify tools/list response log information
 * @param data Complete response data
 * @returns Simplified log information
 */
export function simplifyToolsListResponse(data: string): string {
  try {
    const trimmed = data.trim();

    // Handle SSE format responses
    if (trimmed.includes('event: message') && trimmed.includes('data:')) {
      const dataMatch = trimmed.match(/data: ([^\n]+)/);
      if (dataMatch) {
        const jsonData = dataMatch[1].trim();
        const simplified = simplifyToolsListResponse(jsonData); // Recursive call
        return `event: message\ndata: ${simplified}`;
      }
    }

    if (trimmed.startsWith('{')) {
      const message = JSON.parse(trimmed) as unknown;
      if (typeof message === 'object' && message !== null) {
        const msg = message as { result?: unknown };
        if (msg.result && typeof msg.result === 'object' && msg.result !== null) {
          const result = msg.result as Record<string, unknown>;
          // Handle tools/list responses
          if ('tools' in result) {
            const toolsCount = Array.isArray(result.tools) ? result.tools.length : 0;
            return `Returned ${toolsCount} tools`;
          }
          // Handle resources/list responses
          if ('resources' in result) {
            const resourcesCount = Array.isArray(result.resources) ? result.resources.length : 0;
            return `Returned ${resourcesCount} resources`;
          }
          // Handle tool/resource information in initialize responses
          if (
            'capabilities' in result &&
            typeof result.capabilities === 'object' &&
            result.capabilities !== null
          ) {
            const capabilities = result.capabilities as Record<string, unknown>;
            let toolsCount = 0;
            let resourcesCount = 0;

            if (
              'tools' in capabilities &&
              typeof capabilities.tools === 'object' &&
              capabilities.tools !== null
            ) {
              toolsCount = Object.keys(capabilities.tools as Record<string, unknown>).length;
            }

            if (
              'resources' in capabilities &&
              typeof capabilities.resources === 'object' &&
              capabilities.resources !== null
            ) {
              resourcesCount = Object.keys(
                capabilities.resources as Record<string, unknown>
              ).length;
            }

            if (toolsCount > 0 && resourcesCount > 0) {
              return `Returned ${toolsCount} tools and ${resourcesCount} resources`;
            } else if (toolsCount > 0) {
              return `Returned ${toolsCount} tools`;
            } else if (resourcesCount > 0) {
              return `Returned ${resourcesCount} resources`;
            }
          }
        }
      }
    }
  } catch {
    // Parsing failed, return truncated version of original data
  }

  // If not a tool list response or parsing failed, return truncated version of original data
  return data.length > 200 ? data.substring(0, 200) + '...' : data;
}

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
  // Use new color format
  const coloredLogMsg = logger['createColoredLogMessage']('info', coloredMessage, context);
  console.info(coloredLogMsg);

  // File output (no colors) - directly use createLogMessage method
  if (logger['logFileStream']) {
    const plainLogMsg = logger['createLogMessage']('info', plainMessage, context);
    logger['logFileStream'].write(plainLogMsg + '\n');
  }
}
