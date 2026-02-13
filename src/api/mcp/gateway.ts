import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@utils/logger.js';
import { requestContext } from '@utils/request-context.js';
import type { ClientContext } from '@shared-types/client.types';
import { clientTrackerService } from '@services/client-tracker.service.js';
import { mcpSessionManager } from '@services/mcp-session-manager.js';
import { randomUUID } from 'crypto';

// MCP Protocol Request Body Types
interface RequestBody {
  method?: string;
  params?: {
    clientInfo?: {
      name: string;
      version: string;
    };
    protocolVersion?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function extractSessionContext(request: FastifyRequest<{ Body: RequestBody | null }>): { sessionId: string; clientContext: ClientContext } {
  const headers = request.headers;

  // 完全使用原 clientId 生成逻辑作为 sessionId
  // Priority 1: Session ID from Query (Standard MCP SSE)
  let sessionId = (request.query as { sessionId?: string })?.sessionId;

  if (request.url.includes('sessionId=')) {
      const match = request.url.match(/sessionId=([^&]+)/);
      if (match) {
          sessionId = match[1];
          logger.debug(`Extracted sessionId from URL: ${sessionId}`);
      }
  }

  let clientName = (headers['x-mcp-client-id'] as string) || (headers['x-client-id'] as string);
  const clients = clientTrackerService.getClients();
  let clientVersion: string | undefined;
  let protocolVersion: string | undefined;

  // Priority 2: For JSON-RPC requests like initialize, maintain session consistency
  if (!sessionId && request.body) {
      if (request.body.method === 'initialize' && request.body.params?.clientInfo) {
          const { name, version } = request.body.params.clientInfo;
          protocolVersion = request.body.params.protocolVersion;
          const cwd = (headers['x-mcp-cwd'] as string) || (headers['x-cwd'] as string);

          let baseId = `${name.replace(/[^a-zA-Z0-9-]/g, '')}-${version.replace(/[^a-zA-Z0-9-]/g, '')}`;
          if (cwd) {
              const cwdHash = cwd.split('').reduce((acc, char) => {
                  acc = ((acc << 5) - acc) + char.charCodeAt(0);
                  return acc & acc;
              }, 0).toString(16).replace('-', '');
              baseId = `${baseId}-${cwdHash}`;
          } else {
              const randomHash = randomUUID().substring(0, 8);
              baseId = `${baseId}-${randomHash}`;
          }
          sessionId = baseId;
          logger.debug(`Extracted sessionId from initialize params: ${sessionId}`);

          // 保存客户端版本和协议版本信息
          clientVersion = version;
          protocolVersion = request.body.params.protocolVersion;
          // 直接设置 clientName，因为我们从 initialize 请求中获取了更准确的信息
          clientName = name;
      } else if (request.body.method === 'notifications/initialized' || request.body.method === 'tools/list') {
          // 对于 notifications/initialized 和 tools/list 请求，我们需要找到已存在的会话
          // 因为这些请求通常是在 initialize 之后立即发送的
          if (clients.length > 0) {
              // 尝试找到最近的客户端会话
              const latestClient = clients.reduce((latest, current) => {
                  return current.timestamp > latest.timestamp ? current : latest;
              });
              sessionId = latestClient.sessionId;
              logger.debug(`Extracted sessionId from latest client for ${request.body.method}: ${sessionId}`);
          }
      }
  }

  // Priority 3: For any request without sessionId, try to find latest session
  // This handles cases like GET /mcp without query params and POST /mcp with tools/list
  if (!sessionId && clients.length > 0) {
      const latestClient = clients.reduce((latest, current) => {
          return current.timestamp > latest.timestamp ? current : latest;
      });
      sessionId = latestClient.sessionId;
      logger.debug(`Extracted sessionId from latest client: ${sessionId}`);
  }

  // Priority 4: Simplified session matching - only match exact sessionId or clientName
  if (!sessionId) {
      if (clientName) {
          const existingClient = clients.find(c => c.clientName === clientName);
          if (existingClient) {
              sessionId = existingClient.sessionId; // 使用现有的 sessionId
              logger.debug(`Found existing sessionId for ${clientName}: ${sessionId}`);
          }
      }
  }

  // Priority 5: Generate new unique session ID only if no other method works
  if (!sessionId) {
      const prefix = clientName ? `${clientName.replace(/[^a-zA-Z0-9-]/g, '')}-` : 'session-';
      sessionId = `${prefix}${randomUUID().substring(0, 8)}`;
      logger.debug(`Generated new sessionId: ${sessionId}`);
  }

  const clientContext: ClientContext = {
    sessionId,
    clientName,
    clientVersion,
    protocolVersion,
    cwd: (headers['x-mcp-cwd'] as string) || (headers['x-cwd'] as string),
    project: (headers['x-mcp-project'] as string) || (headers['x-project'] as string),
    ip: request.ip,
    userAgent: headers['user-agent'],
    timestamp: Date.now()
  };

  return { sessionId, clientContext };
}

/**
 * MCP Gateway endpoint using Streamable HTTP Transport
 * Handles all MCP protocol requests at /mcp endpoint
 */
export async function mcpGatewayRoutes(fastify: FastifyInstance) {

  const handleMcpRequest = async (request: FastifyRequest<{ Body: RequestBody | null }>, reply: FastifyReply) => {
      const { sessionId, clientContext } = extractSessionContext(request);

      // 更新客户端追踪信息
      clientTrackerService.updateClient(clientContext);

      let logMsg = `MCP Gateway ${request.method} ${request.url} [Session: ${sessionId}]`;
      if (clientContext.cwd) logMsg += ` [CWD: ${clientContext.cwd}]`;

      if (request.body) {
          try {
                const preview = JSON.stringify(request.body);
                logMsg += ` Body: ${preview}`;
          } catch {
              logMsg += ` Body: [Unserializable]`;
          }
      }
      logger.info(logMsg);

      reply.header('Content-Type', 'application/json');
      if (!request.headers['accept']) {
        request.headers['accept'] = 'application/json, text/event-stream';
      }

      reply.hijack();

      const startTime = Date.now();

      try {
          const session = await mcpSessionManager.getSession(sessionId);

          await requestContext.run(clientContext, async () => {
              if (request.method === 'GET' && request.raw.url && !request.raw.url.includes('sessionId=')) {
                  const separator = request.raw.url.includes('?') ? '&' : '?';
                  request.raw.url = `${request.raw.url}${separator}sessionId=${sessionId}`;
                  logger.debug(`Rewrote request URL with sessionId: ${request.raw.url}`);
              }

              await session.transport.handleRequest(request.raw, reply.raw, request.body);
          });

          const duration = Date.now() - startTime;
          logger.info(`MCP Gateway response for ${sessionId}: handled in ${duration}ms`);
      } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error handling MCP request for session ${sessionId}: ${errorMessage}`, error);
          if (!reply.raw.headersSent) {
              reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
              reply.raw.end(JSON.stringify({
                  jsonrpc: "2.0",
                  error: {
                      code: -32000,
                      message: "Internal Server Error",
                      data: { sessionId }
                  },
                  id: null
              }));
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