/**
 * Advanced structured logger with color support, file output, and context-aware logging.
 *
 * This logger provides comprehensive logging capabilities with the following features:
 * - ANSI color-coded console output with different colors for each log level
 * - Structured context information including PID, server name, trace ID, span ID
 * - File output with plain text formatting (no colors) for log analysis
 * - Development mode with automatic log file creation and clearing
 * - Context-aware logging with module, traceId, and spanId support
 * - Error formatting with stack trace truncation to prevent overly verbose logs
 * - MCP server-specific logging with serverName context
 * - Log rotation with date-based file naming and automatic cleanup
 * - Caller location information (file name and line number)
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

import type { LogLevel } from '@shared-types/common.types.js';
import type { LogContext, LogOptions } from './log-context.js';
import { DevLogger } from './dev-logger.js';
import { LOG_MODULES } from './log-modules.js';
import {
  createColoredLogMessage,
  createLogMessage,
  formatError,
  formatTimestamp,
  formatLogLevel,
  formatPid,
  getCallerInfo,
  formatCallerInfo
} from './log-formatter.js';
import { setDevModeEnabled } from '../json-utils.js';

export class Logger {
  private level: LogLevel = 'info';
  private useStderr: boolean = false;
  private useColor: boolean = true;
  private showCaller: boolean = true;
  private devLogger: DevLogger = new DevLogger();

  constructor(level: LogLevel = 'info') {
    this.level = level;

    const devLogFileEnv = process.env.DEV_LOG_FILE;
    if (devLogFileEnv === 'true' || devLogFileEnv === '1') {
      this.enableDevLog();
    }

    const noColorEnv = process.env.NO_COLOR;
    if (noColorEnv === 'true' || noColorEnv === '1' || noColorEnv === '') {
      this.setUseColor(false);
    }

    // Check LOG_CALLER environment variable
    const logCallerEnv = process.env.LOG_CALLER;
    if (logCallerEnv === 'false' || logCallerEnv === '0') {
      this.setShowCaller(false);
    }
  }

  /**
   * Enable or disable caller information in logs.
   * When enabled, logs will show the file name and line number where the log was called.
   *
   * @param show - Whether to show caller information
   * @example
   * ```typescript
   * logger.setShowCaller(false); // Disable caller info
   * ```
   */
  public setShowCaller(show: boolean): void {
    this.showCaller = show;
  }

  /**
   * Enables development logging mode with file output and enhanced debugging.
   *
   * @param rotatorConfig - Optional custom rotation configuration (default: 7 days retention)
   * @example
   * ```typescript
   * const logger = new Logger();
   * logger.enableDevLog(); // Logs will be written to logs/dev-server.2026-02-27.log
   *
   * // With custom retention period
   * logger.enableDevLog({ rotationAge: '14d' });
   * ```
   */
  public enableDevLog(rotatorConfig?: Parameters<DevLogger['enableDevLog']>[0]): void {
    setDevModeEnabled(true);
    this.devLogger.enableDevLog(rotatorConfig, (logFile) => {
      this.debug(`Writing logs to: ${logFile}`, LOG_MODULES.DEV_SERVER);
    });
  }

  public setUseStderr(use: boolean): void {
    this.useStderr = use;
  }

  /**
   * Enable or disable ANSI color output.
   * When disabled, logs will be plain text without color codes.
   *
   * @param use - Whether to use color in output
   * @example
   * ```typescript
   * logger.setUseColor(false); // Plain text output for files
   * ```
   */
  public setUseColor(use: boolean): void {
    this.useColor = use;
  }

  /**
   * Check if a message should be logged at the current level.
   * @internal Public for testing only
   */
  shouldLog(messageLevel: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(messageLevel) >= levels.indexOf(this.level);
  }

  /**
   * Generic logging method to eliminate code duplication.
   */
  private log(level: LogLevel, message: string, args: unknown[], options?: LogOptions): void {
    if (!this.shouldLog(level)) {
      return;
    }

    let fullMessage = message;
    if (args.length > 0) {
      const formattedArgs = args.map((arg) => formatError(arg)).join(' ');
      fullMessage = `${message} ${formattedArgs}`;
    }

    // Build context object
    const context: LogContext = {
      ...(options?.module && { module: options.module }),
      ...(options?.traceId && { traceId: options.traceId }),
      ...(options?.spanId && { spanId: options.spanId })
    };

    // Add caller info if enabled
    if (this.showCaller) {
      const callerInfo = getCallerInfo(4); // Skip 4 frames to get to the actual caller
      if (callerInfo) {
        context.caller = formatCallerInfo(callerInfo);
      }
    }

    const coloredLogMsg = createColoredLogMessage(level, fullMessage, context);
    const plainLogMsg = createLogMessage(level, fullMessage, context);
    const consoleLogMsg = this.useColor ? coloredLogMsg : plainLogMsg;

    if (this.useStderr) {
      console.error(consoleLogMsg);
    } else {
      switch (level) {
        case 'debug':
          console.debug(consoleLogMsg);
          break;
        case 'info':
          console.info(consoleLogMsg);
          break;
        case 'warn':
          console.warn(consoleLogMsg);
          break;
        case 'error':
          console.error(consoleLogMsg);
          break;
      }
    }

    const logFileStream = this.devLogger.stream;
    if (logFileStream) {
      logFileStream.write(plainLogMsg + '\n');
    }
  }

  /**
   * Logs a debug message with optional context and additional arguments.
   *
   * @param message - The primary log message
   * @param args - Additional arguments to include in the log
   *
   * @example
   * ```typescript
   * // Basic debug message
   * logger.debug('Processing request');
   *
   * // With context
   * logger.debug('Tool called', { module: 'Gateway', traceId: 'abc123' }, toolName, args);
   * ```
   */
  debug(message: string, ...args: unknown[]): void {
    const [options, ...restArgs] = this.extractOptionsAndArgs(args);
    this.log('debug', message, restArgs, options);
  }

  /**
   * Logs an informational message with optional context and additional arguments.
   *
   * @param message - The primary log message
   * @param args - Additional arguments to include in the log
   *
   * @example
   * ```typescript
   * // Basic info message
   * logger.info('Server started successfully');
   *
   * // With context and additional data
   * logger.info('Request processed', { module: 'API' }, { duration: 150, statusCode: 200 });
   * ```
   */
  info(message: string, ...args: unknown[]): void {
    const [options, ...restArgs] = this.extractOptionsAndArgs(args);
    this.log('info', message, restArgs, options);
  }

  /**
   * Logs a warning message with optional context and additional arguments.
   *
   * @param message - The primary log message
   * @param args - Additional arguments to include in the log
   *
   * @example
   * ```typescript
   * // Basic warning message
   * logger.warn('Deprecated API usage detected');
   *
   * // With context and error details
   * logger.warn('Connection timeout', { module: 'Network' }, { server: 'api.example.com', timeout: 5000 });
   * ```
   */
  warn(message: string, ...args: unknown[]): void {
    const [options, ...restArgs] = this.extractOptionsAndArgs(args);
    this.log('warn', message, restArgs, options);
  }

  /**
   * Logs an error message with optional context and additional arguments.
   *
   * @param message - The primary log message
   * @param args - Additional arguments to include in the log
   *
   * @example
   * ```typescript
   * // Basic error message
   * logger.error('Database connection failed');
   *
   * // With error object and context
   * logger.error('Request processing failed', { module: 'API' }, error, { requestId: '123' });
   * ```
   */
  error(message: string, ...args: unknown[]): void {
    const [options, ...restArgs] = this.extractOptionsAndArgs(args);
    this.log('error', message, restArgs, options);
  }

  private extractOptionsAndArgs(args: unknown[]): [LogOptions | undefined, unknown[]] {
    const optionsIndex = args.findIndex(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        !Array.isArray(arg) &&
        ('module' in arg || 'traceId' in arg || 'spanId' in arg)
    );

    if (optionsIndex !== -1) {
      const options = args[optionsIndex] as LogOptions;
      const restArgs = [...args.slice(0, optionsIndex), ...args.slice(optionsIndex + 1)];
      return [options, restArgs];
    }

    return [undefined, args];
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Method specifically for MCP Server logging.
   * Handles multi-line messages by splitting them into individual log entries.
   */
  serverLog(
    level: LogLevel,
    serverName: string,
    message: string,
    context?: Omit<LogContext, 'serverName'>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    // Check if message contains newlines
    if (message.includes('\n')) {
      // Split by newline characters, supporting both \n and \r\n
      const lines = message.split(/\r?\n/);

      // Log each non-empty line individually
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          this.logSingleServerLine(level, serverName, trimmedLine, context);
        }
      }
    } else {
      // Single line message, log as is
      this.logSingleServerLine(level, serverName, message, context);
    }
  }

  /**
   * Internal helper to log a single line for serverLog.
   * Contains the core logging logic originally in serverLog.
   */
  private logSingleServerLine(
    level: LogLevel,
    serverName: string,
    message: string,
    context?: Omit<LogContext, 'serverName'>
  ): void {
    // Build log context with server name
    const logContext: LogContext = {
      ...context,
      serverName
    };

    // Add caller info if enabled (only once per serverLog call would be better,
    // but for consistency with multi-line logging, we add it for each line)
    if (this.showCaller) {
      const callerInfo = getCallerInfo(5); // Skip 5 frames to get to the actual caller
      if (callerInfo) {
        logContext.caller = formatCallerInfo(callerInfo);
      }
    }

    const coloredLogMsg = createColoredLogMessage(level, message, logContext);
    const plainLogMsg = createLogMessage(level, message, logContext);
    const consoleLogMsg = this.useColor ? coloredLogMsg : plainLogMsg;

    if (this.useStderr) {
      console.error(consoleLogMsg);
    } else {
      switch (level) {
        case 'debug':
          console.debug(consoleLogMsg);
          break;
        case 'info':
          console.info(consoleLogMsg);
          break;
        case 'warn':
          console.warn(consoleLogMsg);
          break;
        case 'error':
          console.error(consoleLogMsg);
          break;
      }
    }

    const logFileStream = this.devLogger.stream;
    if (logFileStream) {
      logFileStream.write(plainLogMsg + '\n');
    }
  }

  // ========================================================================
  // Test-only accessors - These are public for testing but marked @internal
  // to indicate they should not be used in production code.
  // ========================================================================

  /**
   * Internal accessor for testing and legacy compatibility.
   * @internal
   */
  get logFileStream(): unknown {
    return this.devLogger.stream;
  }

  /**
   * Internal accessor for testing and legacy compatibility.
   * @internal
   */
  get devLogRotator(): unknown {
    return this.devLogger.rotator;
  }

  /**
   * Internal method for testing and legacy compatibility.
   * @internal
   */
  createColoredLogMessage(level: LogLevel, message: string, context?: LogContext): string {
    return createColoredLogMessage(level, message, context);
  }

  /**
   * Internal method for testing and legacy compatibility.
   * @internal
   */
  createLogMessage(level: LogLevel, message: string, context?: LogContext): string {
    return createLogMessage(level, message, context);
  }

  /**
   * Internal method for testing and legacy compatibility.
   * @internal
   */
  formatError(error: unknown): string {
    return formatError(error);
  }

  /**
   * Internal method for testing and legacy compatibility.
   * @internal
   */
  formatTimestamp(date: Date): string {
    return formatTimestamp(date);
  }

  /**
   * Internal method for testing and legacy compatibility.
   * @internal
   */
  formatLogLevel(level: LogLevel): string {
    return formatLogLevel(level);
  }

  /**
   * Internal method for testing and legacy compatibility.
   * @internal
   */
  formatPid(pid: number): string {
    return formatPid(pid);
  }
}
