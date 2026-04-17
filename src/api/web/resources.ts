import { FastifyInstance } from 'fastify';
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

        // Use hubToolsService.readResource to handle Hub URI -> MCP URI conversion
        // This properly maps hub://servers/{name}/{instanceIndex}/{mcpPath} to MCP native URI
        try {
          const result = await hubToolsService.readResource(uri);

          // Check if result is already in MCP ReadResourceResult format { contents: [...] }
          if (result && typeof result === 'object' && 'contents' in result) {
            return result;
          }

          // Wrap non-MCP format results into { contents: [...] } format
          // This handles: ServerMetadata, Tool[], Resource[], string (use-guide), etc.
          let mimeType = 'application/json';
          let text: string;

          if (typeof result === 'string') {
            mimeType = 'text/markdown';
            text = result;
          } else {
            mimeType = 'application/json';
            text = JSON.stringify(result, null, 2);
          }

          return {
            contents: [
              {
                uri,
                mimeType,
                text
              }
            ]
          };
        } catch (error: unknown) {
          const errorObj = error as Error;
          if (
            errorObj.message.includes('not found') ||
            errorObj.message.includes('not connected')
          ) {
            return reply.code(404).send({ error: errorObj.message });
          }
          return reply.code(500).send({ error: errorObj.message });
        }
      } catch (error: unknown) {
        const errorObj = error as Error;
        return reply.code(500).send({ error: errorObj.message || 'Failed to read resource' });
      }
    }
  );

  fastify.get('/web/resources', async (_request, reply) => {
    try {
      // Return only Hub System resources (dynamically generated hub:// format)
      const systemResources = await hubToolsService.listResources();

      const resources: Record<string, Resource[]> = {};

      if (systemResources && systemResources.length > 0) {
        resources[MCP_HUB_LITE_SERVER] = systemResources;
      }

      return { resources };
    } catch (error: unknown) {
      const errorObj = error as Error;
      return reply.code(500).send({ error: errorObj.message || 'Failed to fetch resources' });
    }
  });
}
