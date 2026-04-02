import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hubManager } from '@services/hub-manager.service.js';
import { ServerTemplateSchema, ServerInstanceUpdateSchema } from '@config/config.schema.js';
import type { ServerTemplate, ServerInstance } from '@config/config.schema.js';
import { InstanceSelectionStrategy } from '@shared-models/server.model.js';
import { logger } from '@utils/logger.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';
import { stringifyForLogging, getApiDebugSetting } from '@utils/json-utils.js';

interface BatchResultSuccess {
  name: string;
  config: Partial<ServerTemplate>;
}

/**
 * Server update schema that supports both template fields and server-level configuration fields
 */
const ServerUpdateSchema = ServerTemplateSchema.partial().extend({
  instanceSelectionStrategy: z
    .enum([
      InstanceSelectionStrategy.RANDOM,
      InstanceSelectionStrategy.ROUND_ROBIN,
      InstanceSelectionStrategy.TAG_MATCH_UNIQUE
    ])
    .optional()
});

/**
 * MCP Server Management API Routes (v1.1 format)
 *
 * Provides comprehensive CRUD (Create, Read, Update, Delete) operations for managing MCP (Model Context Protocol) servers
 * and their runtime instances within the MCP Hub Lite system. This module serves as the primary interface for
 * server configuration management, process control, and bulk operations.
 *
 * The API supports both static server template configuration and dynamic
 * instance management (controlling actual running server processes). It includes sophisticated validation
 * using Zod schemas to ensure configuration integrity and provides detailed error handling with appropriate
 * HTTP status codes.
 *
 * Key features include:
 * - Full CRUD operations for server templates
 * - Instance-level management for running server processes
 * - Batch import/export capabilities for server configurations
 * - Automatic server startup based on enabled status
 * - Comprehensive validation using Zod schemas
 * - Detailed error handling with appropriate HTTP status codes
 * - Support for multiple server types (stdio, sse, streamable-http)
 *
 * @param fastify - The Fastify instance to register routes on
 * @returns Promise that resolves when all routes are registered
 *
 * @example
 * ```typescript
 * // Register server management routes
 * await webServerRoutes(app);
 * ```
 */
export async function webServerRoutes(fastify: FastifyInstance) {
  // GET /web/servers
  fastify.get('/web/servers', async () => {
    return hubManager.getAllServers();
  });

  // GET /web/servers/name/:name
  fastify.get<{ Params: { name: string } }>('/web/servers/name/:name', async (request, reply) => {
    const server = hubManager.getServerByName(request.params.name);
    if (!server) {
      return reply.code(404).send({ error: 'Server not found' });
    }
    return server;
  });

  // GET /web/server-instances
  fastify.get('/web/server-instances', async () => {
    const allServers = hubManager.getAllServers();
    const instances: Record<string, ServerInstance[]> = {};
    for (const { name, config } of allServers) {
      instances[name] = config.instances;
    }
    return instances;
  });

  // GET /web/server-instances/:name
  fastify.get<{ Params: { name: string } }>(
    '/web/server-instances/:name',
    async (request, reply) => {
      const instances = hubManager.getServerInstancesByName(request.params.name);
      if (instances.length === 0) {
        // Check if server exists but has no instances
        const server = hubManager.getServerByName(request.params.name);
        if (!server) {
          return reply.code(404).send({ error: 'Server not found' });
        }
      }
      return instances;
    }
  );

  // POST /web/servers
  fastify.post('/web/servers', async (request, reply) => {
    try {
      // Accept server name and template configuration as request body
      const postSchema = z.object({
        name: z.string().min(1).max(100),
        config: ServerTemplateSchema.partial()
      });
      const body = postSchema.parse(request.body);
      const newServer = await hubManager.addServer(body.name, body.config);

      // If auto-start is enabled, check if we need to start the instance
      const firstInstance = newServer.instances[0];
      if (firstInstance && firstInstance.enabled !== false) {
        try {
          // Instance is already created by addServer, no need to create again
        } catch (error) {
          // Auto-start failure does not affect server addition operation
          logger.warn(
            `Failed to auto-start server instance for ${body.name}:`,
            error,
            LOG_MODULES.SERVER_API
          );
        }
      }

      return reply.code(201).send({ name: body.name, config: newServer });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.issues });
      }
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /web/server-instances/:name
  fastify.post<{ Params: { name: string } }>(
    '/web/server-instances/:name',
    async (request, reply) => {
      try {
        if (getApiDebugSetting()) {
          logger.debug(
            `[API] POST /web/server-instances/${request.params.name} - raw body: ${stringifyForLogging(request.body)}`,
            LOG_MODULES.SERVER_API
          );
        }
        const body = ServerInstanceUpdateSchema.parse(request.body);
        if (getApiDebugSetting()) {
          logger.debug(
            `[API] POST /web/server-instances/${request.params.name} - parsed body: ${stringifyForLogging(body)}`,
            LOG_MODULES.SERVER_API
          );
        }

        // Check if server exists
        const server = hubManager.getServerByName(request.params.name);
        if (!server) {
          return reply.code(404).send({ error: 'Server not found' });
        }

        const newInstance = await hubManager.addServerInstance(request.params.name, body);
        return reply.code(201).send(newInstance);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: error.issues });
        }
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // PUT /web/servers/:name
  fastify.put<{ Params: { name: string } }>('/web/servers/:name', async (request, reply) => {
    try {
      const body = ServerUpdateSchema.parse(request.body);

      // Separate template updates and server configuration updates
      const { instanceSelectionStrategy, ...templateUpdates } = body;

      // Update server template
      if (Object.keys(templateUpdates).length > 0) {
        await hubManager.updateServer(request.params.name, templateUpdates);
      }

      // Update instance selection strategy
      if (instanceSelectionStrategy !== undefined) {
        await hubManager.updateServerInstanceSelectionStrategy(
          request.params.name,
          instanceSelectionStrategy
        );
      }

      const updatedServer = hubManager.getServerByName(request.params.name);
      if (!updatedServer) {
        return reply.code(404).send({ error: 'Server not found' });
      }

      return { name: request.params.name, config: updatedServer };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.issues });
      }
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // PUT /web/server-instances/:name/:index
  fastify.put<{ Params: { name: string; index: number } }>(
    '/web/server-instances/:name/:index',
    async (request, reply) => {
      try {
        if (getApiDebugSetting()) {
          logger.debug(
            `[API] PUT /web/server-instances/${request.params.name}/${request.params.index} - raw body: ${stringifyForLogging(request.body)}`,
            LOG_MODULES.SERVER_API
          );
        }
        const body = ServerInstanceUpdateSchema.parse(request.body);
        if (getApiDebugSetting()) {
          logger.debug(
            `[API] PUT /web/server-instances/${request.params.name}/${request.params.index} - parsed body: ${stringifyForLogging(body)}`,
            LOG_MODULES.SERVER_API
          );
        }

        await hubManager.updateServerInstance(request.params.name, request.params.index, body);
        return reply.code(200).send({ message: 'Server instance updated' });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: error.issues });
        }
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // DELETE /web/servers/:name
  fastify.delete<{ Params: { name: string } }>('/web/servers/:name', async (request, reply) => {
    const success = await hubManager.removeServer(request.params.name);
    if (!success) {
      return reply.code(404).send({ error: 'Server not found' });
    }
    return reply.code(204).send();
  });

  // DELETE /web/server-instances/:name/:index
  fastify.delete<{ Params: { name: string; index: number } }>(
    '/web/server-instances/:name/:index',
    async (request, reply) => {
      try {
        await hubManager.removeServerInstance(request.params.name, request.params.index);
        return reply.code(204).send();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: error.issues });
        }
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // POST /web/server-instances/:name/reassign-indexes
  fastify.post<{ Params: { name: string } }>(
    '/web/server-instances/:name/reassign-indexes',
    async (request, reply) => {
      try {
        // Check if server exists
        const server = hubManager.getServerByName(request.params.name);
        if (!server) {
          return reply.code(404).send({ error: 'Server not found' });
        }

        const success = await hubManager.reassignInstanceIndexes(request.params.name);
        if (!success) {
          return reply.code(404).send({ error: 'No server instances found' });
        }

        return reply.code(200).send({ message: 'Server instance indexes reassigned successfully' });
      } catch {
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // POST /web/servers/batch
  fastify.post('/web/servers/batch', async (request, reply) => {
    try {
      // First parse the basic structure without strict validation of server configuration to allow preprocessing
      const batchSchema = z.object({
        mcpServers: z.array(
          z.object({
            name: z.string().min(1).max(100),
            config: ServerTemplateSchema.partial()
          })
        )
      });

      const body = batchSchema.parse(request.body);

      const results = {
        success: [] as BatchResultSuccess[],
        errors: [] as { name: string; error: string }[]
      };

      const existingServers = hubManager.getAllServers();
      const existingNames = new Set(existingServers.map((server) => server.name.toLowerCase()));

      const serversToAdd = [];
      const serversToConnect = [];

      // Phase 1: Collect and validate all servers
      for (const { name, config: serverConfig } of body.mcpServers) {
        try {
          const processedName = name.toLowerCase();

          // Check for duplicate names
          if (existingNames.has(processedName)) {
            results.errors.push({
              name: name,
              error: 'Server with this name already exists'
            });
            continue;
          }

          // Validate server configuration using Zod (now supports "http" type)
          const validatedConfig = ServerTemplateSchema.partial().parse(serverConfig);

          serversToAdd.push({ name: processedName, config: validatedConfig });
          // In v1.1, enabled is at instance level, not template level
          // We'll connect all instances by default
          serversToConnect.push(processedName);
          results.success.push({ name: processedName, config: validatedConfig });
          existingNames.add(processedName); // Prevent duplicates within the same batch
        } catch (error) {
          results.errors.push({
            name: name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Phase 2: Batch save configuration (save only once)
      if (serversToAdd.length > 0) {
        await hubManager.addServersWithoutAutoStart(serversToAdd);
      }

      // Phase 3: Batch create server instances (without auto-connect)
      if (serversToAdd.length > 0) {
        await hubManager.addServerInstancesWithoutConnect(serversToAdd.map((s) => s.name));
      }

      // Phase 4: Concurrently start all server instances that need to be connected
      if (serversToConnect.length > 0) {
        await hubManager.connectServerInstances(serversToConnect);
      }

      return reply.code(200).send({
        code: 200,
        message: 'Servers imported successfully',
        data: results
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.issues });
      }
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
