/**
 * MCP transport factory for per-request transport instances.
 *
 * This module provides a factory function to create isolated MCP transport and server instances
 * for each HTTP request, ensuring proper state isolation between concurrent clients.
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { gateway } from './gateway.service.js';
import { logger, LOG_MODULES } from '@utils/logger/index.js';
import { stringifyForLogging, getMcpCommDebugSetting } from '@utils/json-utils.js';
import { formatMcpMessageForLogging, logNotificationMessage } from '@utils/logger/log-output.js';

/**
 * Creates a new MCP transport and server instance for a single request session.
 * Each call returns isolated instances that should be cleaned up after the request completes.
 *
 * @returns {Promise<{ transport: StreamableHTTPServerTransport, server: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }>}
 *          Object containing the transport and server instances
 */
export async function createSessionTransport() {
  const transport = new StreamableHTTPServerTransport();
  const server = gateway.createConnectionServer();

  // Set up message logging (use empty string for sessionId in per-request mode)
  transport.onmessage = (message) => {
    logger.debug(
      `Session transport onmessage called with: ${stringifyForLogging(message)}`,
      LOG_MODULES.GATEWAY
    );
    try {
      if (getMcpCommDebugSetting()) {
        const logMessage = formatMcpMessageForLogging(message);
        logger.debug(`MCP message received: ${logMessage}`, LOG_MODULES.COMMUNICATION);
      }
      logNotificationMessage(message, ''); // Empty sessionId for per-request
      logger.debug(`Session transport onmessage completed successfully`, LOG_MODULES.GATEWAY);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        `Error in session transport onmessage handler: ${errorMessage}`,
        LOG_MODULES.GATEWAY
      );
      logger.error(
        `Message that caused error: ${stringifyForLogging(message)}`,
        LOG_MODULES.GATEWAY
      );
    }
  };

  // Wrap send method for debug logging
  if (getMcpCommDebugSetting()) {
    const originalSend = transport.send;
    transport.send = async (message, options) => {
      try {
        const logMessage = formatMcpMessageForLogging(message);
        logger.debug(`MCP message sent: ${logMessage}`, LOG_MODULES.COMMUNICATION);
      } catch {
        logger.debug(`MCP message sent: [Error formatting response]`, LOG_MODULES.COMMUNICATION);
      }
      return await originalSend.call(transport, message, options);
    };
  }

  // Connect server to transport
  logger.debug('About to connect session server to transport', LOG_MODULES.GATEWAY);
  try {
    await server.connect(transport);
    logger.info('MCP session transport initialized (per-request mode)', LOG_MODULES.GATEWAY);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      `Failed to connect session server to transport: ${errorMessage}`,
      LOG_MODULES.GATEWAY
    );
    logger.error(
      `Transport connection error details: ${stringifyForLogging(error)}`,
      LOG_MODULES.GATEWAY
    );
    throw error;
  }

  return { transport, server };
}
