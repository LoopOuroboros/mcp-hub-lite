import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hubManager } from '../../services/hub-manager.service.js';
import { McpServerConfigSchema, ServerInstanceConfigSchema } from '../../config/config.schema.js';
import { logger } from '../../utils/logger.js';

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
  fastify.get<{ Params: { name: string } }>('/web/server-instances/:name', async (request, reply) => {
    const instances = hubManager.getServerInstanceByName(request.params.name);
    if (instances.length === 0) {
      return reply.code(404).send({ error: 'Server instances not found' });
    }
    return instances;
  });

  // POST /web/servers
  fastify.post('/web/servers', async (request, reply) => {
    try {
      // 接受服务器名称和配置作为请求体
      const postSchema = z.object({
        name: z.string().min(1).max(100),
        config: McpServerConfigSchema.partial()
      });
      const body = postSchema.parse(request.body);
      const newServer = await hubManager.addServer(body.name, body.config);

      // 如果启用了自动启动，添加服务器实例（addServerInstance 会自动检查并处理启动）
      if (newServer.enabled !== false && newServer.enabled !== undefined) {
        try {
          await hubManager.addServerInstance(body.name, {});
        } catch (error) {
          // 自动启动失败不影响服务器添加操作
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
  fastify.post<{ Params: { name: string } }>('/web/server-instances/:name', async (request, reply) => {
    try {
      const instanceSchema = ServerInstanceConfigSchema.partial();
      const body = instanceSchema.parse(request.body);

      // 检查服务器是否存在
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
  });

  // PUT /web/servers/:name
  fastify.put<{ Params: { name: string } }>('/web/servers/:name', async (request, reply) => {
    try {
      const partialSchema = McpServerConfigSchema.partial();
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
  fastify.put<{ Params: { name: string; index: number } }>('/web/server-instances/:name/:index', async (request, reply) => {
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
  });

  // DELETE /web/servers/:name
  fastify.delete<{ Params: { name: string } }>('/web/servers/:name', async (request, reply) => {
    const success = await hubManager.removeServer(request.params.name);
    if (!success) {
      return reply.code(404).send({ error: 'Server not found' });
    }
    return reply.code(204).send();
  });

  // DELETE /web/server-instances/:name/:index
  fastify.delete<{ Params: { name: string; index: number } }>('/web/server-instances/:name/:index', async (request, reply) => {
    try {
      await hubManager.removeServerInstance(request.params.name, request.params.index);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.issues });
      }
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /web/servers/batch
  fastify.post('/web/servers/batch', async (request, reply) => {
    try {
      // 首先解析基本结构，不严格验证服务器配置，以便我们可以进行预处理
      const batchSchema = z.object({
        mcpServers: z.array(z.object({
          name: z.string().min(1).max(100),
          config: McpServerConfigSchema.partial()
        }))
      });

      const body = batchSchema.parse(request.body);

      const results = {
        success: [] as any[],
        errors: [] as { name: string; error: string }[]
      };

      const existingServers = hubManager.getAllServers();
      const existingNames = new Set(existingServers.map(server => server.name.toLowerCase()));

      for (const { name, config: serverConfig } of body.mcpServers) {
        try {
          // 预处理配置
          const processedName = name.toLowerCase();

          // 检查名称是否重复
          if (existingNames.has(processedName)) {
            results.errors.push({
              name: name,
              error: 'Server with this name already exists'
            });
            continue;
          }

          // 使用 Zod 验证服务器配置（现在支持 "http" 类型）
          const validatedConfig = McpServerConfigSchema.partial().parse(serverConfig);

          // 添加服务器配置（这会触发 SERVER_ADDED 事件）
          await hubManager.addServer(processedName, validatedConfig);

          // 如果启用了自动启动，添加服务器实例（addServerInstance 会自动检查并处理启动）
          if (validatedConfig.enabled !== false && validatedConfig.enabled !== undefined) {
            try {
              await hubManager.addServerInstance(processedName, {});
            } catch (error) {
              // 自动启动失败不影响服务器添加操作
              logger.warn(`Failed to auto-start server instance for ${processedName}:`, error);
            }
          }

          results.success.push({ name: processedName, config: validatedConfig });
          existingNames.add(processedName); // 防止同一批次中的重复
        } catch (error) {
          results.errors.push({
            name: name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
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
