import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';

// MCP Protocol Routes
import { mcpGatewayRoutes } from '@api/mcp/gateway.js';

// Web API Routes
import { webServerRoutes } from '@api/web/servers.js';
import { webSearchRoutes } from '@api/web/search.js';
import { webHealthRoutes } from '@api/web/health.js';
import { webMcpStatusRoutes } from '@api/web/mcp-status.js';
import { configRoutes } from '@api/web/config.js';
import { webLogRoutes } from '@api/web/logs.js';
import { webHubToolsRoutes } from '@api/web/hub-tools.js';
import { webClientRoutes } from '@api/web/clients.js';
import { webResourceRoutes } from '@api/web/resources.js';
import { webSessionRoutes } from '@api/web/sessions.js';

// WebSocket Routes
import { webSocketRoutes } from '@api/ws/events.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp() {
  const fastify = Fastify({
    logger: false // We use our own logger
  });

  // Simple CORS for dev
  fastify.addHook('onRequest', (request, reply, done) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') {
      reply.send();
      return;
    }
    done();
  });

  // Register API routes first (before static files)
  fastify.register(mcpGatewayRoutes);
  fastify.register(webServerRoutes);
  fastify.register(webSearchRoutes);
  fastify.register(webHealthRoutes);
  fastify.register(webMcpStatusRoutes);
  fastify.register(configRoutes);
  fastify.register(webLogRoutes);
  fastify.register(webHubToolsRoutes);
  fastify.register(webClientRoutes);
  fastify.register(webResourceRoutes);
  fastify.register(webSessionRoutes);
  fastify.register(webSocketRoutes);

  // Serve static files from dist/client (frontend build output)
  const clientPath = path.join(__dirname, '../../client');
  fastify.register(fastifyStatic, {
    root: clientPath,
    prefix: '/' // Serve at root
  });

  // Fallback route for SPA (redirect all non-API routes to index.html)
  fastify.setNotFoundHandler((request, reply) => {
    // Check if this is an API request
    if (
      request.url.startsWith('/api') ||
      request.url.startsWith('/web') ||
      request.url.startsWith('/mcp')
    ) {
      reply.code(404).send({
        message: `Route ${request.method}:${request.url} not found`,
        error: 'Not Found',
        statusCode: 404
      });
    } else {
      // For non-API routes, serve index.html (SPA fallback)
      reply.sendFile('index.html');
    }
  });

  return fastify;
}
