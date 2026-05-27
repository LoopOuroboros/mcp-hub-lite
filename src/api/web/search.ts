import { FastifyInstance } from 'fastify';
import type { ServerConfig } from '@config/config-manager.js';
import type { Tool } from '@shared-models/tool.model.js';

/**
 * Filters tools by aggregatedTools configuration.
 * Only includes tools from servers that have aggregatedTools configured
 * AND the tool is in that list.
 *
 * NOTE: This function is retained for backward compatibility and testing.
 * The /web/search endpoint now uses gateway cache directly.
 */
export function filterByAggregatedTools(
  tools: Tool[],
  getServerConfig: (name: string) => ServerConfig | undefined
): Tool[] {
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
 * Returns aggregated tools from the gateway cache with wrapped inputSchema
 * (including serverName, toolName, toolArgs, and requestOptions fields).
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

    // Dynamic import to avoid circular dependency at module init time
    const { getExternalGatewayTools } = await import('@services/gateway/tool-list-generator.js');
    const gatewayTools = getExternalGatewayTools();
    const query = q?.toLowerCase() || '';

    // Filter by search query
    const queryMatched = gatewayTools.filter((tool) => {
      if (!query) return true;
      // Match against tool name (gateway-resolved name)
      const nameMatch = tool.name.toLowerCase().includes(query);
      // Match against description (contains "[From serverName] original description")
      const descMatch = tool.description?.toLowerCase().includes(query);
      return nameMatch || descMatch;
    });

    const mappedResults = queryMatched.map((tool) => {
      // Extract serverName from description format "[From serverName] ..."
      const descMatch = tool.description?.match(/^\[From\s+(.+?)\]/);
      const serverName = descMatch ? descMatch[1] : 'mcp-hub-lite';

      return {
        name: tool.name,
        description: tool.description,
        serverName,
        inputSchema: tool.inputSchema
      };
    });

    const results = mappedResults.slice(0, limit);

    return {
      results,
      pagination: {
        total: mappedResults.length,
        limit,
        returned: results.length
      },
      metadata: {
        query: q
      }
    };
  });
}
