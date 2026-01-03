import { FastifyInstance } from 'fastify';
import { mcpConnectionManager } from '../../services/mcp-connection-manager.js';
import { MCPErrorHandler } from '../../utils/mcp-error-handler.js';

/**
 * MCP JSON-RPC 2.0 Gateway endpoint
 * Handles all MCP protocol requests at /mcp endpoint
 */
export async function mcpGatewayRoutes(fastify: FastifyInstance) {
  // POST /mcp - Handle JSON-RPC 2.0 requests for MCP protocol
  fastify.post('/mcp', async (request, reply) => {
    try {
      const requestBody = request.body as any;

      // Validate JSON-RPC 2.0 format
      if (!requestBody.jsonrpc || requestBody.jsonrpc !== '2.0') {
        return reply.code(400).send({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request',
            data: 'Missing or invalid jsonrpc field'
          },
          id: requestBody.id || null
        });
      }

      // Route to appropriate MCP handler based on method
      const { method, params, id } = requestBody;

      switch (method) {
        case 'initialize':
          // Handle MCP initialize
          return await handleInitialize(request, reply, params, id);

        case 'tools/list':
          // Handle tools listing
          return await handleToolsList(request, reply, params, id);

        case 'tools/call':
          // Handle tool execution
          return await handleToolsCall(request, reply, params, id);

        case 'ping':
          // Handle ping
          return await handlePing(request, reply, params, id);

        default:
          return reply.code(400).send({
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: 'Method not found',
              data: `Unknown method: ${method}`
            },
            id
          });
      }
    } catch (error) {
      const mcpError = MCPErrorHandler.toMCPError(error as Error);
      return reply.code(500).send({
        jsonrpc: '2.0',
        error: mcpError,
        id: (request.body as any)?.id || null
      });
    }
  });
}

// Helper functions for MCP methods
async function handleInitialize(request: any, reply: any, params: any, id: string | number) {
  // TODO: Implement MCP initialize logic
  return {
    jsonrpc: '2.0',
    result: {
      serverInfo: {
        name: 'MCP-HUB-LITE',
        version: '1.0.0',
        mcpVersion: '2025-11-25'
      },
      capabilities: {
        tools: {
          list: true,
          execute: true
        }
      }
    },
    id
  };
}

async function handleToolsList(request: any, reply: any, params: any, id: string | number) {
  try {
    // Get tools from all connected servers
    const allTools = mcpConnectionManager.getAllTools();
    return {
      jsonrpc: '2.0',
      result: allTools,
      id
    };
  } catch (error) {
    const mcpError = MCPErrorHandler.toMCPError(error as Error);
    // Override message for tool listing context
    mcpError.message = 'Failed to list tools';
    return reply.code(500).send({
      jsonrpc: '2.0',
      error: mcpError,
      id
    });
  }
}

async function handleToolsCall(request: any, reply: any, params: any, id: string | number) {
  try {
    const { serverId, toolName, arguments: args } = params;
    if (!serverId || !toolName) {
      return reply.code(400).send({
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: 'Invalid parameters',
          data: 'Missing serverId or toolName'
        },
        id
      });
    }

    const result = await mcpConnectionManager.callTool(serverId, toolName, args);
    return {
      jsonrpc: '2.0',
      result,
      id
    };
  } catch (error) {
    const mcpError = MCPErrorHandler.toMCPError(error as Error);
    // Override message for tool execution context
    mcpError.message = 'Failed to execute tool';
    return reply.code(500).send({
      jsonrpc: '2.0',
      error: mcpError,
      id
    });
  }
}

async function handlePing(request: any, reply: any, params: any, id: string | number) {
  return {
    jsonrpc: '2.0',
    result: { pong: true },
    id
  };
}