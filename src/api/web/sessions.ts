import { FastifyInstance } from 'fastify';
import { mcpSessionManager } from '@services/mcp-session-manager.js';
import { logger } from '@utils/logger.js';

/**
 * Session Management API Routes
 *
 * Routes:
 * - GET /web/sessions - List all persisted sessions
 * - GET /web/sessions/:sessionId - Get session details
 * - DELETE /web/sessions/:sessionId - Delete a session
 */
export async function webSessionRoutes(fastify: FastifyInstance) {
  /**
   * List all persisted sessions
   */
  fastify.get('/web/sessions', async (_request, reply) => {
    try {
      const sessions = mcpSessionManager.getAllSessionStates();
      return reply.send({
        success: true,
        data: sessions,
        count: sessions.length
      });
    } catch (error) {
      logger.error('Failed to get sessions:', error, { subModule: 'Session API' });
      return reply.code(500).send({
        success: false,
        error: 'Failed to get sessions'
      });
    }
  });

  /**
   * Get a specific session by ID
   */
  fastify.get<{ Params: { sessionId: string } }>(
    '/web/sessions/:sessionId',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const session = mcpSessionManager.getSessionState(sessionId);

        if (!session) {
          return reply.code(404).send({
            success: false,
            error: 'Session not found'
          });
        }

        return reply.send({
          success: true,
          data: session
        });
      } catch (error) {
        logger.error('Failed to get session:', error, { subModule: 'Session API' });
        return reply.code(500).send({
          success: false,
          error: 'Failed to get session'
        });
      }
    }
  );

  /**
   * Delete a session
   */
  fastify.delete<{ Params: { sessionId: string } }>(
    '/web/sessions/:sessionId',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;
        logger.info(`Deleting session: ${sessionId}`, { subModule: 'Session API' });

        const existed = await mcpSessionManager.deleteSession(sessionId);

        if (!existed) {
          return reply.code(404).send({
            success: false,
            error: 'Session not found'
          });
        }

        logger.info(`Session deleted successfully: ${sessionId}`, { subModule: 'Session API' });

        return reply.send({
          success: true,
          message: 'Session deleted successfully'
        });
      } catch (error) {
        logger.error('Failed to delete session:', error, { subModule: 'Session API' });
        return reply.code(500).send({
          success: false,
          error: 'Failed to delete session'
        });
      }
    }
  );
}
