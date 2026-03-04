import { FastifyInstance } from 'fastify';
import type { ServerStatus } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { logger } from '@utils/logger.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';

/**
 * MCP Connection Status API Routes
 *
 * Provides real-time monitoring and management endpoints for MCP (Model Context Protocol) server connections.
 * This module enables administrators to check the health of connected servers, manage connection states,
 * and retrieve server capabilities including available tools and resources.
 *
 * The status API provides comprehensive information about each connected MCP server including:
 * - Connection status (connected/disconnected)
 * - Server performance metrics
 * - Available tools and resources count
 * - Process information (PID, start time)
 * - Error conditions and recovery status
 *
 * Additionally, it provides active connection management capabilities to connect/disconnect
 * servers programmatically, making it suitable for automated infrastructure management.
 *
 * @param fastify - The Fastify instance to register routes on
 * @returns Promise that resolves when all routes are registered
 *
 * @example
 * ```typescript
 * // Register MCP status routes
 * await webMcpStatusRoutes(app);
 * ```
 */
export async function webMcpStatusRoutes(fastify: FastifyInstance) {
  // GET /web/mcp/status - Get status of all MCP servers
  fastify.get('/web/mcp/status', async (_request, reply) => {
    try {
      const servers = hubManager.getAllServers();
      const serverInstances = hubManager.getServerInstances();
      const statusList: Array<{
        id: string;
        name: string;
        type: string;
        status: ServerStatus;
      }> = [];

      servers.forEach((server) => {
        const instances = serverInstances[server.name] || [];
        instances.forEach((instance) => {
          statusList.push({
            id: instance.id || '',
            name: server.name,
            type: server.config.type,
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
      logger.error('Failed to get MCP status:', error, LOG_MODULES.MCP_STATUS);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /web/mcp/servers/:id/connect - Connect to MCP server
  fastify.post<{ Params: { id: string } }>(
    '/web/mcp/servers/:id/connect',
    async (request, reply) => {
      try {
        const server = hubManager.getServerById(request.params.id);
        if (!server) {
          return reply.code(404).send({ error: 'Server not found' });
        }

        const success = await mcpConnectionManager.connect({
          ...server.config,
          ...server.instance
        });
        if (!success) {
          return reply.code(500).send({ error: 'Failed to connect to server' });
        }

        // Update enabled status in config - The enabled field now belongs to server configuration, not instance configuration
        await hubManager.updateServer(server.name, { enabled: true });

        return { success: true };
      } catch (error) {
        logger.error('Failed to connect MCP server:', error, LOG_MODULES.MCP_STATUS);
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // POST /web/mcp/servers/:id/disconnect - Disconnect from MCP server
  fastify.post<{ Params: { id: string } }>(
    '/web/mcp/servers/:id/disconnect',
    async (request, reply) => {
      try {
        await mcpConnectionManager.disconnect(request.params.id);

        // Update enabled status in config to ensure it doesn't show as "starting"
        // The enabled field now belongs to server configuration, not instance configuration
        const server = hubManager.getServerById(request.params.id);
        if (server) {
          await hubManager.updateServer(server.name, { enabled: false });
        }

        return { success: true };
      } catch (error) {
        logger.error('Failed to disconnect MCP server:', error, LOG_MODULES.MCP_STATUS);
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // GET /web/mcp/servers/:id/tools - Get tools for a specific server
  fastify.get<{ Params: { id: string } }>('/web/mcp/servers/:id/tools', async (request, reply) => {
    try {
      logger.info(`API request tools for server: ${request.params.id}`, LOG_MODULES.MCP_STATUS);
      const tools = mcpConnectionManager.getTools(request.params.id);
      return tools;
    } catch (error) {
      logger.error('Failed to get MCP tools:', error, LOG_MODULES.MCP_STATUS);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /web/mcp/servers/:id/resources - Get resources for a specific server
  fastify.get<{ Params: { id: string } }>(
    '/web/mcp/servers/:id/resources',
    async (request, reply) => {
      try {
        logger.info(
          `API request resources for server: ${request.params.id}`,
          LOG_MODULES.MCP_STATUS
        );
        const resources = mcpConnectionManager.getResources(request.params.id);
        return resources;
      } catch (error) {
        logger.error('Failed to get MCP resources:', error, LOG_MODULES.MCP_STATUS);
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );
}
