import { FastifyInstance } from 'fastify';
import { simpleSearchService } from '../../services/simple-search.service.js';

/**
 * Web API routes for tool search
 * Endpoint under /web/search
 */
export async function webSearchRoutes(fastify: FastifyInstance) {
  // GET /web/search
  fastify.get<{ Querystring: { q: string } }>('/web/search', async (request, reply) => {
    const query = request.query.q || '';
    const results = simpleSearchService.search(query);
    return results;
  });
}