import Fastify from 'fastify';
// MCP Protocol Routes
import { mcpGatewayRoutes } from './api/mcp/gateway.js';

// Web API Routes
import { webServerRoutes } from './api/web/servers.js';
import { webSearchRoutes } from './api/web/search.js';
import { webHealthRoutes } from './api/web/health.js';
import { webMcpStatusRoutes } from './api/web/mcp-status.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: false // We use our own logger
  });

  // Simple CORS for dev
  fastify.addHook('onRequest', (request, reply, done) => {
      reply.header("Access-Control-Allow-Origin", "*");
      reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      reply.header("Access-Control-Allow-Headers", "Content-Type");
      if (request.method === 'OPTIONS') {
          reply.send();
          return;
      }
      done();
  });

  fastify.register(mcpGatewayRoutes);
  fastify.register(webServerRoutes);
  fastify.register(webSearchRoutes);
  fastify.register(webHealthRoutes);
  fastify.register(webMcpStatusRoutes);

  return fastify;
}
