import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { logger, LOG_MODULES } from '@utils/logger/index.js';
import { getGatewayDebugSetting } from '@utils/json-utils.js';
import { MCP_HUB_LITE_SERVER } from '@models/system-tools.constants.js';
import { getAppVersion, getProtocolVersion } from '@utils/version.js';
import {
  InitializedNotificationSchema,
  InitializeRequestSchema,
  PingRequestSchema
} from './initialize.constants.js';

/**
 * Register initialize and ping handlers on the MCP server.
 *
 * @param server - MCP server instance to register handlers on
 */
export function registerInitializeHandlers(server: McpServer): void {
  server.server.setRequestHandler(InitializeRequestSchema, async (request) => {
    if (request.params?.clientInfo) {
      const { name, version } = request.params.clientInfo;
      const protocolVersion = request.params?.protocolVersion || getProtocolVersion();
      const clientCapabilities = request.params?.capabilities as ClientCapabilities | undefined;

      if (getGatewayDebugSetting()) {
        logger.debug(
          `Initialized client: Name=${name}, Version=${version}, ProtocolVersion=${protocolVersion}`,
          LOG_MODULES.GATEWAY
        );
      }

      if (getGatewayDebugSetting() && clientCapabilities?.roots) {
        logger.debug(`Client ${name} supports roots capability`, LOG_MODULES.GATEWAY);
      }
    }

    return {
      protocolVersion: getProtocolVersion(),
      serverInfo: {
        name: MCP_HUB_LITE_SERVER,
        version: getAppVersion()
      },
      capabilities: {
        tools: {
          list: true,
          execute: true
        },
        resources: {
          list: true,
          read: true
        },
        logging: {},
        experimental: {}
      }
    };
  });

  server.server.setRequestHandler(PingRequestSchema, async () => {
    return { pong: true };
  });

  server.server.setNotificationHandler(InitializedNotificationSchema, async (notification) => {
    if (getGatewayDebugSetting()) {
      logger.debug('Received initialized notification from client', LOG_MODULES.GATEWAY);
      logger.debug(
        `Initialized notification details: ${JSON.stringify(notification)}`,
        LOG_MODULES.GATEWAY
      );
    }
    try {
      // Process the notification
      if (getGatewayDebugSetting()) {
        logger.debug('Successfully processed initialized notification', LOG_MODULES.GATEWAY);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        `Error processing initialized notification: ${errorMessage}`,
        LOG_MODULES.GATEWAY
      );
      logger.error(
        `Notification that caused error: ${JSON.stringify(notification)}`,
        LOG_MODULES.GATEWAY
      );
      throw error; // Re-throw to see if this is the source of the problem
    }
  });
}
