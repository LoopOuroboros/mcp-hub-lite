import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { configManager } from '@config/config-manager.js';
import { setJsonPrettyConfigGetter } from '@utils/json-utils.js';
import { isIpAllowed } from '@utils/network-security.js';
import { logger, LOG_MODULES } from '@utils/logger.js';

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

// Connection tracking counters (module-scoped, shared across all requests)
let currentConnections = 0;
let currentConcurrentRequests = 0;

const CONCURRENT_DECREMENTED = Symbol('concurrentDecremented');

/** Expose connection stats for diagnostic endpoints */
export function getConnectionStats() {
  const cfg = configManager.getConfig().security;
  return {
    currentConnections,
    currentConcurrentRequests,
    maxConnections: cfg.maxConnections,
    maxConcurrentConnections: cfg.maxConcurrentConnections
  };
}

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

  // ===== Security: per-socket timeout + maxConnections =====
  fastify.server.on('connection', (socket) => {
    socket.setTimeout(config.security.connectionTimeout);
    socket.on('timeout', () => {
      socket.destroy(new Error('Connection timeout'));
    });

    currentConnections++;
    socket.on('close', () => {
      currentConnections--;
    });
    socket.on('error', (err) => {
      logger.debug(`Socket error (will be closed): ${err.message}`, LOG_MODULES.SERVER);
    });

    if (currentConnections > config.security.maxConnections) {
      socket.destroy();
    }
  });

  // ===== Security: IP allowlist =====
  fastify.addHook('onRequest', (request, reply, done) => {
    const allowed = config.security.allowedNetworks;
    if (allowed.length > 0 && !isIpAllowed(request.ip, allowed)) {
      reply.code(403).send({
        error: 'Forbidden',
        message: `Access denied: ${request.ip} is not allowed`
      });
      return;
    }
    done();
  });

  // ===== Security: concurrent request limit =====
  fastify.addHook('onRequest', (_request, reply, done) => {
    if (currentConcurrentRequests >= config.security.maxConcurrentConnections) {
      reply.code(503).send({
        error: 'Service Unavailable',
        message: 'Too many concurrent requests'
      });
      return;
    }
    currentConcurrentRequests++;

    // Safety net: decrement on premature connection close (e.g. SSE timeout).
    // Prevents counter drift for hijacked long-lived connections whose
    // onResponse hook may not fire when the socket is destroyed by timeout.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (reply.raw as any)[CONCURRENT_DECREMENTED] = false;
    reply.raw.on('close', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(reply.raw as any)[CONCURRENT_DECREMENTED]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (reply.raw as any)[CONCURRENT_DECREMENTED] = true;
        currentConcurrentRequests--;
      }
    });

    // Warn when approaching the configured limit
    if (currentConcurrentRequests > config.security.maxConcurrentConnections * 0.8) {
      logger.warn(
        `High concurrent requests: ${currentConcurrentRequests}/${config.security.maxConcurrentConnections}`,
        LOG_MODULES.SERVER
      );
    }

    done();
  });

  fastify.addHook('onResponse', (_request, reply, done) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(reply.raw as any)[CONCURRENT_DECREMENTED]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (reply.raw as any)[CONCURRENT_DECREMENTED] = true;
      currentConcurrentRequests--;
      if (currentConcurrentRequests < 0) {
        logger.warn(
          'currentConcurrentRequests went negative in onResponse, resetting to 0',
          LOG_MODULES.SERVER
        );
        currentConcurrentRequests = 0;
      }
    }
    done();
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
