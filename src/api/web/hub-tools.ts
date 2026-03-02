import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hubToolsService } from '@services/hub-tools.service.js';
import {
  SystemToolName,
  ListServersParams,
  FindServersParams,
  ListAllToolsInServerParams,
  FindToolsInServerParams,
  GetToolParams,
  CallToolParams,
  FindToolsParams
} from '@models/system-tools.constants.js';

// Request options interface
interface RequestOptions {
  sessionId?: string; // Session ID (used to select specific instance)
  tags?: Record<string, string>; // Tags (future support)
}

// Union type for system tool parameters
type SystemToolArgs =
  | ListServersParams
  | FindServersParams
  | ListAllToolsInServerParams
  | FindToolsInServerParams
  | GetToolParams
  | CallToolParams
  | FindToolsParams;

/**
 * MCP Hub Tools API Routes
 *
 * Provides a comprehensive set of endpoints for discovering, inspecting, and invoking tools across
 * all connected MCP (Model Context Protocol) servers. This module serves as the central hub for
 * tool management and execution within the MCP Hub Lite system.
 *
 * The API supports both system-level tools (built into MCP Hub Lite) and server-specific tools
 * from connected MCP servers. It enables powerful search capabilities, detailed tool inspection,
 * and secure tool invocation with proper parameter validation.
 *
 * Key features include:
 * - System tool discovery and execution
 * - Cross-server tool listing and searching
 * - Server-specific tool management
 * - Tool schema inspection and validation
 * - Secure tool invocation with session context
 *
 * @param fastify - The Fastify instance to register routes on
 * @returns Promise that resolves when all routes are registered
 *
 * @example
 * ```typescript
 * // Register hub tools routes
 * await webHubToolsRoutes(app);
 * ```
 */
export async function webHubToolsRoutes(fastify: FastifyInstance) {
  // GET /web/hub-tools/system - List system tools
  fastify.get('/web/hub-tools/system', async () => {
    return hubToolsService.getSystemTools();
  });

  // POST /web/hub-tools/system/:toolName/call - Call a system tool
  fastify.post<{
    Params: { toolName: string };
    Body: { toolArgs: Record<string, unknown> };
  }>('/web/hub-tools/system/:toolName/call', async (request, reply) => {
    try {
      const { toolName } = request.params;
      const { toolArgs = {} } = request.body;

      // Handle system tool calls uniformly through callSystemTool method to ensure logging
      return await hubToolsService.callSystemTool(
        toolName as SystemToolName,
        toolArgs as SystemToolArgs
      );
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
    };
  }>('/web/hub-tools/servers/find', async (request) => {
    const { pattern, searchIn = 'both', caseSensitive = 'false' } = request.query;

    const servers = await hubToolsService.findServers({
      pattern,
      searchIn: searchIn as 'name' | 'description' | 'both',
      caseSensitive: caseSensitive === 'true'
    });

    return servers;
  });

  // GET /web/hub-tools/servers/:serverName/tools - List all tools in a specific server
  fastify.get<{
    Params: { serverName: string };
    Querystring: { sessionId?: string; tags?: string };
  }>('/web/hub-tools/servers/:serverName/tools', async (request, reply) => {
    try {
      const { serverName } = request.params;
      const { sessionId, tags } = request.query;

      const requestOptions = {
        sessionId,
        tags: tags ? JSON.parse(tags) : undefined
      };

      const result = await hubToolsService.listAllToolsInServer({ serverName, requestOptions });
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
    };
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

      const result = await hubToolsService.findToolsInServer({
        serverName,
        pattern,
        searchIn: searchIn as 'name' | 'description' | 'both',
        caseSensitive: caseSensitive === 'true',
        requestOptions
      });

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
    Querystring: { sessionId?: string; tags?: string };
  }>('/web/hub-tools/servers/:serverName/tools/:toolName', async (request, reply) => {
    try {
      const { serverName, toolName } = request.params;
      const { sessionId, tags } = request.query;

      const requestOptions = {
        sessionId,
        tags: tags ? JSON.parse(tags) : undefined
      };

      const tool = await hubToolsService.getTool({ serverName, toolName, requestOptions });

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
    requestOptions: z
      .object({
        sessionId: z.string().optional(),
        tags: z.record(z.string(), z.string()).optional()
      })
      .optional()
  });

  fastify.post<{
    Params: { serverName: string; toolName: string };
    Body: { toolArgs: Record<string, unknown>; requestOptions?: RequestOptions };
  }>('/web/hub-tools/servers/:serverName/tools/:toolName/call', async (request, reply) => {
    try {
      const { serverName, toolName } = request.params;
      const { toolArgs, requestOptions } = CallToolBodySchema.parse(request.body);

      const result = await hubToolsService.callTool({
        serverName,
        toolName,
        toolArgs,
        requestOptions
      });
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
    };
  }>('/web/hub-tools/tools/find', async (request) => {
    const { pattern, searchIn = 'both', caseSensitive = 'false' } = request.query;

    const tools = await hubToolsService.findTools({
      pattern,
      searchIn: searchIn as 'name' | 'description' | 'both',
      caseSensitive: caseSensitive === 'true'
    });

    return tools;
  });
}
