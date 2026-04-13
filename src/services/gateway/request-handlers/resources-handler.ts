/**
 * Resources-related request handlers for Gateway service.
 */

import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '@utils/index.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';
import { stringifyForLogging } from '@utils/json-utils.js';
import { hubToolsService } from '@services/hub-tools.service.js';

/**
 * Register resources-related handlers on the MCP server.
 *
 * @param server - MCP server instance to register handlers on
 */
export function registerResourcesHandlers(server: McpServer): void {
  server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const resources = await hubToolsService.listResources();
      return { resources };
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(`List resources error:`, error, LOG_MODULES.RESOURCES_HANDLER);
        throw new McpError(-32802, error.message);
      } else {
        logger.error(`List resources error:`, error, LOG_MODULES.RESOURCES_HANDLER);
        throw new McpError(-32802, String(error));
      }
    }
  });

  server.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const { uri } = request.params;
      const content = await hubToolsService.readResource(uri);
      // Convert to official MCP format: contents array with required uri field
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: typeof content === 'string' ? content : stringifyForLogging(content)
          }
        ]
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(`Read resource error:`, error, LOG_MODULES.RESOURCES_HANDLER);
        throw new McpError(-32802, error.message);
      } else {
        logger.error(`Read resource error:`, error, LOG_MODULES.RESOURCES_HANDLER);
        throw new McpError(-32802, String(error));
      }
    }
  });
}
