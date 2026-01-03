import { FastifyInstance } from 'fastify';

/**
 * Web API routes for health checks
 * Endpoints under /web/health
 */
export async function webHealthRoutes(fastify: FastifyInstance) {
  // GET /web/health
  fastify.get('/web/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}