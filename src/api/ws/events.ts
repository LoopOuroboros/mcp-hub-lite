/**
 * WebSocket Event Routes
 *
 * Registers WebSocket endpoints for real-time event communication between the MCP Hub Lite server and connected clients.
 * This module sets up the WebSocket infrastructure using the @fastify/websocket plugin and creates connection
 * handlers for managing client connections and message routing.
 *
 * The WebSocket API enables bidirectional communication for real-time updates including:
 * - Server status changes
 * - Tool and resource updates
 * - Log entries and system events
 * - Configuration changes
 * - Client connection/disconnection events
 *
 * Clients can subscribe to specific event types and receive live updates without polling,
 * providing an efficient and responsive user experience for monitoring and managing the MCP ecosystem.
 *
 * @param fastify - The Fastify instance to register routes on
 * @returns Promise that resolves when WebSocket routes are registered
 *
 * @example
 * ```typescript
 * // Register WebSocket routes
 * await webSocketRoutes(app);
 * ```
 */

import type { FastifyInstance } from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import { WebSocketHandler } from './ws-handler.js';
import { eventBus } from '@services/event-bus.service.js';
import { logger } from '@utils/logger.js';

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
