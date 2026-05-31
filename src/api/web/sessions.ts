import { FastifyInstance } from 'fastify';
import { logger } from '@utils/logger/index.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';
import { sessionManager } from '@services/gateway/session-manager.js';

export async function webSessionsRoutes(fastify: FastifyInstance) {
  fastify.get('/web/sessions', async (_request, reply) => {
    try {
      const sessions = sessionManager.getAllSessions();
      return { sessions };
    } catch (error) {
      logger.error('Failed to retrieve sessions:', error, LOG_MODULES.GATEWAY);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
