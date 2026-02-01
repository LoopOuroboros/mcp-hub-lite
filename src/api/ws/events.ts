/**
 * WebSocket 路由处理器
 * 注册 WebSocket 端点并创建连接管理器实例
 */

import type { FastifyInstance } from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import { WebSocketHandler } from './ws-handler.js';
import { eventBus } from '@services/event-bus.service.js';
import { logger } from '@utils/logger.js';

/**
 * WebSocket 路由配置
 */
export async function webSocketRoutes(fastify: FastifyInstance): Promise<void> {
  // 注册 WebSocket 插件
  await fastify.register(fastifyWebSocket);

  // 注册 WebSocket 路由
  fastify.register(async function (fastify) {
    // WebSocket 端点：/ws
    fastify.get('/ws', { websocket: true }, (socket, request) => {
      logger.info(`connection established from ${request.ip}`, { subModule: 'WebSocket' });

      const handler = new WebSocketHandler(socket, eventBus);
      handler.initialize();
    });
  });

  console.log('WebSocket routes registered');
}
