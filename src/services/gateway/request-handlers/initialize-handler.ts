import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { logger, LOG_MODULES } from '@utils/logger/index.js';
import { getGatewayDebugSetting, stringifyForLogging } from '@utils/json-utils.js';
import { MCP_HUB_LITE_SERVER } from '@models/system-tools.constants.js';
import { getAppVersion, getProtocolVersion } from '@utils/version.js';
import { sessionManager } from '@services/gateway/session-manager.js';
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

      sessionManager.storePendingClientMetadata(server, {
        clientName: name,
        clientVersion: version,
        protocolVersion
      });

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
          execute: true,
          listChanged: true
        },
        resources: {
          list: true,
          read: true,
          listChanged: true
        },
        logging: {},
        experimental: {}
      },
      instructions:
        'MCP Hub Lite is a lightweight MCP gateway that aggregates multiple backend MCP servers into a unified interface. ' +
        'HOW TO USE: 1) Start with resources/list to discover available servers and the use guide. ' +
        '2) Use list_servers to see all connected servers. ' +
        '3) Preview a server’s tools via resources/read on hub://servers/{name}. ' +
        '4) Use list_tools for the full tool list, get_tool when you need inputSchema, then call_tool to execute. ' +
        '5) Use search_tools to find tools by name or description across all servers. ' +
        'MULTI-INSTANCE SERVERS: Use list_tags to view available instance tags, then pass matching tags via requestOptions.tags when calling call_tool. ' +
        'System tools (list_servers, list_tools, get_tool, call_tool, search_tools, list_tags, update_server_description) must be called directly, not through call_tool.'
    };
  });

  server.server.setRequestHandler(PingRequestSchema, async () => {
    return { pong: true };
  });

  server.server.setNotificationHandler(InitializedNotificationSchema, async (notification) => {
    if (getGatewayDebugSetting()) {
      logger.debug('Received initialized notification from client', LOG_MODULES.GATEWAY);
      logger.debug(
        `Initialized notification details: ${stringifyForLogging(notification)}`,
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
        `Notification that caused error: ${stringifyForLogging(notification)}`,
        LOG_MODULES.GATEWAY
      );
      throw error; // Re-throw to see if this is the source of the problem
    }
  });
}
