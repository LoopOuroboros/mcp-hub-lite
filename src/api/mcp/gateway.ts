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

      // 在开发模式下，包装 reply.raw 以捕获响应内容
      if (process.env.DEV_LOG_FILE || process.env.MCP_COMM_DEBUG) {
        const originalWrite = reply.raw.write.bind(reply.raw);
        const originalEnd = reply.raw.end.bind(reply.raw);
        let responseBuffer = '';

        logger.debug(`MCP Gateway: Wrapping reply.raw for session ${sessionId}`, { subModule: 'Communication' });

        // 包装 write 方法
        reply.raw.write = function(chunk: any, encoding?: any, callback?: any) {
          try {
            let chunkStr = '';
            if (typeof chunk === 'string') {
              chunkStr = chunk;
            } else if (chunk instanceof Buffer) {
              chunkStr = chunk.toString(encoding || 'utf8');
            } else if (chunk instanceof Uint8Array) {
              // 尝试将 Uint8Array 转换为字符串（用于SSE事件流）
              try {
                chunkStr = new TextDecoder('utf-8').decode(chunk);
              } catch {
                // 如果无法解码为文本，提供二进制摘要
                chunkStr = `[Binary data: ${chunk.length} bytes]`;
              }
            } else if (typeof chunk === 'object') {
              chunkStr = JSON.stringify(chunk);
            } else {
              chunkStr = String(chunk);
            }
            responseBuffer += chunkStr;
          } catch (error) {
            logger.debug(`MCP Gateway: Error processing write chunk: ${error}`, { subModule: 'Communication' });
          }
          return originalWrite(chunk, encoding, callback);
        };

        // 包装 end 方法
        reply.raw.end = function(chunk?: any, encoding?: any, callback?: any) {
          try {
            if (chunk !== undefined && chunk !== null) {
              let chunkStr = '';
              if (typeof chunk === 'string') {
                chunkStr = chunk;
              } else if (chunk instanceof Buffer) {
                chunkStr = chunk.toString(encoding || 'utf8');
              } else if (chunk instanceof Uint8Array) {
                // 尝试将 Uint8Array 转换为字符串（用于SSE事件流）
                try {
                  chunkStr = new TextDecoder('utf-8').decode(chunk);
                } catch {
                  // 如果无法解码为文本，提供二进制摘要
                  chunkStr = `[Binary data: ${chunk.length} bytes]`;
                }
              } else if (typeof chunk === 'object') {
                chunkStr = JSON.stringify(chunk);
              } else {
                chunkStr = String(chunk);
              }
              responseBuffer += chunkStr;
            }

            // 记录完整的响应内容（截断过长的内容）
            const truncatedResponse = responseBuffer.length > 2000
              ? responseBuffer.substring(0, 2000) + '... [truncated]'
              : responseBuffer;
            logger.debug(`MCP Gateway response for ${sessionId}: ${truncatedResponse}`, { subModule: 'Communication' });
          } catch (error) {
            logger.debug(`MCP Gateway: Error processing end chunk: ${error}`, { subModule: 'Communication' });
          }
          return originalEnd(chunk, encoding, callback);
        };

        // 同时包装 writeHead 方法，以捕获错误响应的头部信息
        const originalWriteHead = reply.raw.writeHead.bind(reply.raw);
        reply.raw.writeHead = function(statusCode: number, ...args: any[]) {
          try {
            // 如果是错误响应，记录状态码和头部
            if (statusCode >= 400) {
              let statusMessage: string | undefined;
              let headers: Record<string, any> | undefined;

              // 处理 Node.js writeHead 的多种参数形式
              if (args.length === 1) {
                // writeHead(statusCode, headers)
                headers = args[0] as Record<string, any>;
              } else if (args.length === 2) {
                // writeHead(statusCode, statusMessage, headers) 或 writeHead(statusCode, headers)
                if (typeof args[0] === 'string') {
                  statusMessage = args[0];
                  headers = args[1] as Record<string, any>;
                } else {
                  headers = args[0] as Record<string, any>;
                }
              }

              if (headers) {
                logger.debug(`MCP Gateway error response: ${statusCode} ${statusMessage || ''} Headers: ${JSON.stringify(headers)}`, { subModule: 'Communication' });
              } else {
                logger.debug(`MCP Gateway error response: ${statusCode} ${statusMessage || ''}`, { subModule: 'Communication' });
              }
            }
          } catch (error) {
            logger.debug(`MCP Gateway: Error processing writeHead: ${error}`, { subModule: 'Communication' });
          }
          return originalWriteHead(statusCode, ...args);
        };
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