/**
 * MCP Gateway endpoint using Streamable HTTP Transport (stateless mode)
 * Handles all MCP protocol requests at /mcp endpoint
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger, LOG_MODULES } from '@utils/logger/index.js';
import {
  stringifyForLogging,
  getMcpCommDebugSetting,
  getGatewayDebugSetting
} from '@utils/json-utils.js';
import { wrapReplyForDebug } from './debug-response-wrapper.js';
import { createSessionTransport } from '@services/gateway/global-transport.js';

/**
 * MCP Gateway routes registration.
 *
 * @param fastify - Fastify instance to register routes on
 */
export async function mcpGatewayRoutes(fastify: FastifyInstance) {
  const handleMcpRequest = async (
    request: FastifyRequest<{ Body: unknown }>,
    reply: FastifyReply
  ) => {
    // First, log that we received the request
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

    // Reject GET requests without Accept: text/event-stream (health-check hook compatibility)
    const accept = request.raw.headers['accept'] || '';
    if (request.method === 'GET' && !accept.includes('text/event-stream')) {
      reply.raw.writeHead(400, { 'Content-Type': 'application/json' });
      reply.raw.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: Accept: text/event-stream required' },
          id: null
        })
      );
      return;
    }

    reply.header('Content-Type', 'application/json');

    wrapReplyForDebug(reply, '');

    reply.hijack();

    try {
      if (getGatewayDebugSetting()) {
        logger.debug(`About to create session transport for MCP request`, LOG_MODULES.GATEWAY);
      }
      const { transport, server } = await createSessionTransport();
      if (getGatewayDebugSetting()) {
        logger.debug(
          `Created session transport successfully, handling MCP request`,
          LOG_MODULES.GATEWAY
        );
      }

      try {
        await transport.handleRequest(request.raw, reply.raw, request.body);
        if (getGatewayDebugSetting()) {
          logger.debug(
            `Successfully handled MCP request with server: ${server.constructor.name}`,
            LOG_MODULES.GATEWAY
          );
        }
      } finally {
        // Resources will be automatically cleaned up by garbage collection
        // since transport and server are local to this request scope
        if (getGatewayDebugSetting()) {
          logger.debug(
            `Session transport request completed, resources will be GC'd`,
            LOG_MODULES.GATEWAY
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack available';

      logger.error(`Error handling MCP request: ${errorMessage}`, LOG_MODULES.GATEWAY);
      logger.error(`Full error stack: ${errorStack}`, LOG_MODULES.GATEWAY);
      logger.error(
        `Request body that caused error: ${JSON.stringify(request.body)}`,
        LOG_MODULES.GATEWAY
      );

      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
        reply.raw.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Internal Server Error'
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

  // Handle any subpaths if client appends them
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
