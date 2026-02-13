import { buildApp } from '@src/app.js';
import type { FastifyInstance } from 'fastify';
import { configManager } from '@config/config-manager.js';
import { logger } from '@utils/logger.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { PidManager } from '@pid/manager.js';
import { telemetryManager } from '@utils/telemetry/index.js';

// Set log level to debug for development server
logger.setLevel('debug');

// Enable dev logging to file
logger.enableDevLog();

let app: FastifyInstance | null = null;

async function startDevServer() {
  try {
    app = await buildApp();
    const config = configManager.getConfig();

    // Initialize OpenTelemetry tracing
    telemetryManager.initialize(config);

    // Auto-connect to enabled servers
    logger.info('Initializing server connections...');
    const serverConfigs = configManager.getServers();
    for (const { name: serverName, config: serverConfig } of serverConfigs) {
      if (serverConfig.enabled) {
        // Check if there are existing instances
        const existingInstances = configManager.getServerInstanceByName(serverName);
        if (existingInstances.length === 0) {
          // Auto-create instance for enabled servers
          try {
            const newInstance = await configManager.addServerInstance(serverName, {});
            // Connect the new instance
            mcpConnectionManager.connect({ ...serverConfig, ...newInstance }).catch(err => {
              logger.error(`Failed to auto-connect to ${serverName}:`, err);
            });
          } catch (err) {
            logger.error(`Failed to create instance for ${serverName}:`, err);
          }
        } else {
          // Connect existing instances
          existingInstances.forEach(instance => {
            mcpConnectionManager.connect({ ...serverConfig, ...instance }).catch(err => {
              logger.error(`Failed to auto-connect to ${serverName}:`, err);
            });
          });
        }
      }
    }

    // Listen on configured port
    await app.listen({
      port: config.system.port,
      host: config.system.host
    });
    logger.info(`MCP Hub Lite Dev Server running at http://${config.system.host}:${config.system.port}`);

    // Write PID file after server starts successfully
    PidManager.writePid();

  } catch (err) {
    logger.error('Failed to start dev server:', err);
    // Clean up PID file if it exists
    PidManager.removePid();
    process.exit(1);
  }
}

// Handle graceful shutdown for better restart experience
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  try {
    await mcpConnectionManager.disconnectAll();
    if (app) {
      await app.close();
    }
    // Shutdown OpenTelemetry gracefully
    await telemetryManager.shutdown();
    PidManager.removePid();
    logger.info('Dev server stopped gracefully');
  } catch (error) {
    logger.error('Error during shutdown:', error);
    PidManager.removePid();
  }
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM').catch(err => {
  logger.error('Shutdown failed:', err);
  process.exit(1);
}));

process.on('SIGINT', () => shutdown('SIGINT').catch(err => {
  logger.error('Shutdown failed:', err);
  process.exit(1);
}));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startDevServer();