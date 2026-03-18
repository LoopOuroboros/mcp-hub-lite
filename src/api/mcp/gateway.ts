/**
 * MCP Gateway endpoint using Streamable HTTP Transport
 * Handles all MCP protocol requests at /mcp endpoint
 *
 * This is a thin wrapper around modular utilities for better maintainability.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { stringifyForLogging, getMcpCommDebugSetting } from '@utils/json-utils.js';
import { requestContext } from '@utils/request-context.js';
import { sessionTrackerService } from '@services/session-tracker.service.js';
import { mcpSessionManager } from '@services/session/index.js';
import { cleanupStaleSseStreams } from './sse-stream-manager.js';
import { extractSessionContext } from './session-context-extractor.js';
import type { RequestBody } from './session-context-extractor.js';
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
    // First, log that we received the request (before extracting session context)
    if (getMcpCommDebugSetting()) {
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
      logger.debug(initialLogMsg, LOG_MODULES.COMMUNICATION);
    }

    const { sessionId, sessionContext } = extractSessionContext(request);

    logger.info(
      `MCP Gateway ${request.method} ${request.url} [Session: ${sessionId}]`,
      LOG_MODULES.GATEWAY
    );

    // Update session tracking information
    sessionTrackerService.updateSession(sessionContext);

    // Log the session context after extraction
    if (getMcpCommDebugSetting()) {
      let sessionLogMsg = `MCP Gateway Session Context [Session: ${sessionId}]`;
      if (sessionContext.cwd) sessionLogMsg += ` [CWD: ${sessionContext.cwd}]`;
      if (sessionContext.clientName) sessionLogMsg += ` [Client: ${sessionContext.clientName}]`;
      logger.debug(sessionLogMsg, LOG_MODULES.COMMUNICATION);
    }

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

      await requestContext.run(sessionContext, async () => {
        await session.transport.handleRequest(request.raw, reply.raw, request.body);
      });

      const duration = Date.now() - startTime;
      logger.info(
        `MCP Gateway response for ${sessionId}: handled in ${duration}ms`,
        LOG_MODULES.GATEWAY
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(
        `Error handling MCP request for session ${sessionId}: ${errorMessage}`,
        error,
        LOG_MODULES.GATEWAY
      );
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
