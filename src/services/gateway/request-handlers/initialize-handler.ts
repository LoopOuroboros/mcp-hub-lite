/**
 * Initialize and ping request handlers for Gateway service.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { logger, LOG_MODULES } from '@utils/logger/index.js';
import { MCP_HUB_LITE_SERVER } from '@models/system-tools.constants.js';

/**
 * Register initialize and ping handlers on the MCP server.
 *
 * @param server - MCP server instance to register handlers on
 */
export function registerInitializeHandlers(server: McpServer): void {
  // MCP standard initialize handler
  const InitializeRequestSchema = z.object({
    method: z.literal('initialize'),
    params: z
      .object({
        clientInfo: z
          .object({
            name: z.string(),
            version: z.string(),
            mcpVersion: z.string().optional()
          })
          .optional(),
        capabilities: z
          .object({
            tools: z
              .object({
                list: z.boolean().optional(),
                execute: z.boolean().optional()
              })
              .optional(),
            roots: z
              .object({
                list: z.boolean().optional()
              })
              .optional(),
            experimental: z.record(z.string(), z.any()).optional()
          })
          .optional(),
        protocolVersion: z.string().optional()
      })
      .optional(),
    id: z.union([z.string(), z.number()]),
    jsonrpc: z.literal('2.0')
  });

  server.server.setRequestHandler(InitializeRequestSchema, async (request) => {
    if (request.params?.clientInfo) {
      const { name, version } = request.params.clientInfo;
      const protocolVersion = request.params?.protocolVersion || '2024-11-05';
      const clientCapabilities = request.params?.capabilities as ClientCapabilities | undefined;

      logger.info(
        `Initialized client: Name=${name}, Version=${version}, ProtocolVersion=${protocolVersion}`,
        LOG_MODULES.GATEWAY
      );

      if (clientCapabilities?.roots) {
        logger.debug(`Client ${name} supports roots capability`, LOG_MODULES.GATEWAY);
      }
    }

    return {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: MCP_HUB_LITE_SERVER,
        version: '1.0.0',
        mcpVersion: '2024-11-05'
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
        experimental: {}
      }
    };
  });

  // MCP standard ping handler
  const PingRequestSchema = z.object({
    method: z.literal('ping'),
    params: z.object({}).optional(),
    id: z.union([z.string(), z.number()]),
    jsonrpc: z.literal('2.0')
  });

  server.server.setRequestHandler(PingRequestSchema, async () => {
    return { pong: true }; // Response format compliant with MCP specification
  });

  // MCP initialized notification handler
  const InitializedNotificationSchema = z.object({
    method: z.literal('notifications/initialized'),
    params: z.any().optional(),
    jsonrpc: z.literal('2.0')
  });

  server.server.setNotificationHandler(InitializedNotificationSchema, async () => {
    logger.debug('Received initialized notification from client', LOG_MODULES.GATEWAY);
  });
}
