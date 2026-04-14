/**
 * System tools request handlers for Gateway service.
 */

import { z } from 'zod';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '@utils/index.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';
import { hubToolsService } from '@services/hub-tools.service.js';
import {
  LIST_SERVERS_TOOL,
  LIST_TOOLS_TOOL,
  GET_TOOL_TOOL,
  CALL_TOOL_TOOL,
  UPDATE_SERVER_DESCRIPTION_TOOL
} from '@models/system-tools.constants.js';

/**
 * Register system tools handlers on the MCP server.
 *
 * @param server - MCP server instance to register handlers on
 */
export function registerSystemToolsHandlers(server: McpServer): void {
  // List servers
  const ListServersRequestSchema = z.object({
    method: z.literal(LIST_SERVERS_TOOL),
    params: z.object({}).optional(),
    id: z.union([z.string(), z.number()]),
    jsonrpc: z.literal('2.0')
  });

  server.server.setRequestHandler(ListServersRequestSchema, async () => {
    const servers = await hubToolsService.listServers();
    return { servers };
  });

  // List all tools in a specific server
  const ListToolsInServerRequestSchema = z.object({
    method: z.literal(LIST_TOOLS_TOOL),
    params: z.object({
      serverName: z.string(),
      requestOptions: z
        .object({
          sessionId: z
            .union([z.string(), z.null()])
            .optional()
            .transform((val) => val ?? undefined),
          tags: z.record(z.string(), z.string()).optional()
        })
        .optional()
    }),
    id: z.union([z.string(), z.number()]),
    jsonrpc: z.literal('2.0')
  });

  server.server.setRequestHandler(ListToolsInServerRequestSchema, async (request) => {
    try {
      const result = await hubToolsService.listToolsInServer(request.params);
      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(`List tools in server error:`, error, LOG_MODULES.SYSTEM_TOOLS_HANDLER);
        throw new McpError(-32802, error.message);
      } else {
        logger.error(`List tools in server error:`, error, LOG_MODULES.SYSTEM_TOOLS_HANDLER);
        throw new McpError(-32802, String(error));
      }
    }
  });

  // Get tool
  const GetToolRequestSchema = z.object({
    method: z.literal(GET_TOOL_TOOL),
    params: z.object({
      serverName: z.string(),
      toolName: z.string(),
      requestOptions: z
        .object({
          sessionId: z
            .union([z.string(), z.null()])
            .optional()
            .transform((val) => val ?? undefined),
          tags: z.record(z.string(), z.string()).optional()
        })
        .optional()
    }),
    id: z.union([z.string(), z.number()]),
    jsonrpc: z.literal('2.0')
  });

  server.server.setRequestHandler(GetToolRequestSchema, async (request) => {
    try {
      const tool = await hubToolsService.getTool(request.params);

      if (!tool) {
        throw new McpError(
          -32801,
          `Tool "${request.params.toolName}" not found on server "${request.params.serverName}"`
        );
      }

      return { tool };
    } catch (error: unknown) {
      logger.error(`Get tool error:`, error, LOG_MODULES.SYSTEM_TOOLS_HANDLER);
      if (error instanceof McpError) {
        throw error;
      } else if (error instanceof Error) {
        throw new McpError(-32802, error.message);
      } else {
        throw new McpError(-32802, String(error));
      }
    }
  });

  // Call tool directly
  const CallToolDirectRequestSchema = z.object({
    method: z.literal(CALL_TOOL_TOOL),
    params: z.object({
      serverName: z.string(),
      toolName: z.string(),
      toolArgs: z.record(z.string(), z.unknown()),
      requestOptions: z
        .object({
          sessionId: z
            .union([z.string(), z.null()])
            .optional()
            .transform((val) => val ?? undefined),
          tags: z.record(z.string(), z.string()).optional()
        })
        .optional()
    }),
    id: z.union([z.string(), z.number()]),
    jsonrpc: z.literal('2.0')
  });

  server.server.setRequestHandler(CallToolDirectRequestSchema, async (request) => {
    try {
      const params = { ...request.params };

      const result = await hubToolsService.callTool(params);
      // Wrap the result in a valid CallToolResult structure
      if (typeof result === 'object' && result !== null) {
        return {
          content: [],
          ...result
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: String(result)
            }
          ]
        };
      }
    } catch (error: unknown) {
      logger.error(`Call tool error:`, error, LOG_MODULES.SYSTEM_TOOLS_HANDLER);
      if (error instanceof McpError) {
        throw error;
      } else if (error instanceof Error) {
        throw new McpError(-32802, error.message);
      } else {
        throw new McpError(-32802, String(error));
      }
    }
  });

  // List all tools from all servers
  const ListAllToolsRequestSchema = z.object({
    method: z.literal('list_all_tools'),
    params: z.object({}).optional(),
    id: z.union([z.string(), z.number()]),
    jsonrpc: z.literal('2.0')
  });

  server.server.setRequestHandler(ListAllToolsRequestSchema, async () => {
    const allTools = await hubToolsService.listAllTools();
    return allTools;
  });

  // Update server description
  const UpdateServerDescriptionRequestSchema = z.object({
    method: z.literal(UPDATE_SERVER_DESCRIPTION_TOOL),
    params: z.object({
      serverName: z.string(),
      description: z.string()
    }),
    id: z.union([z.string(), z.number()]),
    jsonrpc: z.literal('2.0')
  });

  server.server.setRequestHandler(UpdateServerDescriptionRequestSchema, async (request) => {
    try {
      const result = await hubToolsService.updateServerDescription(request.params);
      return result;
    } catch (error: unknown) {
      logger.error(`Update server description error:`, error, LOG_MODULES.SYSTEM_TOOLS_HANDLER);
      if (error instanceof McpError) {
        throw error;
      } else if (error instanceof Error) {
        throw new McpError(-32802, error.message);
      } else {
        throw new McpError(-32802, String(error));
      }
    }
  });
}
