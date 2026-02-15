/**
 * WebSocket route handler
 * Registers WebSocket endpoints and creates connection manager instances
 */

import type { FastifyInstance } from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import { WebSocketHandler } from './ws-handler.js';
import { eventBus } from '@services/event-bus.service.js';
import { logger } from '@utils/logger.js';

/**
 * WebSocket route configuration
 */
export async function webSocketRoutes(fastify: FastifyInstance): Promise<void> {
  // Register WebSocket plugin
  await fastify.register(fastifyWebSocket);

  // Register WebSocket routes
  fastify.register(async function (fastify) {
    // WebSocket endpoint: /ws
    fastify.get('/ws', { websocket: true }, (socket, request) => {
      logger.info(`connection established from ${request.ip}`, { subModule: 'WebSocket' });

      const handler = new WebSocketHandler(socket, eventBus);
      handler.initialize();
    });
  });

  logger.info('WebSocket routes registered', { subModule: 'WebSocket' });
}
