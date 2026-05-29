/**
 * MCP transport utilities — stateful session-based mode.
 *
 * Each client session owns a StreamableHTTPServerTransport + McpServer pair.
 * SDK's stateful mode (sessionIdGenerator) handles SSE stream setup and session management.
 * Notifications are broadcast via SessionManager across all active sessions.
 */

import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger, LOG_MODULES } from '@utils/logger/index.js';
import {
  stringifyForLogging,
  getMcpCommDebugSetting,
  getGatewayDebugSetting
} from '@utils/json-utils.js';
import { formatMcpMessageForLogging, logNotificationMessage } from '@utils/logger/log-output.js';

/**
 * Sets up debug logging on a transport instance.
 */
export function setupTransportLogging(transport: StreamableHTTPServerTransport): void {
  transport.onmessage = (message) => {
    try {
      if (getMcpCommDebugSetting()) {
        logger.debug(
          `Transport onmessage: ${stringifyForLogging(message)}`,
          LOG_MODULES.COMMUNICATION
        );
        const logMessage = formatMcpMessageForLogging(message);
        logger.debug(`MCP message received: ${logMessage}`, LOG_MODULES.COMMUNICATION);
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
        logger.debug(`MCP message sent: ${logMessage}`, LOG_MODULES.COMMUNICATION);
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
