import { FastifyInstance } from 'fastify';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubToolsService } from '@services/hub-tools.service.js';
import { MCP_HUB_LITE_SERVER } from '@models/system-tools.constants.js';
import type { Resource } from '@shared-models/resource.model.js';

/**
 * MCP Resources API Routes
 *
 * Provides endpoints for discovering and accessing resources from connected MCP (Model Context Protocol) servers.
 * This module enables clients to list available resources across all servers and read specific resource content.
 *
 * The resources API handles both system-level resources (provided by MCP Hub Lite itself) and server-specific
 * resources from connected MCP servers. It provides a unified interface for resource discovery and access,
 * abstracting away the underlying server implementation details.
 *
 * Key features include:
 * - Cross-server resource listing with server categorization
 * - Resource content reading with proper URI handling
 * - System resource integration alongside server resources
 * - Error handling for disconnected or unavailable servers
 *
 * @param fastify - The Fastify instance to register routes on
 * @returns Promise that resolves when all routes are registered
 *
 * @example
 * ```typescript
 * // Register resource routes
 * await webResourceRoutes(app);
 * ```
 */
export async function webResourceRoutes(fastify: FastifyInstance) {
  // GET /web/servers/:name/resources/read
  fastify.get<{ Params: { name: string }; Querystring: { uri: string } }>(
    '/web/servers/:name/resources/read',
    async (request, reply) => {
      try {
        const { name } = request.params;
        const { uri } = request.query;

        if (!uri) {
          return reply.code(400).send({ error: 'URI is required' });
        }

        // Handle system resources (mcp-hub-lite)
        if (name === MCP_HUB_LITE_SERVER) {
          const content = await hubToolsService.readResource(uri);

          // Determine mimeType and format content appropriately
          let mimeType = 'application/json';
          let text: string;

          // Use-guide is markdown
          if (uri === 'hub://use-guide') {
            mimeType = 'text/markdown';
            text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
          } else {
            // Server metadata is JSON
            mimeType = 'application/json';
            text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
          }

          // Wrap content in MCP resource read format
          return {
            contents: [
              {
                uri,
                mimeType,
                text
              }
            ]
          };
        }

        // Find server ID
        const serverId = mcpConnectionManager.getServerIdByName(name);
        if (!serverId) {
          // Try using name directly as ID (unlikely but for robustness)
          if (mcpConnectionManager.getStatus(name)) {
            const result = await mcpConnectionManager.readResource(name, uri);
            return result;
          }
          return reply.code(404).send({ error: 'Server not connected or not found' });
        }

        const result = await mcpConnectionManager.readResource(serverId, uri);
        return result;
      } catch (error: unknown) {
        const errorObj = error as Error;
        return reply.code(500).send({ error: errorObj.message || 'Failed to read resource' });
      }
    }
  );

  fastify.get('/web/resources', async (_request, reply) => {
    try {
      const allResources = mcpConnectionManager.getAllResources();

      // Add Hub System resources
      const systemResources = await hubToolsService.listResources();

      const resources: Record<string, Resource[]> = {};

      // 1. Add Hub System resources first if they exist
      if (systemResources && systemResources.length > 0) {
        resources[MCP_HUB_LITE_SERVER] = systemResources;
      }

      // 2. Add other server resources, filtering out empty ones
      for (const [serverName, serverResources] of Object.entries(allResources)) {
        if (serverResources && serverResources.length > 0) {
          resources[serverName] = serverResources;
        }
      }

      return { resources };
    } catch (error: unknown) {
      const errorObj = error as Error;
      return reply.code(500).send({ error: errorObj.message || 'Failed to fetch resources' });
    }
  });
}
