import { FastifyInstance } from 'fastify';
import { clientTrackerService } from '@services/client-tracker.service.js';
import { logger } from '@utils/logger.js';

/**
 * Registers web API routes for client management endpoints.
 *
 * This function sets up the HTTP routes that allow external clients to retrieve
 * information about currently connected clients tracked by the system. The client
 * tracking service maintains real-time information about all active connections,
 * including session details, client metadata, and connection status.
 *
 * Primary Use Cases:
 * - Monitoring dashboard to display active client connections
 * - Debugging and diagnostics for client connectivity issues
 * - Integration with external monitoring systems
 * - Client lifecycle management and auditing
 *
 * The registered endpoint provides read-only access to client data and includes
 * proper error handling with appropriate HTTP status codes and logging.
 *
 * @param fastify - The Fastify instance to register routes on
 * @returns Promise<void> - Resolves when routes are registered
 *
 * @example
 * // Register client routes
 * await webClientRoutes(app);
 *
 * // Client can then make GET request to /api/clients
 * // Returns: Array of ClientContext objects with session and connection details
 */
export async function webClientRoutes(fastify: FastifyInstance) {
  fastify.get('/api/clients', async (_request, reply) => {
    try {
      const clients = clientTrackerService.getClients();
      return reply.send(clients);
    } catch (error) {
      logger.error('Failed to get clients:', error);
      return reply.code(500).send({ error: 'Failed to get clients' });
    }
  });
}
