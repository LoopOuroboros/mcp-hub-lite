/**
 * MCP Gateway endpoint using Streamable HTTP Transport
 * Handles all MCP protocol requests at /mcp endpoint
 *
 * This is a thin wrapper around modular utilities for better maintainability.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { stringifyForLogging, stringifyRawHeadersForLogging } from '@utils/json-utils.js';
import { requestContext } from '@utils/request-context.js';
import { clientTrackerService } from '@services/client-tracker.service.js';
import { mcpSessionManager } from '@services/mcp-session-manager.js';
import { cleanupStaleSseStreams } from './sse-stream-manager.js';
import { extractSessionContext, type RequestBody } from './session-context-extractor.js';
import { wrapReplyForDebug } from './debug-response-wrapper.js';

/**
 * MCP Gateway routes registration.
 *
 * @param fastify - Fastify instance to register routes on
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
    logger.info(logMsg, LOG_MODULES.GATEWAY);

    reply.header('Content-Type', 'application/json');
    if (!request.headers['accept']) {
      request.headers['accept'] = 'application/json, text/event-stream';
    }

    wrapReplyForDebug(reply, sessionId);

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
        LOG_MODULES.GATEWAY
      );

      const session = await mcpSessionManager.getSession(sessionId, requireInitialize);

      // Proactive cleanup: For GET requests (SSE connections), clean up stale streams first
      // This prevents "Only one SSE stream is allowed per session" errors
      if (request.method === 'GET') {
        logger.debug(`Proactive SSE stream cleanup for session ${sessionId} before handling request`, LOG_MODULES.GATEWAY);
        cleanupStaleSseStreams(session.transport, sessionId);
      }

      await requestContext.run(clientContext, async () => {
        if (
          request.method === 'GET' &&
          request.raw.url &&
          !request.raw.url.includes('sessionId=')
        ) {
          const separator = request.raw.url.includes('?') ? '&' : '?';
          request.raw.url = `${request.raw.url}${separator}sessionId=${sessionId}`;
          logger.debug(`Rewrote request URL with sessionId: ${request.raw.url}`, LOG_MODULES.GATEWAY);
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

          logger.debug(`Modified rawHeaders: ${stringifyRawHeadersForLogging(request.raw.rawHeaders)}`, LOG_MODULES.GATEWAY);
        }

        await session.transport.handleRequest(request.raw, reply.raw, request.body);
      });

      const duration = Date.now() - startTime;
      logger.info(`MCP Gateway response for ${sessionId}: handled in ${duration}ms`, LOG_MODULES.GATEWAY);
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
