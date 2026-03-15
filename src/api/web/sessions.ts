import { FastifyInstance } from 'fastify';
import { mcpSessionManager } from '@services/mcp-session-manager.js';
import { logger, LOG_MODULES } from '@utils/logger.js';

/**
 * Session Management API Routes
 *
 * Provides comprehensive session management endpoints for the MCP Hub Lite system's persistent session storage.
 * This module enables administrators and clients to monitor, inspect, and manage active and persisted sessions
 * that maintain client connection state across service restarts.
 *
 * Sessions store critical client context including connection metadata, working directories, project information,
 * and other state that enables seamless reconnection and continuity of operations. The session persistence
 * feature ensures that client connections can be restored even after service interruptions.
 *
 * Key features include:
 * - Listing all persisted sessions with metadata
 * - Detailed session inspection by session ID
 * - Session deletion for cleanup and maintenance
 * - Integration with the MCP session manager for consistency
 *
 * @param fastify - The Fastify instance to register routes on
 * @returns Promise that resolves when all routes are registered
 *
 * @example
 * ```typescript
 * // Register session management routes
 * await webSessionRoutes(app);
 * ```
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
      logger.error('Failed to get sessions:', error, LOG_MODULES.SESSION_API);
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
        logger.error('Failed to get session:', error, LOG_MODULES.SESSION_API);
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
        logger.info(`Deleting session: ${sessionId}`, LOG_MODULES.SESSION_API);

        const existed = await mcpSessionManager.deleteSession(sessionId);

        if (!existed) {
          return reply.code(404).send({
            success: false,
            error: 'Session not found'
          });
        }

        logger.info(`Session deleted successfully: ${sessionId}`, LOG_MODULES.SESSION_API);

        return reply.send({
          success: true,
          message: 'Session deleted successfully'
        });
      } catch (error) {
        logger.error('Failed to delete session:', error, LOG_MODULES.SESSION_API);
        return reply.code(500).send({
          success: false,
          error: 'Failed to delete session'
        });
      }
    }
  );
}
