import { FastifyInstance } from 'fastify';

/**
 * Health Check API Routes
 *
 * Provides system health monitoring endpoints to verify the operational status of the MCP Hub Lite service.
 * These endpoints are essential for infrastructure monitoring, load balancers, and service discovery systems.
 *
 * The health check returns a simple status indicator along with a timestamp to verify that the service
 * is responding correctly and can handle incoming requests.
 *
 * @param fastify - The Fastify instance to register routes on
 * @returns Promise that resolves when all routes are registered
 *
 * @example
 * ```typescript
 * // Register health check routes
 * await webHealthRoutes(app);
 * ```
 */
export async function webHealthRoutes(fastify: FastifyInstance) {
  // GET /web/health
  fastify.get('/web/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}
