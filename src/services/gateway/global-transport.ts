/**
 * Global stateless MCP transport and server.
 *
 * This module provides a shared, stateless MCP transport and server instance
 * that can be used across all requests without session isolation.
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { gateway } from './gateway.service.js';
import { logger, LOG_MODULES } from '@utils/logger/index.js';
import { getMcpCommDebugSetting } from '@utils/json-utils.js';
import { formatMcpMessageForLogging, logNotificationMessage } from '@utils/logger/log-output.js';

// Create shared transport in STATELESS MODE - NO PARAMETERS NEEDED!
const transport = new StreamableHTTPServerTransport();

// Create shared server
const server = gateway.createConnectionServer();

// Set up message logging (use empty string for sessionId in stateless mode)
transport.onmessage = (message) => {
  if (getMcpCommDebugSetting()) {
    const logMessage = formatMcpMessageForLogging(message);
    logger.debug(`MCP message received: ${logMessage}`, LOG_MODULES.COMMUNICATION);
  }
  logNotificationMessage(message, ''); // Empty sessionId for stateless
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
await server.connect(transport);

logger.info('Global MCP transport initialized (stateless mode)', LOG_MODULES.GATEWAY);

export const globalTransport = transport;
export const globalServer = server;
