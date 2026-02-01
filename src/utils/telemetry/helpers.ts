import { trace, Span, SpanOptions } from '@opentelemetry/api';
import { telemetryManager } from './index.js';
import { logger } from '../logger.js';

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
  fn: (span: Span) => Promise<T>
): Promise<T> {
  if (!telemetryManager.isEnabled()) {
    return fn(null as any); // Return without tracing if disabled
  }

  const tracer = trace.getTracer('mcp-hub');
  return tracer.startActiveSpan(name, options, async (span: Span) => {
    // 设置日志上下文
    const originalDebug = logger.debug;
    const originalInfo = logger.info;
    const originalWarn = logger.warn;
    const originalError = logger.error;
    const originalServerLog = logger.serverLog;

    try {
      logger.debug = (message: string, ...args: unknown[]) => {
        const [opts, ...rest] = extractOptions(args);
        const logOptions = { ...opts, traceId: span.spanContext().traceId, spanId: span.spanContext().spanId };
        (logger as any).log('debug', message, rest, logOptions);
      };

      logger.info = (message: string, ...args: unknown[]) => {
        const [opts, ...rest] = extractOptions(args);
        const logOptions = { ...opts, traceId: span.spanContext().traceId, spanId: span.spanContext().spanId };
        (logger as any).log('info', message, rest, logOptions);
      };

      logger.warn = (message: string, ...args: unknown[]) => {
        const [opts, ...rest] = extractOptions(args);
        const logOptions = { ...opts, traceId: span.spanContext().traceId, spanId: span.spanContext().spanId };
        (logger as any).log('warn', message, rest, logOptions);
      };

      logger.error = (message: string, ...args: unknown[]) => {
        const [opts, ...rest] = extractOptions(args);
        const logOptions = { ...opts, traceId: span.spanContext().traceId, spanId: span.spanContext().spanId };
        (logger as any).log('error', message, rest, logOptions);
      };

      logger.serverLog = (level: any, serverName: string, message: string, context?: any) => {
        const logContext = {
          ...context,
          serverName,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId
        };
        const coloredLogMsg = (logger as any).createColoredLogMessage(level, message, logContext);
        const plainLogMsg = (logger as any).createLogMessage(level, message, logContext);

        // 使用正确的控制台方法
        if ((logger as any).useStderr) {
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
            default:
              console.info(coloredLogMsg);
          }
        }

        // 文件输出（如果启用）- 使用纯文本格式
        if ((logger as any).logFileStream) {
          (logger as any).logFileStream.write(plainLogMsg + '\n');
        }
      };

      const result = await fn(span);
      span.end();

      // 恢复原始方法
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

      // 恢复原始方法
      logger.debug = originalDebug;
      logger.info = originalInfo;
      logger.warn = originalWarn;
      logger.error = originalError;

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
  fn: (span: Span) => T
): T {
  if (!telemetryManager.isEnabled()) {
    return fn(null as any); // Return without tracing if disabled
  }

  const tracer = trace.getTracer('mcp-hub');
  const span = tracer.startSpan(name, options);

  // 设置日志上下文
  const originalDebug = logger.debug;
  const originalInfo = logger.info;
  const originalWarn = logger.warn;
  const originalError = logger.error;
  const originalServerLog = logger.serverLog;

  try {
    logger.debug = (message: string, ...args: unknown[]) => {
      const [opts, ...rest] = extractOptions(args);
      const logOptions = { ...opts, traceId: span.spanContext().traceId, spanId: span.spanContext().spanId };
      (logger as any).log('debug', message, rest, logOptions);
    };

    logger.info = (message: string, ...args: unknown[]) => {
      const [opts, ...rest] = extractOptions(args);
      const logOptions = { ...opts, traceId: span.spanContext().traceId, spanId: span.spanContext().spanId };
      (logger as any).log('info', message, rest, logOptions);
    };

    logger.warn = (message: string, ...args: unknown[]) => {
      const [opts, ...rest] = extractOptions(args);
      const logOptions = { ...opts, traceId: span.spanContext().traceId, spanId: span.spanContext().spanId };
      (logger as any).log('warn', message, rest, logOptions);
    };

    logger.error = (message: string, ...args: unknown[]) => {
      const [opts, ...rest] = extractOptions(args);
      const logOptions = { ...opts, traceId: span.spanContext().traceId, spanId: span.spanContext().spanId };
      (logger as any).log('error', message, rest, logOptions);
    };

    logger.serverLog = (level: any, serverName: string, message: string, context?: any) => {
      const logContext = {
        ...context,
        serverName,
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId
      };
      const coloredLogMsg = (logger as any).createColoredLogMessage(level, message, logContext);
      const plainLogMsg = (logger as any).createLogMessage(level, message, logContext);

      // 使用正确的控制台方法
      if ((logger as any).useStderr) {
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
          default:
            console.info(coloredLogMsg);
        }
      }

      // 文件输出（如果启用）- 使用纯文本格式
      if ((logger as any).logFileStream) {
        (logger as any).logFileStream.write(plainLogMsg + '\n');
      }
    };

    const result = fn(span);
    span.end();

    // 恢复原始方法
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

    // 恢复原始方法
    logger.debug = originalDebug;
    logger.info = originalInfo;
    logger.warn = originalWarn;
    logger.error = originalError;

    throw error;
  }
}

/**
 * 辅助函数：提取选项和参数
 */
function extractOptions(args: unknown[]): [any, unknown[]] {
  // 我们需要正确地匹配 logger.ts 中的 extractOptionsAndArgs 方法的行为
  if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
    // 检查是否是 LogOptions 对象
    const firstArg = args[0] as any;
    if ('subModule' in firstArg || 'traceId' in firstArg || 'spanId' in firstArg) {
      return [firstArg, args.slice(1)];
    }
  }
  return [{}, args];
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
  additionalAttributes: Record<string, any> = {}
): SpanOptions {
  const attributes: Record<string, any> = {
    'mcp.operation': operation,
    'mcp.server.id': serverId,
    ...additionalAttributes
  };

  if (toolName) {
    attributes['mcp.tool.name'] = toolName;
  }

  return { attributes };
}