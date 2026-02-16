/**
 * Configuration Management API Routes
 *
 * This module provides comprehensive configuration management endpoints for the MCP Hub Lite system.
 * It handles reading, updating, importing, exporting, and batch operations for system configuration.
 *
 * The configuration includes server definitions, system settings, and other runtime parameters
 * that control the behavior of the MCP Hub Lite service.
 *
 * @param fastify - The Fastify instance to register routes on
 * @returns Promise that resolves when all routes are registered
 *
 * @example
 * ```typescript
 * // Register configuration management routes
 * await configRoutes(app);
 * ```
 */

import { FastifyInstance } from 'fastify';
import { configManager } from '@config/config-manager.js';
import type { SystemConfig, ServerConfig } from '@config/config-manager.js';
import { eventBus, EventTypes } from '@services/event-bus.service.js';

interface ServersUpdateRequest {
  servers: Record<string, ServerConfig>;
}

export async function configRoutes(fastify: FastifyInstance) {
  // GET /web/config - Get current configuration
  fastify.get('/web/config', async (_request, reply) => {
    try {
      const config = configManager.getConfig();
      return reply.send(config);
    } catch (error: unknown) {
      const errorObj = error as Error;
      return reply.code(500).send({
        error: 'Failed to get configuration',
        message: errorObj.message
      });
    }
  });

  // PUT /web/config - Update complete configuration
  fastify.put<{ Body: SystemConfig }>('/web/config', async (request, reply) => {
    try {
      const newConfig = request.body;
      await configManager.updateConfig(newConfig);

      // Publish configuration update event
      eventBus.publish(EventTypes.CONFIGURATION_UPDATED, {
        timestamp: Date.now(),
        config: newConfig
      });

      return reply.send({ success: true, message: 'Configuration updated successfully' });
    } catch (error: unknown) {
      const errorObj = error as Error;
      return reply.code(500).send({
        error: 'Failed to update configuration',
        message: errorObj.message
      });
    }
  });

  // POST /web/config/export - Export configuration
  fastify.post('/web/config/export', async (_request, reply) => {
    try {
      const config = configManager.getConfig();
      reply.header('Content-Disposition', 'attachment; filename=mcp-hub-config.json');
      reply.header('Content-Type', 'application/json');
      return reply.send(JSON.stringify(config));
    } catch (error: unknown) {
      const errorObj = error as Error;
      return reply.code(500).send({
        error: 'Failed to export configuration',
        message: errorObj.message
      });
    }
  });

  // POST /web/config/import - Import configuration
  fastify.post<{ Body: SystemConfig }>('/web/config/import', async (request, reply) => {
    try {
      const importedConfig = request.body;
      await configManager.updateConfig(importedConfig);

      // Publish configuration update event
      eventBus.publish(EventTypes.CONFIGURATION_UPDATED, {
        timestamp: Date.now(),
        config: importedConfig
      });

      return reply.send({ success: true, message: 'Configuration imported successfully' });
    } catch (error: unknown) {
      const errorObj = error as Error;
      return reply.code(400).send({
        error: 'Failed to import configuration',
        message: errorObj.message
      });
    }
  });

  // PATCH /web/config/servers - Batch update server configuration
  fastify.patch<{ Body: ServersUpdateRequest }>('/web/config/servers', async (request, reply) => {
    try {
      const { servers } = request.body;
      const config = configManager.getConfig();
      config.servers = servers;
      await configManager.updateConfig(config);

      // Publish configuration update event
      eventBus.publish(EventTypes.CONFIGURATION_UPDATED, {
        timestamp: Date.now(),
        config
      });

      return reply.send({ success: true, message: 'Servers configuration updated' });
    } catch (error: unknown) {
      const errorObj = error as Error;
      return reply.code(500).send({
        error: 'Failed to update servers configuration',
        message: errorObj.message
      });
    }
  });
}
