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
  // GET /mcp — not used, this is a Streamable HTTP server
  fastify.get('/mcp', (_request, reply) => {
    reply.code(405).send({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message:
          'GET /mcp is not supported. This is a Streamable HTTP MCP server — send POST /mcp with JSON-RPC requests directly.'
      },
      id: null
    });
  });

  // POST /mcp — JSON-RPC request handling
  const handlePostRequest = async (
    request: FastifyRequest<{ Body: unknown }>,
    reply: FastifyReply
  ) => {
    if (getMcpCommDebugSetting()) {
      let initialLogMsg = `MCP Gateway ${request.method} ${request.url}`;
      initialLogMsg += `\nRequest headers: ${stringifyForLogging(request.headers)}`;
      if (request.body) {
        try {
          const preview = stringifyForLogging(request.body);
          initialLogMsg += `\nBody: ${preview}`;
        } catch {
          initialLogMsg += `\nBody: [Unserializable]`;
        }
      }
      logger.debug(initialLogMsg, LOG_MODULES.COMMUNICATION);
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
        `Request body that caused error: ${stringifyForLogging(request.body)}`,
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

  fastify.post('/mcp', {
    bodyLimit: 10 * 1024 * 1024, // 10MB limit
    handler: handlePostRequest
  });

  // Subpath fallback
  fastify.post('/mcp/*', {
    bodyLimit: 10 * 1024 * 1024,
    handler: handlePostRequest
  });
}
