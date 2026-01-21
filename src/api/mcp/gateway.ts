import { FastifyInstance } from 'fastify';
import { logger } from '../../utils/logger.js';
import { requestContext, ClientContext } from '../../utils/request-context.js';
import { clientTrackerService } from '../../services/client-tracker.service.js';
import { mcpSessionManager } from '../../services/mcp-session-manager.js';
import { randomUUID } from 'crypto';

function extractClientContext(request: any): ClientContext {
  const headers = request.headers;
  
  // Priority 1: Session ID from Query (Standard MCP SSE)
  // This is the most reliable identifier for an active session
  let clientId = request.query && (request.query as any).sessionId;

  if (request.url.includes('sessionId=')) {
      const match = request.url.match(/sessionId=([^&]+)/);
      if (match) {
          clientId = match[1];
          // logger.debug(`Extracted sessionId from URL manually: ${clientId}`);
      }
  }

  const clientName = (headers['x-mcp-client-id'] as string) || (headers['x-client-id'] as string);

  // Priority 2: If no session ID, generate a new unique one
  if (!clientId) {
      // Use client name as prefix if available, but ensure uniqueness with UUID
      const prefix = clientName ? `${clientName.replace(/[^a-zA-Z0-9-]/g, '')}-` : 'anon-';
      clientId = `${prefix}${randomUUID().substring(0, 8)}`;
  }
  
  return {
    clientId,
    clientName,
    cwd: (headers['x-mcp-cwd'] as string) || (headers['x-cwd'] as string),
    project: (headers['x-mcp-project'] as string) || (headers['x-project'] as string),
    ip: request.ip,
    userAgent: headers['user-agent'],
    timestamp: Date.now()
  };
}

/**
 * MCP Gateway endpoint using Streamable HTTP Transport
 * Handles all MCP protocol requests at /mcp endpoint
 */
export async function mcpGatewayRoutes(fastify: FastifyInstance) {
  
  const handleMcpRequest = async (request: any, reply: any) => {
      // Extract and track client context
      const rawContext = extractClientContext(request);
      clientTrackerService.updateClient(rawContext);
      
      // Use the full context from tracker (which includes inferred CWD from roots)
      const context = clientTrackerService.getClient(rawContext.clientId) || rawContext;

      // Log request summary in one line
      let logMsg = `MCP Gateway ${request.method} ${request.url} [Client: ${context.clientId}]`;
      if (context.cwd) logMsg += ` [CWD: ${context.cwd}]`;

      // logger.info(`Debug: Query: ${JSON.stringify(request.query)}, Headers: ${JSON.stringify(request.headers['x-mcp-client-id'])}`);

      if (request.body) {
          try {
              const preview = JSON.stringify(request.body);
              // For tools/list responses with many tools, use debug level to avoid verbose logs
              if (logMsg.includes('tools/list')) {
                  logger.debug(logMsg + ` Body: ${preview}`);
              } else {
                  logMsg += ` Body: ${preview}`;
              }
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

      reply.hijack();

      try {
          // Get or create session for this client
          const session = await mcpSessionManager.getSession(context.clientId);

          // Pass parsed body to transport within request context
          await requestContext.run(context, async () => {
              await session.transport.handleRequest(request.raw, reply.raw, request.body);
          });
      } catch (error) {
          logger.error(`Error handling MCP request for client ${context.clientId}:`, error);
          if (!reply.raw.headersSent) {
              reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
              reply.raw.end(JSON.stringify({ error: "Internal Server Error" }));
          }
      }
  };

  // Handle root /mcp endpoint (GET for SSE, POST for messages)
  fastify.all('/mcp', {
    bodyLimit: 10 * 1024 * 1024, // 10MB limit
    preHandler: (request, _reply, done) => {
      // Ensure we don't parse the body for SSE (GET) requests
      if (request.method === 'GET') {
        request.body = null;
      }
      done();
    },
    handler: handleMcpRequest
  });

  // Handle any subpaths if client appends them (e.g. session-specific URLs)
  fastify.all('/mcp/*', {
    bodyLimit: 10 * 1024 * 1024, // 10MB limit
    preHandler: (request, _reply, done) => {
      // Ensure we don't parse the body for SSE (GET) requests
      if (request.method === 'GET') {
        request.body = null;
      }
      done();
    },
    handler: handleMcpRequest
  });
}