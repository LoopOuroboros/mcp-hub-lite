import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hubToolsService } from '../../services/hub-tools.service.js';
import { hubManager } from '../../services/hub-manager.service.js';
import {
  LIST_SERVERS_TOOL,
  FIND_SERVERS_TOOL,
  LIST_ALL_TOOLS_IN_SERVER_TOOL,
  FIND_TOOLS_IN_SERVER_TOOL,
  GET_TOOL_TOOL,
  CALL_TOOL_TOOL,
  FIND_TOOLS_TOOL
} from '../../models/system-tools.constants.js';

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

      switch (toolName) {
        case LIST_SERVERS_TOOL:
          return await hubToolsService.listServers();
        case FIND_SERVERS_TOOL:
          return await hubToolsService.findServers(
            toolArgs.pattern as string,
            toolArgs.searchIn as 'name' | 'description' | 'both',
            toolArgs.caseSensitive as boolean
          );
        case LIST_ALL_TOOLS_IN_SERVER_TOOL:
          return await hubToolsService.listAllToolsInServer(toolArgs.serverId as string);
        case FIND_TOOLS_IN_SERVER_TOOL:
          return await hubToolsService.findToolsInServer(
            toolArgs.serverId as string,
            toolArgs.pattern as string,
            toolArgs.searchIn as 'name' | 'description' | 'both',
            toolArgs.caseSensitive as boolean
          );
        case GET_TOOL_TOOL:
          return await hubToolsService.getTool(
            toolArgs.serverId as string,
            toolArgs.toolName as string
          );
        case CALL_TOOL_TOOL:
          return await hubToolsService.callTool(
            toolArgs.serverId as string,
            toolArgs.toolName as string,
            toolArgs.toolArgs as Record<string, unknown>
          );
        case FIND_TOOLS_TOOL:
          return await hubToolsService.findTools(
            toolArgs.pattern as string,
            toolArgs.searchIn as 'name' | 'description' | 'both',
            toolArgs.caseSensitive as boolean
          );
        default:
          return reply.code(404).send({
            error: 'Tool not found',
            message: `System tool "${toolName}" not found`
          });
      }
    } catch (error) {
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

  // GET /web/hub-tools/servers/:serverId/tools - List all tools in a specific server
  fastify.get<{
    Params: { serverId: string }
  }>('/web/hub-tools/servers/:serverId/tools', async (request, reply) => {
    try {
      const { serverId } = request.params;
      const result = await hubToolsService.listAllToolsInServer(serverId);
      return result;
    } catch (error) {
      return reply.code(404).send({
        error: 'Server not found',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /web/hub-tools/servers/:serverId/tools/find - Find tools in a specific server
  fastify.get<{
    Params: { serverId: string };
    Querystring: {
      pattern: string;
      searchIn?: 'name' | 'description' | 'both';
      caseSensitive?: string;
    }
  }>('/web/hub-tools/servers/:serverId/tools/find', async (request, reply) => {
    try {
      const { serverId } = request.params;
      const {
        pattern,
        searchIn = 'both',
        caseSensitive = 'false'
      } = request.query;

      const result = await hubToolsService.findToolsInServer(
        serverId,
        pattern,
        searchIn as 'name' | 'description' | 'both',
        caseSensitive === 'true'
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

  // GET /web/hub-tools/servers/:serverId/tools/:toolName - Get specific tool details
  fastify.get<{
    Params: { serverId: string; toolName: string }
  }>('/web/hub-tools/servers/:serverId/tools/:toolName', async (request, reply) => {
    try {
      const { serverId, toolName } = request.params;
      const tool = await hubToolsService.getTool(serverId, toolName);

      if (!tool) {
        const server = hubManager.getServerById(serverId);
        const serverName = server ? server.name : serverId;
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

  // POST /web/hub-tools/servers/:serverId/tools/:toolName/call - Call a specific tool
  const CallToolBodySchema = z.object({
    toolArgs: z.record(z.string(), z.any())
  });

  fastify.post<{
    Params: { serverId: string; toolName: string };
    Body: { toolArgs: Record<string, unknown> }
  }>('/web/hub-tools/servers/:serverId/tools/:toolName/call', async (request, reply) => {
    try {
      const { serverId, toolName } = request.params;
      const { toolArgs } = CallToolBodySchema.parse(request.body);

      const result = await hubToolsService.callTool(serverId, toolName, toolArgs);
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
