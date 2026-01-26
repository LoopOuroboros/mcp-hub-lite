import { buildApp } from '../app.js';
import { configManager } from '../config/config-manager.js';
import { logger } from '../utils/logger.js';
import { mcpConnectionManager } from '../services/mcp-connection-manager.js';
import { PidManager } from '../pid/manager.js';

// Enable dev logging to file
logger.enableDevLog();

async function startDevServer() {
  try {
    const app = await buildApp();
    const config = configManager.getConfig();

    // Auto-connect to enabled servers
    logger.info('Initializing server connections...');
    const servers = config.servers.filter((s: any) => s.enabled);
    for (const server of servers) {
      mcpConnectionManager.connect(server).catch(err => {
        logger.error(`Failed to auto-connect to ${server.name}:`, err);
      });
    }

    // Listen on configured port
    await app.listen({
      port: config.port,
      host: config.host
    });
    logger.info(`MCP Hub Lite Dev Server running at http://${config.host}:${config.port}`);

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
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

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