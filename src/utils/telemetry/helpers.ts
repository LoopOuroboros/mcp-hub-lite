import { trace, Span, SpanOptions } from '@opentelemetry/api';
import { telemetryManager } from './index.js';

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
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setAttribute('error', true);
      span.end();
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
  try {
    const result = fn(span);
    span.end();
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setAttribute('error', true);
    span.end();
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