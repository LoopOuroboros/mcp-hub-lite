import { FastifyInstance } from 'fastify';
import { MCP_HUB_LITE_SERVER } from '@shared-models/constants.js';

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
      const serverName = descMatch ? descMatch[1] : MCP_HUB_LITE_SERVER;

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
