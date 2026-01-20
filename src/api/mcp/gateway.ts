import { FastifyInstance } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { gateway } from '../../services/gateway.service.js';
import { logger } from '../../utils/logger.js';

let transport: StreamableHTTPServerTransport | null = null;

/**
 * MCP Gateway endpoint using Streamable HTTP Transport
 * Handles all MCP protocol requests at /mcp endpoint
 */
export async function mcpGatewayRoutes(fastify: FastifyInstance) {
  
  if (!transport) {
      // Initialize Streamable HTTP Transport
      // This supports both SSE (GET) and JSON-RPC messages (POST)
      // It manages sessions internally
      transport = new StreamableHTTPServerTransport();
      
      // Create a dedicated McpServer instance for HTTP transport
      const server = gateway.createConnectionServer();
      
      // Connect server to transport
      await server.connect(transport);
      logger.info("MCP Streamable HTTP Transport initialized");
  }

  // Handle root /mcp endpoint (GET for SSE, POST for messages)
  fastify.all('/mcp', {
    bodyLimit: 10 * 1024 * 1024, // 10MB limit
    preHandler: (request, reply, done) => {
      // Ensure we don't parse the body for SSE (GET) requests
      if (request.method === 'GET') {
        request.body = null;
      }
      done();
    },
    handler: async (request, reply) => {
      if (!transport) return reply.code(500).send("Transport not initialized");

      // Log request summary in one line
      let logMsg = `MCP Gateway ${request.method} ${request.url}`;
      if (request.body) {
          try {
              const preview = JSON.stringify(request.body);
              logMsg += ` Body: ${preview}`;
          } catch (e) {
              logMsg += ` Body: [Unserializable]`;
          }
      }
      logger.info(logMsg);

      // Set default Content-Type and Accept headers for JSON-RPC
      reply.header('Content-Type', 'application/json');
      if (!request.headers['accept']) {
        request.headers['accept'] = 'application/json, text/event-stream';
      }

      // Pass parsed body to transport
      await transport.handleRequest(request.raw, reply.raw, request.body);
      return reply.hijack();
    }
  });

  // Handle any subpaths if client appends them (e.g. session-specific URLs)
  fastify.all('/mcp/*', {
    bodyLimit: 10 * 1024 * 1024, // 10MB limit
    preHandler: (request, reply, done) => {
      // Ensure we don't parse the body for SSE (GET) requests
      if (request.method === 'GET') {
        request.body = null;
      }
      done();
    },
    handler: async (request, reply) => {
      if (!transport) return reply.code(500).send("Transport not initialized");

      // Set default Content-Type and Accept headers for JSON-RPC
      reply.header('Content-Type', 'application/json');
      if (!request.headers['accept']) {
        request.headers['accept'] = 'application/json, text/event-stream';
      }

      // Pass parsed body to transport
      await transport.handleRequest(request.raw, reply.raw, request.body);
      return reply.hijack();
    }
  });
}