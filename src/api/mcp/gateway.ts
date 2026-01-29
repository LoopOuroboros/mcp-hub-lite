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
          logger.debug(`Extracted sessionId from URL: ${clientId}`);
      }
  }

  const clientName = (headers['x-mcp-client-id'] as string) || (headers['x-client-id'] as string);
  const clients = clientTrackerService.getClients();

  // Priority 2: For JSON-RPC requests like initialize, maintain session consistency
  if (!clientId && request.body) {
      // For initialize request, generate a consistent session ID
      if (request.body.method === 'initialize' && request.body.params?.clientInfo) {
          const { name, version } = request.body.params.clientInfo;
          // 从请求中获取 CWD（运行目录），用于区分相同版本但不同运行目录的客户端
          const cwd = (headers['x-mcp-cwd'] as string) || (headers['x-cwd'] as string);
          // 使用 client name + version + cwd（哈希化）作为稳定标识符，确保相同版本但不同目录的客户端有不同的 Client-Id
          let baseId = `${name.replace(/[^a-zA-Z0-9-]/g, '')}-${version.replace(/[^a-zA-Z0-9-]/g, '')}`;
          if (cwd) {
              // 对 CWD 进行简单哈希处理，避免路径包含特殊字符
              const cwdHash = cwd.split('').reduce((acc, char) => {
                  acc = ((acc << 5) - acc) + char.charCodeAt(0);
                  return acc & acc; // 转换为 32 位整数
              }, 0).toString(16).replace('-', ''); // 确保是正数
              baseId = `${baseId}-${cwdHash}`;
          } else {
              // 当 cwd 为空时，添加随机哈希值，确保每个会话有唯一的 Client-Id
              const randomHash = randomUUID().substring(0, 8);
              baseId = `${baseId}-${randomHash}`;
          }
          clientId = baseId;
          logger.debug(`Extracted clientId from initialize params: ${clientId}`);
      }
  }

  // Priority 3: Simplified session matching - only match exact clientId or clientName
  if (!clientId) {
      // Check if there's already a session with matching client name (for consistency)
      if (clientName) {
          const existingClient = clients.find(c => c.clientName === clientName);
          if (existingClient) {
              clientId = existingClient.clientId;
              logger.debug(`Found existing clientId for ${clientName}: ${clientId}`);
          }
      }
  }

  // Priority 4: Generate new unique session ID only if no other method works
  if (!clientId) {
      // Use client name as prefix if available, but ensure uniqueness with UUID
      const prefix = clientName ? `${clientName.replace(/[^a-zA-Z0-9-]/g, '')}-` : 'session-';
      clientId = `${prefix}${randomUUID().substring(0, 8)}`;
      logger.debug(`Generated new clientId: ${clientId}`);
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

      // 创建响应跟踪
      const startTime = Date.now();

      try {
          // Get or create session for this client
          const session = await mcpSessionManager.getSession(context.clientId);

          // Pass parsed body to transport within request context
          await requestContext.run(context, async () => {
              // Fix: Ensure transport sees the sessionId in the URL so it sends correct endpoint URI to client
              // This is crucial for clients (like browsers) that can't send headers with EventSource
              if (request.method === 'GET' && !request.raw.url.includes('sessionId=')) {
                  const separator = request.raw.url.includes('?') ? '&' : '?';
                  request.raw.url = `${request.raw.url}${separator}sessionId=${context.clientId}`;
                  logger.debug(`Rewrote request URL with sessionId: ${request.raw.url}`);
              }

              await session.transport.handleRequest(request.raw, reply.raw, request.body);
          });

          const duration = Date.now() - startTime;
          logger.info(`MCP Gateway response for ${context.clientId}: handled in ${duration}ms`);
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