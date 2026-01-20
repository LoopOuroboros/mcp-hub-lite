import { FastifyInstance } from 'fastify';
import { searchCoreService } from '../../services/search/search-core.service.js';
import type { SearchOptions } from '../../services/search/types.js';

/**
 * Web API routes for tool search
 * Endpoint under /web/search
 */
export async function webSearchRoutes(fastify: FastifyInstance) {
  // GET /web/search - Search for tools with query and optional filters
  fastify.get<{
    Querystring: {
      q: string;
      serverId?: string;
      tags?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  }>('/web/search', async (request, reply) => {
    const { q, serverId, tags, status, limit, offset } = request.query;

    // Parse search options
    const options: Partial<SearchOptions> = {
      mode: 'fuzzy',
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      filters: {}
    };

    if (serverId) {
      options.filters!.serverId = serverId;
    }

    if (tags) {
      const tagPairs = tags.split(',').map(pair => pair.trim());
      options.filters!.tags = {};
      tagPairs.forEach(pair => {
        const [key, value] = pair.split(':');
        if (key && value) {
          options.filters!.tags![key.trim()] = value.trim();
        }
      });
    }

    if (status) {
      options.filters!.status = status.split(',').map(s => s.trim() as 'online' | 'offline' | 'error');
    }

    // Perform search
    const results = await searchCoreService.search(q || '', options);

    return {
      results,
      pagination: {
        total: results.length,
        limit: options.limit,
        offset: options.offset,
        hasMore: results.length >= options.limit!
      },
      metadata: {
        query: q,
        filters: options.filters,
        processingTime: 0, // To be implemented: measure processing time
        cached: false     // To be implemented: check cache status
      }
    };
  });

  // GET /web/search/health - Search service health check (for monitoring)
  fastify.get('/web/search/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'search-core-service'
    };
  });
}