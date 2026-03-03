/**
 * MCP Gateway endpoint using Streamable HTTP Transport
 * Handles all MCP protocol requests at /mcp endpoint
 *
 * This is a thin wrapper around modular utilities for better maintainability.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { stringifyForLogging } from '@utils/json-utils.js';
import { requestContext } from '@utils/request-context.js';
import { clientTrackerService } from '@services/client-tracker.service.js';
import { mcpSessionManager } from '@services/mcp-session-manager.js';
import { configManager } from '@config/config-manager.js';
import { cleanupStaleSseStreams } from './sse-stream-manager.js';
import { extractSessionContext, type RequestBody } from './session-context-extractor.js';
import { wrapReplyForDebug } from './debug-response-wrapper.js';

// Track last SSE connection time per session for reconnection detection
const sseConnectionTimestamps = new Map<string, number>();

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
    // First, log that we received the request (before extracting session context)
    let initialLogMsg = `MCP Gateway ${request.method} ${request.url}`;

    // Combine headers and body into one log block
    initialLogMsg += `\n  Request headers: ${stringifyForLogging(request.headers)}`;

    if (request.body) {
      try {
        const preview = stringifyForLogging(request.body);
        initialLogMsg += `\n  Body: ${preview}`;
      } catch {
        initialLogMsg += `\n  Body: [Unserializable]`;
      }
    }
    logger.info(initialLogMsg, LOG_MODULES.GATEWAY);

    const { sessionId, clientContext } = extractSessionContext(request);

    // Detect and log SSE reconnection (DEBUG level only)
    if (request.method === 'GET') {
      const lastConnectionTime = sseConnectionTimestamps.get(sessionId);
      const reconnectThreshold = configManager.getConfig().security.sessionTimeout;
      if (lastConnectionTime) {
        const timeSinceLastConnection = Date.now() - lastConnectionTime;
        if (timeSinceLastConnection < reconnectThreshold) {
          logger.debug(
            `SSE reconnection detected for session ${sessionId}: ${Math.round(timeSinceLastConnection / 1000)}s after last connection`,
            LOG_MODULES.GATEWAY
          );
        } else {
          logger.debug(
            `SSE new connection for session ${sessionId}: ${Math.round(timeSinceLastConnection / 1000)}s after last connection (exceeds threshold of ${Math.round(reconnectThreshold / 1000)}s)`,
            LOG_MODULES.GATEWAY
          );
        }
      } else {
        logger.debug(`SSE first connection for session ${sessionId}`, LOG_MODULES.GATEWAY);
      }
      // Update the timestamp for this session
      sseConnectionTimestamps.set(sessionId, Date.now());
    }

    // Update client tracking information
    clientTrackerService.updateClient(clientContext);

    // Log the session context after extraction
    let sessionLogMsg = `MCP Gateway Session Context [Session: ${sessionId}]`;
    if (clientContext.cwd) sessionLogMsg += ` [CWD: ${clientContext.cwd}]`;
    if (clientContext.clientName) sessionLogMsg += ` [Client: ${clientContext.clientName}]`;
    logger.debug(sessionLogMsg, LOG_MODULES.GATEWAY);

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
        logger.debug(
          `Proactive SSE stream cleanup for session ${sessionId} before handling request`,
          LOG_MODULES.GATEWAY
        );
        cleanupStaleSseStreams(session.transport, sessionId);
      }

      await requestContext.run(clientContext, async () => {
        await session.transport.handleRequest(request.raw, reply.raw, request.body);
      });

      const duration = Date.now() - startTime;
      logger.info(
        `MCP Gateway response for ${sessionId}: handled in ${duration}ms`,
        LOG_MODULES.GATEWAY
      );
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
