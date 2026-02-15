import { FastifyInstance } from 'fastify';
import type { ServerStatus } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { logger } from '@utils/logger.js';

/**
 * Web API routes for MCP connection status
 * All endpoints under /web/mcp
 * HOT RELOAD TEST - This file should trigger restart when modified
 * Last modified: 2026-01-13 for hot reload testing
 */
export async function webMcpStatusRoutes(fastify: FastifyInstance) {
  // GET /web/mcp/status - Get status of all MCP servers
  fastify.get('/web/mcp/status', async (_request, reply) => {
    try {
      const servers = hubManager.getAllServers();
      const serverInstances = hubManager.getServerInstances();
      const statusList: Array<{ id: string; status: ServerStatus }> = [];

      servers.forEach(server => {
        const instances = serverInstances[server.name] || [];
        instances.forEach(instance => {
          statusList.push({
            id: instance.id || '',
            status: mcpConnectionManager.getStatus(instance.id || '') || {
              connected: false,
              lastCheck: Date.now(),
              toolsCount: 0,
              resourcesCount: 0,
              pid: undefined
            }
          });
        });
      });

      return statusList;
    } catch (error) {
      logger.error('Failed to get MCP status:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /web/mcp/servers/:id/connect - Connect to MCP server
  fastify.post<{ Params: { id: string } }>('/web/mcp/servers/:id/connect', async (request, reply) => {
    try {
      const server = hubManager.getServerById(request.params.id);
      if (!server) {
        return reply.code(404).send({ error: 'Server not found' });
      }

      const success = await mcpConnectionManager.connect({ ...server.config, ...server.instance });
      if (!success) {
        return reply.code(500).send({ error: 'Failed to connect to server' });
      }

      // Update enabled status in config - 现在 enabled 字段属于服务器配置，而非实例配置
      await hubManager.updateServer(server.name, { enabled: true });

      return { success: true };
    } catch (error) {
      logger.error('Failed to connect MCP server:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /web/mcp/servers/:id/disconnect - Disconnect from MCP server
  fastify.post<{ Params: { id: string } }>('/web/mcp/servers/:id/disconnect', async (request, reply) => {
    try {
      await mcpConnectionManager.disconnect(request.params.id);

      // Update enabled status in config to ensure it doesn't show as "starting"
      // 现在 enabled 字段属于服务器配置，而非实例配置
      const server = hubManager.getServerById(request.params.id);
      if (server) {
        await hubManager.updateServer(server.name, { enabled: false });
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to disconnect MCP server:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /web/mcp/servers/:id/tools - Get tools for a specific server
  fastify.get<{ Params: { id: string } }>('/web/mcp/servers/:id/tools', async (request, reply) => {
    try {
      logger.info(`API request tools for server: ${request.params.id}`);
      const tools = mcpConnectionManager.getTools(request.params.id);
      return tools;
    } catch (error) {
      logger.error('Failed to get MCP tools:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /web/mcp/servers/:id/resources - Get resources for a specific server
  fastify.get<{ Params: { id: string } }>('/web/mcp/servers/:id/resources', async (request, reply) => {
    try {
      logger.info(`API request resources for server: ${request.params.id}`);
      const resources = mcpConnectionManager.getResources(request.params.id);
      return resources;
    } catch (error) {
      logger.error('Failed to get MCP resources:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}