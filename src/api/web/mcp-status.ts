import { FastifyInstance } from 'fastify';
import { hubManager } from '../../services/hub-manager.service.js';
import { mcpConnectionManager } from '../../services/mcp-connection-manager.js';
import { logger } from '../../utils/logger.js';

/**
 * Web API routes for MCP connection status
 * All endpoints under /web/mcp
 * HOT RELOAD TEST - This file should trigger restart when modified
 * Last modified: 2026-01-13 for hot reload testing
 */
export async function webMcpStatusRoutes(fastify: FastifyInstance) {
  // GET /web/mcp/status - Get status of all MCP servers
  fastify.get('/web/mcp/status', async (request, reply) => {
    try {
      const servers = hubManager.getAllServers();
      const statusList = servers.map(server => ({
        id: server.id || '',
        status: mcpConnectionManager.getStatus(server.id || '') || {
          connected: false,
          lastCheck: Date.now(),
          toolsCount: 0,
          resourcesCount: 0,
          pid: undefined
        }
      }));

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

      const success = await mcpConnectionManager.connect(server);
      if (!success) {
        return reply.code(500).send({ error: 'Failed to connect to server' });
      }

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