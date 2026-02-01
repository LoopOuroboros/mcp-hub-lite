import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hubToolsService } from '@services/hub-tools.service.js';
import { SystemToolName } from '@models/system-tools.constants.js';

// 请求选项接口
interface RequestOptions {
  sessionId?: string;  // 会话 ID（用于选择特定实例）
  tags?: Record<string, string>;  // 标签（后续支持）
}

/**
 * Web API routes for MCP Hub tools operations
 * Endpoints under /web/hub-tools
 */
export async function webHubToolsRoutes(fastify: FastifyInstance) {
  // GET /web/hub-tools/system - List system tools
  fastify.get('/web/hub-tools/system', async () => {
    return hubToolsService.getSystemTools();
  });

  // POST /web/hub-tools/system/:toolName/call - Call a system tool
  fastify.post<{
    Params: { toolName: string };
    Body: { toolArgs: Record<string, unknown> }
  }>('/web/hub-tools/system/:toolName/call', async (request, reply) => {
    try {
      const { toolName } = request.params;
      const { toolArgs = {} } = request.body;

      // 通过 callSystemTool 方法统一处理系统工具调用，确保日志记录
      return await hubToolsService.callSystemTool(toolName as SystemToolName, toolArgs);
    } catch (error) {
      if (error instanceof Error && error.message.includes('System tool')) {
        return reply.code(404).send({
          error: 'Tool not found',
          message: error.message
        });
      }
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /web/hub-tools/servers - List all connected servers
  fastify.get('/web/hub-tools/servers', async () => {
    const servers = await hubToolsService.listServers();
    return servers;
  });

  // GET /web/hub-tools/servers/find - Find servers matching a pattern
  fastify.get<{
    Querystring: {
      pattern: string;
      searchIn?: 'name' | 'description' | 'both';
      caseSensitive?: string;
    }
  }>('/web/hub-tools/servers/find', async (request) => {
    const {
      pattern,
      searchIn = 'both',
      caseSensitive = 'false'
    } = request.query;

    const servers = await hubToolsService.findServers(
      pattern,
      searchIn as 'name' | 'description' | 'both',
      caseSensitive === 'true'
    );

    return servers;
  });

  // GET /web/hub-tools/servers/:serverName/tools - List all tools in a specific server
  fastify.get<{
    Params: { serverName: string };
    Querystring: { sessionId?: string; tags?: string }
  }>('/web/hub-tools/servers/:serverName/tools', async (request, reply) => {
    try {
      const { serverName } = request.params;
      const { sessionId, tags } = request.query;

      const requestOptions = {
        sessionId,
        tags: tags ? JSON.parse(tags) : undefined
      };

      const result = await hubToolsService.listAllToolsInServer(serverName, requestOptions);
      return result;
    } catch (error) {
      return reply.code(404).send({
        error: 'Server not found',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /web/hub-tools/servers/:serverName/tools/find - Find tools in a specific server
  fastify.get<{
    Params: { serverName: string };
    Querystring: {
      pattern: string;
      searchIn?: 'name' | 'description' | 'both';
      caseSensitive?: string;
      sessionId?: string;
      tags?: string;
    }
  }>('/web/hub-tools/servers/:serverName/tools/find', async (request, reply) => {
    try {
      const { serverName } = request.params;
      const {
        pattern,
        searchIn = 'both',
        caseSensitive = 'false',
        sessionId,
        tags
      } = request.query;

      const requestOptions = {
        sessionId,
        tags: tags ? JSON.parse(tags) : undefined
      };

      const result = await hubToolsService.findToolsInServer(
        serverName,
        pattern,
        searchIn as 'name' | 'description' | 'both',
        caseSensitive === 'true',
        requestOptions
      );

      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Server not found',
          message: error.message
        });
      }
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /web/hub-tools/servers/:serverName/tools/:toolName - Get specific tool details
  fastify.get<{
    Params: { serverName: string; toolName: string };
    Querystring: { sessionId?: string; tags?: string }
  }>('/web/hub-tools/servers/:serverName/tools/:toolName', async (request, reply) => {
    try {
      const { serverName, toolName } = request.params;
      const { sessionId, tags } = request.query;

      const requestOptions = {
        sessionId,
        tags: tags ? JSON.parse(tags) : undefined
      };

      const tool = await hubToolsService.getTool(serverName, toolName, requestOptions);

      if (!tool) {
        return reply.code(404).send({
          error: 'Tool not found',
          message: `Tool "${toolName}" not found on server "${serverName}"`
        });
      }

      return tool;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({
          error: error.message.includes('Server') ? 'Server not found' : 'Tool not found',
          message: error.message
        });
      }
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /web/hub-tools/servers/:serverName/tools/:toolName/call - Call a specific tool
  const CallToolBodySchema = z.object({
    toolArgs: z.record(z.string(), z.any()),
    requestOptions: z.object({
      sessionId: z.string().optional(),
      tags: z.record(z.string(), z.string()).optional()
    }).optional()
  });

  fastify.post<{
    Params: { serverName: string; toolName: string };
    Body: { toolArgs: Record<string, unknown>; requestOptions?: RequestOptions }
  }>('/web/hub-tools/servers/:serverName/tools/:toolName/call', async (request, reply) => {
    try {
      const { serverName, toolName } = request.params;
      const { toolArgs, requestOptions } = CallToolBodySchema.parse(request.body);

      const result = await hubToolsService.callTool(serverName, toolName, toolArgs, requestOptions);
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({
          error: error.message.includes('Server') ? 'Server not found' : 'Tool not found',
          message: error.message
        });
      }
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /web/hub-tools/tools - List all tools from all servers
  fastify.get('/web/hub-tools/tools', async () => {
    const allTools = await hubToolsService.listAllTools();
    return allTools;
  });

  // GET /web/hub-tools/tools/find - Find tools matching a pattern across all servers
  fastify.get<{
    Querystring: {
      pattern: string;
      searchIn?: 'name' | 'description' | 'both';
      caseSensitive?: string;
    }
  }>('/web/hub-tools/tools/find', async (request) => {
    const {
      pattern,
      searchIn = 'both',
      caseSensitive = 'false'
    } = request.query;

    const tools = await hubToolsService.findTools(
      pattern,
      searchIn as 'name' | 'description' | 'both',
      caseSensitive === 'true'
    );

    return tools;
  });
}
