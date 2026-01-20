/**
 * 配置管理API
 * 提供配置的GET/PUT/导入/导出接口
 */

import { FastifyInstance } from 'fastify';
import { configManager } from '../../config/config-manager.js';

export async function configRoutes(fastify: FastifyInstance) {
  // GET /web/config - 获取当前配置
  fastify.get('/web/config', async (_request, reply) => {
    try {
      const config = configManager.getConfig();
      return reply.send(config);
    } catch (error: any) {
      return reply.code(500).send({
        error: 'Failed to get configuration',
        message: error.message
      });
    }
  });

  // PUT /web/config - 更新完整配置
  fastify.put('/web/config', async (request, reply) => {
    try {
      const newConfig = request.body as any;
      await configManager.updateConfig(newConfig);
      return reply.send({ success: true, message: 'Configuration updated successfully' });
    } catch (error: any) {
      return reply.code(500).send({
        error: 'Failed to update configuration',
        message: error.message
      });
    }
  });

  // POST /web/config/export - 导出配置
  fastify.post('/web/config/export', async (_request, reply) => {
    try {
      const config = configManager.getConfig();
      reply.header('Content-Disposition', 'attachment; filename=mcp-hub-config.json');
      reply.header('Content-Type', 'application/json');
      return reply.send(JSON.stringify(config, null, 2));
    } catch (error: any) {
      return reply.code(500).send({
        error: 'Failed to export configuration',
        message: error.message
      });
    }
  });

  // POST /web/config/import - 导入配置
  fastify.post('/web/config/import', async (request, reply) => {
    try {
      const importedConfig = request.body as any;
      await configManager.updateConfig(importedConfig);
      return reply.send({ success: true, message: 'Configuration imported successfully' });
    } catch (error: any) {
      return reply.code(400).send({
        error: 'Failed to import configuration',
        message: error.message
      });
    }
  });

  // PATCH /web/config/servers - 批量更新服务器配置
  fastify.patch('/web/config/servers', async (request, reply) => {
    try {
      const { servers } = request.body as any;
      const config = configManager.getConfig();
      config.servers = servers;
      await configManager.updateConfig(config);
      return reply.send({ success: true, message: 'Servers configuration updated' });
    } catch (error: any) {
      return reply.code(500).send({
        error: 'Failed to update servers configuration',
        message: error.message
      });
    }
  });
}
