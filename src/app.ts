import Fastify from 'fastify';
import { serverRoutes } from './api/routes/server.routes.js';
import { mcpRoutes } from './api/routes/mcp.routes.js';

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

  fastify.register(serverRoutes);
  fastify.register(mcpRoutes);
  fastify.register(healthRoutes);
  fastify.register(connectionRoutes);

  return fastify;
}
