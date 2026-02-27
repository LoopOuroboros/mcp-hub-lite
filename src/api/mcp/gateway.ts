import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger, isToolsListResponse, simplifyToolsListResponse } from '@utils/logger.js';
import { stringifyForLogging, stringifyRawHeadersForLogging } from '@utils/json-utils.js';
import { requestContext } from '@utils/request-context.js';
import type { ClientContext } from '@shared-types/client.types.js';
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

/**
 * Extracts session context from incoming MCP requests to establish client identity and session management.
 *
 * This function implements a sophisticated session ID resolution strategy with multiple fallback mechanisms:
 * 1. Query parameter sessionId (for SSE connections)
 * 2. Initialize request parameters (for JSON-RPC initialization)
 * 3. Existing client tracker information (for subsequent requests)
 * 4. Persisted session states (for service restart recovery)
 * 5. New unique session ID generation (fallback)
 *
 * The function also extracts and enriches client context including name, version, working directory,
 * project information, IP address, and user agent for comprehensive session tracking.
 *
 * @param {FastifyRequest<{ Body: RequestBody | null }>} request - Incoming Fastify request object
 * @returns {{ sessionId: string; clientContext: ClientContext }} Object containing resolved session ID and enriched client context
 *
 * @example
 * ```typescript
 * const { sessionId, clientContext } = extractSessionContext(request);
 * console.log(`Session: ${sessionId}, Client: ${clientContext.clientName}`);
 * ```
 */
function extractSessionContext(request: FastifyRequest<{ Body: RequestBody | null }>): {
  sessionId: string;
  clientContext: ClientContext;
} {
  const headers = request.headers;

  // Fully use the original clientId generation logic as sessionId
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
  logger.debug(
    `ClientName: ${clientName}, Query SessionId: ${sessionId}, Active Clients: ${clients.length}, Persisted Sessions: ${existingSessionStates.length}`,
    { subModule: 'Context' }
  );

  // Priority 2: For JSON-RPC requests like initialize, maintain session consistency
  if (!sessionId && request.body) {
    if (request.body.method === 'initialize' && request.body.params?.clientInfo) {
      const { name, version } = request.body.params.clientInfo;
      protocolVersion = request.body.params.protocolVersion;
      const cwd = (headers['x-mcp-cwd'] as string) || (headers['x-cwd'] as string);

      let baseId = `${name.replace(/[^a-zA-Z0-9-]/g, '')}-${version.replace(/[^a-zA-Z0-9-]/g, '')}`;
      if (cwd) {
        const cwdHash = cwd
          .split('')
          .reduce((acc, char) => {
            acc = (acc << 5) - acc + char.charCodeAt(0);
            return acc & acc;
          }, 0)
          .toString(16)
          .replace('-', '');
        baseId = `${baseId}-${cwdHash}`;
      } else {
        const randomHash = randomUUID().substring(0, 8);
        baseId = `${baseId}-${randomHash}`;
      }
      sessionId = baseId;
      logger.debug(`Extracted sessionId from initialize params: ${sessionId}`);

      // Save client version and protocol version information
      clientVersion = version;
      protocolVersion = request.body.params.protocolVersion;
      // Set clientName directly since we get more accurate information from the initialize request
      clientName = name;
    } else if (
      request.body.method === 'notifications/initialized' ||
      request.body.method === 'tools/list'
    ) {
      // For notifications/initialized and tools/list requests, we need to find existing sessions
      // Because these requests are typically sent immediately after initialize
      if (existingSessionStates.length > 0) {
        // If there are persisted sessions, prioritize using them (this indicates recovery after restart)
        logger.debug(
          `Found ${existingSessionStates.length} persisted session states, will try to match`
        );
        // First, look for sessions matching the current clientName
        if (clientName) {
          const matchedSession = existingSessionStates.find(
            (state) => state.clientName === clientName
          );
          if (matchedSession) {
            sessionId = matchedSession.sessionId;
            logger.debug(`Matched persisted session by clientName ${clientName}: ${sessionId}`);
          }
        }

        if (!sessionId && clients.length > 0) {
          // No matching persisted session found, use the latest active session
          const latestClient = clients.reduce((latest, current) => {
            return current.timestamp > latest.timestamp ? current : latest;
          });
          sessionId = latestClient.sessionId;
          logger.debug(
            `Extracted sessionId from latest client for ${request.body.method}: ${sessionId}`
          );
        }

        if (!sessionId && existingSessionStates.length > 0) {
          // Finally, try using the most recently accessed persisted session
          const sortedSessions = [...existingSessionStates].sort(
            (a, b) => b.lastAccessedAt - a.lastAccessedAt
          );
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
      const existingClient = clients.find((c) => c.clientName === clientName);
      if (existingClient) {
        sessionId = existingClient.sessionId; // Use existing sessionId
        logger.debug(`Found existing sessionId for ${clientName}: ${sessionId}`);
      }
    }
  }

  // Priority 4.5: Try to find from persisted session states (when clientTracker has no clients but sessions are persisted)
  if (!sessionId && existingSessionStates.length > 0) {
    logger.debug(`ClientTracker has no clients, using persisted session states`);
    // First, try to find matching clientName
    if (clientName) {
      const matchedSession = existingSessionStates.find((state) => state.clientName === clientName);
      if (matchedSession) {
        sessionId = matchedSession.sessionId;
        logger.debug(`Matched persisted session by clientName ${clientName}: ${sessionId}`);
      }
    }

    if (!sessionId) {
      // Use the most recently accessed
      const sortedSessions = [...existingSessionStates].sort(
        (a, b) => b.lastAccessedAt - a.lastAccessedAt
      );
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

  // Add consistency check before returning session information
  if (sessionId && mcpSessionManager.getSessionState(sessionId)) {
    const hasSessionObject = mcpSessionManager.hasSession(sessionId);
    if (!hasSessionObject) {
      logger.warn(`Session state exists but session object missing for ${sessionId}`);
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
  const handleMcpRequest = async (
    request: FastifyRequest<{ Body: RequestBody | null }>,
    reply: FastifyReply
  ) => {
    const { sessionId, clientContext } = extractSessionContext(request);

    // Update client tracking information
    clientTrackerService.updateClient(clientContext);

    let logMsg = `MCP Gateway ${request.method} ${request.url} [Session: ${sessionId}]`;
    if (clientContext.cwd) logMsg += ` [CWD: ${clientContext.cwd}]`;

    if (request.body) {
      try {
        const preview = stringifyForLogging(request.body);
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

    // In development mode, wrap reply.raw to capture response content
    const wrapReplyForDebug = () => {
      const originalWrite = reply.raw.write.bind(reply.raw);
      const originalEnd = reply.raw.end.bind(reply.raw);
      let responseBuffer = '';

      logger.debug(`MCP Gateway: Wrapping reply.raw for session ${sessionId}`, {
        subModule: 'Communication'
      });

      // Wrap write method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reply.raw.write = function (chunk: any, encoding?: any, callback?: any) {
        try {
          let chunkStr = '';
          if (typeof chunk === 'string') {
            chunkStr = chunk;
          } else if (chunk instanceof Buffer) {
            chunkStr = chunk.toString(encoding || 'utf8');
          } else if (chunk instanceof Uint8Array) {
            // Try to convert Uint8Array to string (for SSE event streams)
            try {
              chunkStr = new TextDecoder('utf-8').decode(chunk);
            } catch {
              // If unable to decode as text, provide binary summary
              chunkStr = `[Binary data: ${chunk.length} bytes]`;
            }
          } else if (typeof chunk === 'object') {
            chunkStr = JSON.stringify(chunk);
          } else {
            chunkStr = String(chunk);
          }
          responseBuffer += chunkStr;
        } catch (error) {
          logger.debug(`MCP Gateway: Error processing write chunk: ${error}`, {
            subModule: 'Communication'
          });
        }
        return originalWrite(chunk, encoding, callback);
      };

      // Wrap end method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reply.raw.end = function (chunk?: any, encoding?: any, callback?: any) {
        try {
          if (chunk !== undefined && chunk !== null) {
            let chunkStr = '';
            if (typeof chunk === 'string') {
              chunkStr = chunk;
            } else if (chunk instanceof Buffer) {
              chunkStr = chunk.toString(encoding || 'utf8');
            } else if (chunk instanceof Uint8Array) {
              // Try to convert Uint8Array to string (for SSE event streams)
              try {
                chunkStr = new TextDecoder('utf-8').decode(chunk);
              } catch {
                // If unable to decode as text, provide binary summary
                chunkStr = `[Binary data: ${chunk.length} bytes]`;
              }
            } else if (typeof chunk === 'object') {
              chunkStr = JSON.stringify(chunk);
            } else {
              chunkStr = String(chunk);
            }
            responseBuffer += chunkStr;
          }

          // Log response content, simplify tools/list responses
          let logResponse = responseBuffer;
          try {
            if (isToolsListResponse(responseBuffer)) {
              logResponse = simplifyToolsListResponse(responseBuffer);
            } else {
              // Handle SSE format responses (event: message followed by data: JSON)
              if (responseBuffer.includes('event: message') && responseBuffer.includes('data:')) {
                const dataMatch = responseBuffer.match(/data: ([^\n]+)/);
                if (dataMatch) {
                  const jsonData = dataMatch[1].trim();
                  try {
                    const parsed = JSON.parse(jsonData);
                    const formattedData = stringifyForLogging(parsed);
                    logResponse = `event: message\ndata: ${formattedData}`;
                  } catch {
                    logResponse = responseBuffer;
                  }
                } else {
                  logResponse = responseBuffer;
                }
              } else {
                // Try to format other JSON responses to improve readability
                const parsed = JSON.parse(responseBuffer);
                logResponse = stringifyForLogging(parsed);
              }
            }
          } catch {
            // If not valid JSON, output as-is and truncate long content
            logResponse =
              responseBuffer.length > 500
                ? responseBuffer.substring(0, 500) + '...'
                : responseBuffer;
          }
          logger.debug(`MCP Gateway response for ${sessionId}:\n${logResponse.trimEnd()}`, {
            subModule: 'Communication'
          });
        } catch (error) {
          logger.debug(`MCP Gateway: Error processing end chunk: ${error}`, {
            subModule: 'Communication'
          });
        }
        return originalEnd(chunk, encoding, callback);
      };

      // Also wrap writeHead method to capture error response headers
      const originalWriteHead = reply.raw.writeHead.bind(reply.raw);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reply.raw.writeHead = function (statusCode: number, ...args: any[]) {
        try {
          // If it's an error response, log status code and headers
          if (statusCode >= 400) {
            let statusMessage: string | undefined;
            let headers: Record<string, unknown> | undefined;

            // Handle multiple parameter forms of Node.js writeHead
            if (args.length === 1) {
              // writeHead(statusCode, headers)
              headers = args[0] as Record<string, unknown>;
            } else if (args.length === 2) {
              // writeHead(statusCode, statusMessage, headers) or writeHead(statusCode, headers)
              if (typeof args[0] === 'string') {
                statusMessage = args[0];
                headers = args[1] as Record<string, unknown>;
              } else {
                headers = args[0] as Record<string, unknown>;
              }
            }

            if (headers) {
              logger.debug(
                `MCP Gateway error response: ${statusCode} ${statusMessage || ''} Headers: ${stringifyForLogging(headers)}`,
                { subModule: 'Communication' }
              );
            } else {
              logger.debug(`MCP Gateway error response: ${statusCode} ${statusMessage || ''}`, {
                subModule: 'Communication'
              });
            }
          }
        } catch (error) {
          logger.debug(`MCP Gateway: Error processing writeHead: ${error}`, {
            subModule: 'Communication'
          });
        }
        return originalWriteHead(statusCode, ...args);
      };
    };

    wrapReplyForDebug();

    reply.hijack();

    const startTime = Date.now();

    try {
      // Determine if initialize request is needed
      // Only explicit initialize requests require SDK initialization handling
      // For all other requests (tools/list, etc.), skip initialization checks
      const isInitializeRequest = request.body?.method === 'initialize';
      const hasRestoredState = !!mcpSessionManager.getSessionState(sessionId);
      const requireInitialize = isInitializeRequest;
      logger.debug(
        `Request for session: ${sessionId}, method: ${request.body?.method || 'GET'}, isInitialize: ${isInitializeRequest}, hasRestoredState: ${hasRestoredState}, requireInitialize: ${requireInitialize}`,
        { subModule: 'Gateway' }
      );

      const session = await mcpSessionManager.getSession(sessionId, requireInitialize);

      await requestContext.run(clientContext, async () => {
        if (
          request.method === 'GET' &&
          request.raw.url &&
          !request.raw.url.includes('sessionId=')
        ) {
          const separator = request.raw.url.includes('?') ? '&' : '?';
          request.raw.url = `${request.raw.url}${separator}sessionId=${sessionId}`;
          logger.debug(`Rewrote request URL with sessionId: ${request.raw.url}`);
        }

        // Add Mcp-Session-Id header to request for proper SDK session validation
        // Ensure headers object is modifiable (Node.js incoming message headers may be read-only)
        if (typeof request.headers === 'object' && request.headers !== null) {
          // Create a new modifiable headers object
          const modifiableHeaders = Object.assign({}, request.headers);
          modifiableHeaders['mcp-session-id'] = sessionId;
          modifiableHeaders['Mcp-Session-Id'] = sessionId;  // Add case-insensitive version
          request.headers = modifiableHeaders;
        }

        // Also modify request.raw.headers (Node.js original request object)
        if (request.raw && request.raw.headers) {
          request.raw.headers['mcp-session-id'] = sessionId;
          request.raw.headers['Mcp-Session-Id'] = sessionId;
        }

        // Also modify request.raw.rawHeaders directly, because @hono/node-server uses it
        // to create the Web Standard Headers object
        if (request.raw && request.raw.rawHeaders) {
          // Remove any existing mcp-session-id headers
          const filteredHeaders = [];
          for (let i = 0; i < request.raw.rawHeaders.length; i += 2) {
            const key = request.raw.rawHeaders[i];
            const value = request.raw.rawHeaders[i + 1];
            if (!key.toLowerCase().includes('mcp-session-id')) {
              filteredHeaders.push(key, value);
            }
          }
          // Add the new mcp-session-id header
          filteredHeaders.push('mcp-session-id', sessionId);
          request.raw.rawHeaders = filteredHeaders;

          logger.debug(`Modified rawHeaders: ${stringifyRawHeadersForLogging(request.raw.rawHeaders)}`, { subModule: 'Gateway' });
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
        reply.raw.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Internal Server Error',
              data: { sessionId }
            },
            id: null
          })
        );
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
