import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger, isToolsListResponse, simplifyToolsListResponse } from '@utils/logger.js';
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
  const existingSessionStates = mcpSessionManager.getAllSessionStates();
  let clientVersion: string | undefined;
  let protocolVersion: string | undefined;
  logger.debug(`ClientName: ${clientName}, Query SessionId: ${sessionId}, Active Clients: ${clients.length}, Persisted Sessions: ${existingSessionStates.length}`, { subModule: 'Context' });

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
          if (existingSessionStates.length > 0) {
              // 如果有持久化的会话，优先使用（这说明是重启后恢复）
              logger.debug(`Found ${existingSessionStates.length} persisted session states, will try to match`);
              // 首先查找是否有与当前 clientName 匹配的会话
              if (clientName) {
                  const matchedSession = existingSessionStates.find(state =>
                      state.clientName === clientName);
                  if (matchedSession) {
                      sessionId = matchedSession.sessionId;
                      logger.debug(`Matched persisted session by clientName ${clientName}: ${sessionId}`);
                  }
              }

              if (!sessionId && clients.length > 0) {
                  // 没有找到匹配的持久化会话，使用最新活动会话
                  const latestClient = clients.reduce((latest, current) => {
                      return current.timestamp > latest.timestamp ? current : latest;
                  });
                  sessionId = latestClient.sessionId;
                  logger.debug(`Extracted sessionId from latest client for ${request.body.method}: ${sessionId}`);
              }

              if (!sessionId && existingSessionStates.length > 0) {
                  // 最后尝试使用最近访问的持久化会话
                  const sortedSessions = [...existingSessionStates].sort((a, b) =>
                      b.lastAccessedAt - a.lastAccessedAt);
                  sessionId = sortedSessions[0].sessionId;
                  logger.debug(`Using most recently accessed persisted session: ${sessionId}`);
              }
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

  // Priority 4.5: Try to find from persisted session states (when clientTracker has no clients but sessions are persisted)
  if (!sessionId && existingSessionStates.length > 0) {
      logger.debug(`ClientTracker has no clients, using persisted session states`);
      // 首先尝试找匹配 clientName 的
      if (clientName) {
          const matchedSession = existingSessionStates.find(state =>
              state.clientName === clientName);
          if (matchedSession) {
              sessionId = matchedSession.sessionId;
              logger.debug(`Matched persisted session by clientName ${clientName}: ${sessionId}`);
          }
      }

      if (!sessionId) {
          // 使用最近访问的
          const sortedSessions = [...existingSessionStates].sort((a, b) =>
              b.lastAccessedAt - a.lastAccessedAt);
          sessionId = sortedSessions[0].sessionId;
          logger.debug(`Using most recently accessed persisted session: ${sessionId}`);
      }
  }

  // Priority 5: Generate new unique session ID only if no other method works
  if (!sessionId) {
      const prefix = clientName ? `${clientName.replace(/[^a-zA-Z0-9-]/g, '')}-` : 'session-';
      sessionId = `${prefix}${randomUUID().substring(0, 8)}`;
      // Detect if this is an initial StreamableHttp connection (GET request without any session context)
      if (!clientName && !request.body) {
          logger.debug(`Initial StreamableHttp connection - created new sessionId: ${sessionId}`);
      } else {
          logger.debug(`Generated new sessionId: ${sessionId}`);
      }
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
      const wrapReplyForDebug = () => {
        const originalWrite = reply.raw.write.bind(reply.raw);
        const originalEnd = reply.raw.end.bind(reply.raw);
        let responseBuffer = '';

        logger.debug(`MCP Gateway: Wrapping reply.raw for session ${sessionId}`, { subModule: 'Communication' });

        // 包装 write 方法
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

            // 记录响应内容，对 tools/list 响应进行简略化处理
            let logResponse = responseBuffer;
            try {
                if (isToolsListResponse(responseBuffer)) {
                    logResponse = simplifyToolsListResponse(responseBuffer);
                } else {
                    // 处理 SSE 格式响应 (event: message 后面跟着 data: JSON)
                    if (responseBuffer.includes('event: message') && responseBuffer.includes('data:')) {
                        const dataMatch = responseBuffer.match(/data: ([^\n]+)/);
                        if (dataMatch) {
                            const jsonData = dataMatch[1].trim();
                            try {
                                const parsed = JSON.parse(jsonData);
                                const formattedData = JSON.stringify(parsed, null, 2);
                                logResponse = `event: message\ndata: ${formattedData}`;
                            } catch {
                                logResponse = responseBuffer;
                            }
                        } else {
                            logResponse = responseBuffer;
                        }
                    } else {
                        // 尝试格式化其他 JSON 响应，提高可读性
                        const parsed = JSON.parse(responseBuffer);
                        logResponse = JSON.stringify(parsed, null, 2);
                    }
                }
            } catch {
                // 如果不是有效的 JSON，则原样输出，截断过长内容
                logResponse = responseBuffer.length > 500 ? responseBuffer.substring(0, 500) + '...' : responseBuffer;
            }
            logger.debug(`MCP Gateway response for ${sessionId}:\n${logResponse.trimEnd()}`, { subModule: 'Communication' });
          } catch (error) {
            logger.debug(`MCP Gateway: Error processing end chunk: ${error}`, { subModule: 'Communication' });
          }
          return originalEnd(chunk, encoding, callback);
        };

        // 同时包装 writeHead 方法，以捕获错误响应的头部信息
        const originalWriteHead = reply.raw.writeHead.bind(reply.raw);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reply.raw.writeHead = function(statusCode: number, ...args: any[]) {
          try {
            // 如果是错误响应，记录状态码和头部
            if (statusCode >= 400) {
              let statusMessage: string | undefined;
              let headers: Record<string, unknown> | undefined;

              // 处理 Node.js writeHead 的多种参数形式
              if (args.length === 1) {
                // writeHead(statusCode, headers)
                headers = args[0] as Record<string, unknown>;
              } else if (args.length === 2) {
                // writeHead(statusCode, statusMessage, headers) 或 writeHead(statusCode, headers)
                if (typeof args[0] === 'string') {
                  statusMessage = args[0];
                  headers = args[1] as Record<string, unknown>;
                } else {
                  headers = args[0] as Record<string, unknown>;
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
      };

      wrapReplyForDebug();

      reply.hijack();

      const startTime = Date.now();

      try {
          // 判断是否需要 initialize 请求
          // 只有明确的 initialize 请求才需要 SDK 处理初始化
          // 对于其他所有请求（tools/list 等），都跳过初始化检查
          const isInitializeRequest = request.body?.method === 'initialize';
          const hasRestoredState = !!mcpSessionManager.getSessionState(sessionId);
          const requireInitialize = isInitializeRequest;
          logger.debug(`Request for session: ${sessionId}, method: ${request.body?.method || 'GET'}, isInitialize: ${isInitializeRequest}, hasRestoredState: ${hasRestoredState}, requireInitialize: ${requireInitialize}`, { subModule: 'Gateway' });

          const session = await mcpSessionManager.getSession(sessionId, requireInitialize);

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