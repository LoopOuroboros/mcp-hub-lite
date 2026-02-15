import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hubManager } from '@services/hub-manager.service.js';
import { ServerConfigSchema, ServerInstanceConfigSchema } from '@config/config.schema.js';
import type { ServerConfig } from '@config/config.schema.js';
import { logger } from '@utils/logger.js';

interface BatchResultSuccess {
  name: string;
  config: Partial<ServerConfig>;
}

/**
 * Web API routes for server management
 * All endpoints under /web/servers
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
    return hubManager.getServerInstances();
  });

  // GET /web/server-instances/:name
  fastify.get<{ Params: { name: string } }>(
    '/web/server-instances/:name',
    async (request, reply) => {
      const instances = hubManager.getServerInstanceByName(request.params.name);
      if (instances.length === 0) {
        return reply.code(404).send({ error: 'Server instances not found' });
      }
      return instances;
    }
  );

  // POST /web/servers
  fastify.post('/web/servers', async (request, reply) => {
    try {
      // Accept server name and configuration as request body
      const postSchema = z.object({
        name: z.string().min(1).max(100),
        config: ServerConfigSchema.partial()
      });
      const body = postSchema.parse(request.body);
      const newServer = await hubManager.addServer(body.name, body.config);

      // If auto-start is enabled, add server instance (addServerInstance will automatically check and handle startup)
      if (newServer.enabled !== false && newServer.enabled !== undefined) {
        try {
          await hubManager.addServerInstance(body.name, {});
        } catch (error) {
          // Auto-start failure does not affect server addition operation
          logger.warn(`Failed to auto-start server instance for ${body.name}:`, error);
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
        const instanceSchema = ServerInstanceConfigSchema.partial();
        const body = instanceSchema.parse(request.body);

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
      const partialSchema = ServerConfigSchema.partial();
      const body = partialSchema.parse(request.body);

      const updatedServer = await hubManager.updateServer(request.params.name, body);

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
        const partialSchema = ServerInstanceConfigSchema.partial();
        const body = partialSchema.parse(request.body);

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

  // POST /web/servers/batch
  fastify.post('/web/servers/batch', async (request, reply) => {
    try {
      // First parse the basic structure without strict validation of server configuration to allow preprocessing
      const batchSchema = z.object({
        mcpServers: z.array(
          z.object({
            name: z.string().min(1).max(100),
            config: ServerConfigSchema.partial()
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
          const validatedConfig = ServerConfigSchema.partial().parse(serverConfig);

          serversToAdd.push({ name: processedName, config: validatedConfig });
          if (validatedConfig.enabled !== false && validatedConfig.enabled !== undefined) {
            serversToConnect.push(processedName);
          }
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
