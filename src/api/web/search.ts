import { FastifyInstance } from 'fastify';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';

/**
 * Tool Search API Routes
 *
 * Provides simple string-based search for discovering tools across all connected MCP servers.
 * Uses straightforward string matching on tool name and description.
 *
 * @param fastify - The Fastify instance to register routes on
 * @returns Promise that resolves when all routes are registered
 */
export async function webSearchRoutes(fastify: FastifyInstance) {
  // GET /web/search - Search for tools with simple string matching
  fastify.get<{
    Querystring: {
      q: string;
      limit?: number;
    };
  }>('/web/search', async (request) => {
    const { q, limit = 50 } = request.query;

    const allTools = mcpConnectionManager.getAllTools();
    const query = q?.toLowerCase() || '';

    const filtered = allTools.filter((tool) => {
      if (!query) return true;
      const nameMatch = tool.name.toLowerCase().includes(query);
      const descMatch = tool.description?.toLowerCase().includes(query);
      return nameMatch || descMatch;
    });

    const results = filtered.slice(0, limit);

    return {
      results: results.map((tool) => ({
        tool: {
          name: tool.name,
          description: tool.description,
          serverName: tool.serverName
        },
        score: 1
      })),
      pagination: {
        total: filtered.length,
        limit,
        returned: results.length
      },
      metadata: {
        query: q
      }
    };
  });
}
