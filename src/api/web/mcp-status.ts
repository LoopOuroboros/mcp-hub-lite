import { FastifyInstance } from 'fastify';
import type { ServerStatus } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { logger } from '@utils/logger.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';
import { resolveInstanceConfig } from '@config/config-migrator.js';

/**
 * MCP Connection Status API Routes (v1.1 format)
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
      const statusList: Array<{
        id: string;
        name: string;
        type: string;
        status: ServerStatus;
      }> = [];

      servers.forEach((server) => {
        const instances = server.config.instances || [];

        // If no instances, add a default disconnected entry for this server
        if (instances.length === 0) {
          statusList.push({
            id: server.name,
            name: server.name,
            type: server.config.template.type,
            status: {
              connected: false,
              lastCheck: Date.now(),
              toolsCount: 0,
              resourcesCount: 0,
              pid: undefined
            }
          });
        } else {
          // Add status for each instance
          instances.forEach((instance) => {
            const resolvedConfig = resolveInstanceConfig(server.config, instance.id);
            statusList.push({
              id: instance.id || '',
              name: server.name,
              type: resolvedConfig?.type || server.config.template.type,
              status: mcpConnectionManager.getStatus(server.name, instance.index ?? 0) || {
                connected: false,
                lastCheck: Date.now(),
                toolsCount: 0,
                resourcesCount: 0,
                pid: undefined
              }
            });
          });
        }
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
        const serverInfo = hubManager.getServerById(request.params.id);
        if (!serverInfo) {
          return reply.code(404).send({ error: 'Server not found' });
        }

        const resolvedConfig = resolveInstanceConfig(serverInfo.config, serverInfo.instance.id);
        if (!resolvedConfig) {
          return reply.code(404).send({ error: 'Server instance configuration not found' });
        }

        // Create a compatible config object with required instance fields
        const connectConfig = {
          ...resolvedConfig,
          id: serverInfo.instance.id,
          timestamp: Date.now(),
          hash: '',
          pid: undefined,
          startTime: undefined,
          index: serverInfo.instance.index,
          displayName: serverInfo.instance.displayName
        };

        const instanceIndex = serverInfo.instance.index ?? 0;
        const success = await mcpConnectionManager.connect(
          serverInfo.name,
          instanceIndex,
          connectConfig
        );
        if (!success) {
          return reply.code(500).send({ error: 'Failed to connect to server' });
        }

        // Note: Do NOT update the instance's enabled field here.
        // The enabled field is a configuration parameter that should only be modified
        // by the user explicitly via the configuration panel.
        // Runtime connect/disconnect operations should not affect persistent configuration.

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
        const serverInfo = hubManager.getServerById(request.params.id);
        if (!serverInfo) {
          return reply.code(404).send({ error: 'Server not found' });
        }

        await mcpConnectionManager.disconnect(serverInfo.name, serverInfo.instance.index ?? 0);

        // Note: Do NOT update the instance's enabled field here.
        // The enabled field is a configuration parameter that should only be modified
        // by the user explicitly via the configuration panel.
        // Runtime connect/disconnect operations should not affect persistent configuration.

        return { success: true };
      } catch (error) {
        logger.error('Failed to disconnect MCP server:', error, LOG_MODULES.MCP_STATUS);
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // GET /web/mcp/servers/:name/tools - Get tools for a specific server
  fastify.get<{ Params: { name: string } }>(
    '/web/mcp/servers/:name/tools',
    async (request, reply) => {
      try {
        const serverName = request.params.name;
        logger.info(`API request tools for server: ${serverName}`, LOG_MODULES.MCP_STATUS);

        // Use getToolsByServerName which queries serverNameToolCache
        // This aggregates tools from all instances of the same server name
        const tools = mcpConnectionManager.getToolsByServerName(serverName);
        return tools;
      } catch (error) {
        logger.error('Failed to get MCP tools:', error, LOG_MODULES.MCP_STATUS);
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // GET /web/mcp/servers/:name/resources - Get resources for a specific server
  fastify.get<{ Params: { name: string } }>(
    '/web/mcp/servers/:name/resources',
    async (request, reply) => {
      try {
        const serverName = request.params.name;
        logger.info(`API request resources for server: ${serverName}`, LOG_MODULES.MCP_STATUS);

        // Use getResourcesByName which queries resourceCache by server name
        const resources = mcpConnectionManager.getResourcesByName(serverName);
        return resources;
      } catch (error) {
        logger.error('Failed to get MCP resources:', error, LOG_MODULES.MCP_STATUS);
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );
}
