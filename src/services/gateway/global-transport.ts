/**
 * MCP transport utilities — stateful session-based mode.
 *
 * Each client session owns a StreamableHTTPServerTransport + McpServer pair.
 * SDK's stateful mode (sessionIdGenerator) handles SSE stream setup and session management.
 * Notifications are broadcast via SessionManager across all active sessions.
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger, LOG_MODULES } from '@utils/logger/index.js';
import {
  stringifyForLogging,
  getMcpCommDebugSetting,
  getGatewayDebugSetting
} from '@utils/json-utils.js';
import { formatMcpMessageForLogging, logNotificationMessage } from '@utils/logger/log-output.js';
import { gateway } from './gateway.service.js';

/**
 * Build log options from trace context stored on transport.
 * Trace context is injected by gateway.ts before handleRequest() as an ALS fallback
 * because the MCP SDK defers send()/onmessage calls and ALS context is lost.
 */
function traceLogOpts(transport: StreamableHTTPServerTransport): Record<string, unknown> {
  const ctx = transport as unknown as Record<string, unknown>;
  const sid = ctx._traceSessionId as string | undefined;
  const tid = ctx._traceId as string | undefined;
  if (!sid && !tid) return LOG_MODULES.COMMUNICATION;
  return { module: 'Communication', ...(sid && { sessionId: sid }), ...(tid && { traceId: tid }) };
}

/**
 * Sets up debug logging on a transport instance.
 */
export function setupTransportLogging(transport: StreamableHTTPServerTransport): void {
  transport.onmessage = (message) => {
    try {
      if (getMcpCommDebugSetting()) {
        const opts = traceLogOpts(transport);
        logger.debug(`Transport onmessage: ${stringifyForLogging(message)}`, opts);
        const logMessage = formatMcpMessageForLogging(message);
        logger.debug(`MCP message received: ${logMessage}`, opts);
      }
      logNotificationMessage(message, '');
      if (getGatewayDebugSetting()) {
        logger.debug('Transport onmessage completed', LOG_MODULES.GATEWAY);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in transport onmessage: ${errorMessage}`, LOG_MODULES.GATEWAY);
      logger.error(
        `Message that caused error: ${stringifyForLogging(message)}`,
        LOG_MODULES.GATEWAY
      );
    }
  };

  if (getMcpCommDebugSetting()) {
    const originalSend = transport.send;
    transport.send = async (message, options) => {
      try {
        const logMessage = formatMcpMessageForLogging(message);
        logger.debug(`MCP message sent: ${logMessage}`, traceLogOpts(transport));
      } catch {
        logger.debug('MCP message sent: [Error formatting response]', LOG_MODULES.COMMUNICATION);
      }
      return await originalSend.call(transport, message, options);
    };
  }
}

/**
 * Initializes the global transport layer.
 * With stateful session-based transport, this is a no-op.
 * Kept for backward compatibility with app.ts startup sequence.
 */
export function initGlobalTransport(): void {
  if (getGatewayDebugSetting()) {
    logger.debug('Global transport layer initialized (stateful session mode)', LOG_MODULES.GATEWAY);
  }
}

/**
 * Creates a new MCP transport and server instance for a single request (stateless mode).
 * Each call returns isolated instances that should be GC'd after the request completes.
 * This restores the v1.3.0 per-request transport pattern for clients like CherryStudio
 * that do not properly support stateful sessions.
 */
export async function createPerRequestTransport(): Promise<{
  transport: StreamableHTTPServerTransport;
  server: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer;
}> {
  const transport = new StreamableHTTPServerTransport();
  const server = gateway.createConnectionServer();
  setupTransportLogging(transport);
  await server.connect(transport);

  if (getGatewayDebugSetting()) {
    logger.debug('MCP per-request transport initialized (stateless mode)', LOG_MODULES.GATEWAY);
  }

  return { transport, server };
}
