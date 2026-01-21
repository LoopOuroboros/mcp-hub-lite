import { FastifyInstance } from 'fastify';
import { clientTrackerService } from '../../services/client-tracker.service.js';
import { logger } from '../../utils/logger.js';

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
