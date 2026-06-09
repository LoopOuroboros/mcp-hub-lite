import { FastifyInstance } from 'fastify';
import { MCP_HUB_LITE_SERVER } from '@shared-models/constants.js';
import { countMatchingTokens } from '@utils/search-matcher.js';

/**
 * Tool Search API Routes
 *
 * Returns aggregated tools from the gateway cache with wrapped inputSchema
 * (including serverName, toolName, toolArgs, and requestOptions fields).
 * Uses tokenized matching on tool name and description, sorted by match count.
 *
 * @param fastify - The Fastify instance to register routes on
 * @returns Promise that resolves when all routes are registered
 */
export async function webSearchRoutes(fastify: FastifyInstance) {
  // GET /web/search - Search for tools with tokenized matching
  fastify.get<{
    Querystring: {
      q: string;
      limit?: number;
    };
  }>('/web/search', async (request) => {
    const { q, limit = 5 } = request.query;
    const effectiveLimit = Math.min(Math.max(1, limit), 10);

    // Dynamic import to avoid circular dependency at module init time
    const { getExternalGatewayTools } = await import('@services/gateway/tool-list-generator.js');
    const gatewayTools = getExternalGatewayTools();
    const query = q?.toLowerCase() || '';

    // Score, filter, sort, and slice by token match count
    const scored = gatewayTools
      .map((tool) => {
        if (!query) return { tool, matchCount: Number.MAX_SAFE_INTEGER };
        const matchCount = countMatchingTokens(query, [tool.name, tool.description || '']);
        return { tool, matchCount };
      })
      .filter((item) => item.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, effectiveLimit);

    const results = scored.map(({ tool }) => {
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

    return {
      results,
      pagination: {
        total: results.length,
        limit: effectiveLimit,
        returned: results.length
      },
      metadata: {
        query: q
      }
    };
  });
}
