import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { configManager } from '@config/config-manager.js';
import { setJsonPrettyConfigGetter } from '@utils/json-utils.js';

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
import { webResourceRoutes } from '@api/web/resources.js';

// WebSocket Routes
import { webSocketRoutes } from '@api/ws/events.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates and configures a Fastify application instance for the MCP Hub Lite service.
 *
 * This function sets up the complete HTTP server with all necessary routes, middleware,
 * and static file serving capabilities. It configures CORS headers for development,
 * registers all API routes (MCP gateway, web APIs, and WebSocket endpoints), and serves
 * the frontend SPA from the client directory.
 *
 * The application follows a layered architecture:
 * - API routes are registered first to ensure proper routing precedence
 * - Static file serving is configured for the built frontend assets
 * - SPA fallback handling redirects non-API routes to index.html for client-side routing
 *
 * @returns {Promise&lt;import('fastify').FastifyInstance&gt;} A configured Fastify instance ready to listen for requests
 * @throws {Error} If Fastify fails to initialize or register plugins
 *
 * @example
 * ```typescript
 * const app = await buildApp();
 * await app.listen({ port: 3000, host: '0.0.0.0' });
 * ```
 */
export async function buildApp() {
  const config = configManager.getConfig();
  const fastify = Fastify({
    logger: false // We use our own logger
  });

  // Set up config getters for json-utils
  setJsonPrettyConfigGetter(() => configManager.getConfig());

  // Set HTTP connection timeouts for SSE long-lived connections
  // Use idleConnectionTimeout from config (default 5 minutes)
  // Add extra buffer to prevent premature disconnect
  const idleTimeout = config.security.idleConnectionTimeout;
  fastify.server.keepAliveTimeout = idleTimeout;
  fastify.server.headersTimeout = idleTimeout + 5000; // headersTimeout must be longer than keepAliveTimeout

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
  fastify.register(webResourceRoutes);
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
