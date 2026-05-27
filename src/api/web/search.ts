import { FastifyInstance } from 'fastify';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import type { ServerConfig } from '@config/config-manager.js';

/**
 * Filters tools by aggregatedTools configuration.
 * Only includes tools from servers that have aggregatedTools configured
 * AND the tool is in that list.
 */
export function filterByAggregatedTools(
  tools: Array<{ name: string; description?: string; serverName: string }>,
  getServerConfig: (name: string) => ServerConfig | undefined
): Array<{ name: string; description?: string; serverName: string }> {
  return tools.filter((tool) => {
    const serverConfig = getServerConfig(tool.serverName);
    if (!serverConfig) return false;
    const aggregatedTools = serverConfig.template?.aggregatedTools;
    if (!aggregatedTools || aggregatedTools.length === 0) return false;
    return aggregatedTools.includes(tool.name);
  });
}

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

    // Filter by search query
    const queryMatched = allTools.filter((tool) => {
      if (!query) return true;
      const nameMatch = tool.name.toLowerCase().includes(query);
      const descMatch = tool.description?.toLowerCase().includes(query);
      return nameMatch || descMatch;
    });

    // Filter by aggregatedTools — only include tools from servers that have
    // aggregatedTools configured AND the tool is in that list
    const filtered = filterByAggregatedTools(queryMatched, (name) =>
      hubManager.getServerByName(name)
    );

    const results = filtered.slice(0, limit);

    return {
      results: results.map((tool) => ({
        name: tool.name,
        description: tool.description,
        serverName: tool.serverName
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
