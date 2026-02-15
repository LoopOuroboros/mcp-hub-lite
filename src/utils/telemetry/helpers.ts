import { trace, Span, SpanOptions, Attributes, AttributeValue } from '@opentelemetry/api';
import { telemetryManager } from '@utils/telemetry/index.js';
import { logger, LogContext, LogOptions } from '@utils/logger.js';
import type { LogLevel } from '@shared-types/common.types.js';

/**
 * Helper function to create and manage spans with automatic error handling
 * @param name Span name
 * @param options Span options
 * @param fn Function to execute within the span
 * @returns Promise with the result of the function
 */
export async function withSpan<T>(
  name: string,
  options: SpanOptions,
  fn: (span: Span | null) => Promise<T>
): Promise<T> {
  if (!telemetryManager.isEnabled()) {
    return fn(null); // Return without tracing if disabled
  }

  const tracer = trace.getTracer('mcp-hub');
  return tracer.startActiveSpan(name, options, async (span: Span) => {
    // Set up log context
    const originalDebug = logger.debug;
    const originalInfo = logger.info;
    const originalWarn = logger.warn;
    const originalError = logger.error;
    const originalServerLog = logger.serverLog;

    try {
      // Create log options with trace context
      const logContext: LogOptions = {
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId
      };

      logger.debug = (message: string, ...args: unknown[]) => {
        // If the first argument is LogOptions, merge trace context
        if (
          args.length > 0 &&
          typeof args[0] === 'object' &&
          args[0] !== null &&
          !Array.isArray(args[0])
        ) {
          const firstArg = args[0] as Record<string, unknown>;
          if ('subModule' in firstArg || 'traceId' in firstArg || 'spanId' in firstArg) {
            const mergedOptions = { ...firstArg, ...logContext };
            originalDebug(message, mergedOptions, ...args.slice(1));
            return;
          }
        }
        // Otherwise, add trace context directly
        originalDebug(message, logContext, ...args);
      };

      logger.info = (message: string, ...args: unknown[]) => {
        if (
          args.length > 0 &&
          typeof args[0] === 'object' &&
          args[0] !== null &&
          !Array.isArray(args[0])
        ) {
          const firstArg = args[0] as Record<string, unknown>;
          if ('subModule' in firstArg || 'traceId' in firstArg || 'spanId' in firstArg) {
            const mergedOptions = { ...firstArg, ...logContext };
            originalInfo(message, mergedOptions, ...args.slice(1));
            return;
          }
        }
        originalInfo(message, logContext, ...args);
      };

      logger.warn = (message: string, ...args: unknown[]) => {
        if (
          args.length > 0 &&
          typeof args[0] === 'object' &&
          args[0] !== null &&
          !Array.isArray(args[0])
        ) {
          const firstArg = args[0] as Record<string, unknown>;
          if ('subModule' in firstArg || 'traceId' in firstArg || 'spanId' in firstArg) {
            const mergedOptions = { ...firstArg, ...logContext };
            originalWarn(message, mergedOptions, ...args.slice(1));
            return;
          }
        }
        originalWarn(message, logContext, ...args);
      };

      logger.error = (message: string, ...args: unknown[]) => {
        if (
          args.length > 0 &&
          typeof args[0] === 'object' &&
          args[0] !== null &&
          !Array.isArray(args[0])
        ) {
          const firstArg = args[0] as Record<string, unknown>;
          if ('subModule' in firstArg || 'traceId' in firstArg || 'spanId' in firstArg) {
            const mergedOptions = { ...firstArg, ...logContext };
            originalError(message, mergedOptions, ...args.slice(1));
            return;
          }
        }
        originalError(message, logContext, ...args);
      };

      logger.serverLog = (
        level: LogLevel,
        serverName: string,
        message: string,
        context?: Omit<LogContext, 'serverName'>
      ) => {
        const serverContext: Omit<LogContext, 'serverName'> = {
          ...context,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId
        };
        originalServerLog(level, serverName, message, serverContext);
      };

      const result = await fn(span);
      span.end();

      // Restore original methods
      logger.debug = originalDebug;
      logger.info = originalInfo;
      logger.warn = originalWarn;
      logger.error = originalError;
      logger.serverLog = originalServerLog;

      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setAttribute('error', true);
      span.end();

      // Restore original methods
      logger.debug = originalDebug;
      logger.info = originalInfo;
      logger.warn = originalWarn;
      logger.error = originalError;
      logger.serverLog = originalServerLog;

      throw error;
    }
  });
}

/**
 * Helper function to create spans for synchronous operations
 * @param name Span name
 * @param options Span options
 * @param fn Function to execute within the span
 * @returns Result of the function
 */
export function withSpanSync<T>(
  name: string,
  options: SpanOptions,
  fn: (span: Span | null) => T
): T {
  if (!telemetryManager.isEnabled()) {
    return fn(null); // Return without tracing if disabled
  }

  const tracer = trace.getTracer('mcp-hub');
  const span = tracer.startSpan(name, options);

  // Set up log context
  const originalDebug = logger.debug;
  const originalInfo = logger.info;
  const originalWarn = logger.warn;
  const originalError = logger.error;
  const originalServerLog = logger.serverLog;

  try {
    // Create log options with trace context
    const logContext: LogOptions = {
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId
    };

    logger.debug = (message: string, ...args: unknown[]) => {
      if (
        args.length > 0 &&
        typeof args[0] === 'object' &&
        args[0] !== null &&
        !Array.isArray(args[0])
      ) {
        const firstArg = args[0] as Record<string, unknown>;
        if ('subModule' in firstArg || 'traceId' in firstArg || 'spanId' in firstArg) {
          const mergedOptions = { ...firstArg, ...logContext };
          originalDebug(message, mergedOptions, ...args.slice(1));
          return;
        }
      }
      originalDebug(message, logContext, ...args);
    };

    logger.info = (message: string, ...args: unknown[]) => {
      if (
        args.length > 0 &&
        typeof args[0] === 'object' &&
        args[0] !== null &&
        !Array.isArray(args[0])
      ) {
        const firstArg = args[0] as Record<string, unknown>;
        if ('subModule' in firstArg || 'traceId' in firstArg || 'spanId' in firstArg) {
          const mergedOptions = { ...firstArg, ...logContext };
          originalInfo(message, mergedOptions, ...args.slice(1));
          return;
        }
      }
      originalInfo(message, logContext, ...args);
    };

    logger.warn = (message: string, ...args: unknown[]) => {
      if (
        args.length > 0 &&
        typeof args[0] === 'object' &&
        args[0] !== null &&
        !Array.isArray(args[0])
      ) {
        const firstArg = args[0] as Record<string, unknown>;
        if ('subModule' in firstArg || 'traceId' in firstArg || 'spanId' in firstArg) {
          const mergedOptions = { ...firstArg, ...logContext };
          originalWarn(message, mergedOptions, ...args.slice(1));
          return;
        }
      }
      originalWarn(message, logContext, ...args);
    };

    logger.error = (message: string, ...args: unknown[]) => {
      if (
        args.length > 0 &&
        typeof args[0] === 'object' &&
        args[0] !== null &&
        !Array.isArray(args[0])
      ) {
        const firstArg = args[0] as Record<string, unknown>;
        if ('subModule' in firstArg || 'traceId' in firstArg || 'spanId' in firstArg) {
          const mergedOptions = { ...firstArg, ...logContext };
          originalError(message, mergedOptions, ...args.slice(1));
          return;
        }
      }
      originalError(message, logContext, ...args);
    };

    logger.serverLog = (
      level: LogLevel,
      serverName: string,
      message: string,
      context?: Omit<LogContext, 'serverName'>
    ) => {
      const serverContext: Omit<LogContext, 'serverName'> = {
        ...context,
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId
      };
      originalServerLog(level, serverName, message, serverContext);
    };

    const result = fn(span);
    span.end();

    // Restore original methods
    logger.debug = originalDebug;
    logger.info = originalInfo;
    logger.warn = originalWarn;
    logger.error = originalError;
    logger.serverLog = originalServerLog;

    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setAttribute('error', true);
    span.end();

    // Restore original methods
    logger.debug = originalDebug;
    logger.info = originalInfo;
    logger.warn = originalWarn;
    logger.error = originalError;
    logger.serverLog = originalServerLog;

    throw error;
  }
}

/**
 * Create a span with common MCP attributes
 * @param operation Operation name
 * @param serverId Server ID
 * @param toolName Tool name (optional)
 * @param additionalAttributes Additional attributes
 * @returns Span options
 */
export function createMcpSpanOptions(
  operation: string,
  serverId: string,
  toolName?: string,
  additionalAttributes: Record<string, AttributeValue> = {}
): SpanOptions {
  const attributes: Attributes = {
    'mcp.operation': operation,
    'mcp.server.id': serverId,
    ...additionalAttributes
  };

  if (toolName) {
    attributes['mcp.tool.name'] = toolName;
  }

  return { attributes };
}
