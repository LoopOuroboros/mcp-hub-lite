/**
 * MCP Gateway endpoint using stateful Streamable HTTP Transport.
 *
 * Each client session gets its own transport+server pair, identified by mcp-session-id header.
 * POST without sessionId creates a new session.
 * POST/GET/DELETE with sessionId routes to the existing session transport.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import { logger, LOG_MODULES } from '@utils/logger/index.js';
import {
  stringifyForLogging,
  getMcpCommDebugSetting,
  getGatewayDebugSetting
} from '@utils/json-utils.js';
import { wrapReplyForDebug } from './debug-response-wrapper.js';
import { setupTransportLogging } from '@services/gateway/global-transport.js';
import { sessionManager } from '@services/gateway/session-manager.js';
import { gateway } from '@services/gateway/gateway.service.js';
import { runWithRequestContext } from '@utils/request-context.js';

const MCP_SESSION_ID = 'mcp-session-id';

export async function mcpGatewayRoutes(fastify: FastifyInstance) {
  const logRequest = (request: FastifyRequest<{ Body: unknown }>) => {
    if (getMcpCommDebugSetting()) {
      let msg = `MCP Gateway ${request.method} ${request.url}`;
      msg += `\nRequest headers: ${stringifyForLogging(request.headers)}`;
      if (request.body) {
        try {
          msg += `\nBody: ${stringifyForLogging(request.body)}`;
        } catch {
          msg += '\nBody: [Unserializable]';
        }
      }
      logger.debug(msg, LOG_MODULES.COMMUNICATION);
    }
  };

  const sendError = (
    reply: FastifyReply,
    statusCode: number,
    code: number,
    message: string,
    id: unknown = null
  ) => {
    if (!reply.raw.headersSent) {
      reply.raw.writeHead(statusCode, { 'Content-Type': 'application/json' });
      reply.raw.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id }));
    }
  };

  fastify.all('/mcp', {
    bodyLimit: 10 * 1024 * 1024,
    handler: async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const sessionId = (request.headers[MCP_SESSION_ID] as string) || '';
      const traceId = randomUUID();
      await runWithRequestContext({ sessionId: sessionId || undefined, traceId }, async () => {
        logRequest(request);
        reply.header('Content-Type', 'application/json');
        wrapReplyForDebug(reply, sessionId);
        reply.hijack();

        try {
          // Existing session — route to its transport
          if (sessionId) {
            const session = sessionManager.getSession(sessionId);
            if (!session) {
              sendError(reply, 404, -32001, 'Session not found');
              return;
            }
            // Track SSE stream to prevent stale cleanup while GET is active
            if (request.method === 'GET') {
              sessionManager.markSseOpened(sessionId);
            }
            await session.transport.handleRequest(
              request.raw,
              reply.raw,
              request.method === 'POST' ? request.body : undefined
            );
            if (request.method === 'GET') {
              sessionManager.markSseClosed(sessionId);
            }
            if (getGatewayDebugSetting()) {
              logger.debug(
                `Handled MCP ${request.method} for session ${sessionId}`,
                LOG_MODULES.GATEWAY
              );
            }
            return;
          }

          // New session — POST only (initialize)
          if (request.method !== 'POST') {
            sendError(reply, 400, -32000, 'Missing mcp-session-id header');
            return;
          }

          // Create new stateful transport for this session
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessionclosed: (id) => {
              sessionManager.removeSession(id);
            }
          });
          setupTransportLogging(transport);

          const server = gateway.createConnectionServer();
          await server.connect(transport);

          await transport.handleRequest(request.raw, reply.raw, request.body);

          // After handleRequest completes, sessionId is available if init succeeded
          const newSessionId = transport.sessionId;
          if (newSessionId) {
            sessionManager.addSession(newSessionId, transport, server);
          }

          if (getGatewayDebugSetting()) {
            logger.debug(`Created new session ${newSessionId} via MCP POST`, LOG_MODULES.GATEWAY);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : 'No stack available';
          logger.error(`Error handling MCP request: ${errorMessage}`, LOG_MODULES.GATEWAY);
          logger.error(`Full error stack: ${errorStack}`, LOG_MODULES.GATEWAY);
          logger.error(`Request body: ${stringifyForLogging(request.body)}`, LOG_MODULES.GATEWAY);
          if (!reply.raw.headersSent) {
            reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
            reply.raw.end(
              JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Internal Server Error' },
                id: null
              })
            );
          }
        }
      });
    }
  });

  // Subpath fallback
  fastify.all('/mcp/*', {
    bodyLimit: 10 * 1024 * 1024,
    handler: async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const sessionId = (request.headers[MCP_SESSION_ID] as string) || '';
      const traceId = randomUUID();
      await runWithRequestContext({ sessionId: sessionId || undefined, traceId }, async () => {
        logRequest(request);
        reply.header('Content-Type', 'application/json');
        wrapReplyForDebug(reply, sessionId);
        reply.hijack();

        if (!sessionId) {
          if (!reply.raw.headersSent) {
            reply.raw.writeHead(400, { 'Content-Type': 'application/json' });
            reply.raw.end(
              JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Missing mcp-session-id header' },
                id: null
              })
            );
          }
          return;
        }

        const session = sessionManager.getSession(sessionId);
        if (!session) {
          if (!reply.raw.headersSent) {
            reply.raw.writeHead(404, { 'Content-Type': 'application/json' });
            reply.raw.end(
              JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32001, message: 'Session not found' },
                id: null
              })
            );
          }
          return;
        }

        try {
          await session.transport.handleRequest(
            request.raw,
            reply.raw,
            request.method === 'POST' ? request.body : undefined
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error handling MCP subpath request: ${errorMessage}`, LOG_MODULES.GATEWAY);
          if (!reply.raw.headersSent) {
            reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
            reply.raw.end(
              JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Internal Server Error' },
                id: null
              })
            );
          }
        }
      });
    }
  });
}
