import { buildApp } from '@src/app.js';
import type { FastifyInstance } from 'fastify';
import { configManager } from '@config/config-manager.js';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { PidManager } from '@pid/manager.js';
import { telemetryManager } from '@utils/telemetry/index.js';

// Set log level to debug for development server
logger.setLevel('debug');

// Enable dev logging to file (this also enables communication debug logging)
logger.enableDevLog();

let app: FastifyInstance | null = null;

/**
 * Starts the MCP Hub Lite development server with enhanced debugging capabilities.
 *
 * This function initializes and starts a development-focused Fastify server instance
 * with the following features:
 * - Debug-level logging enabled for detailed development insights
 * - Development log file output for persistent debugging information
 * - Automatic connection to all enabled MCP servers configured in the system
 * - OpenTelemetry tracing initialization for observability
 * - PID file management for process tracking
 * - Graceful shutdown handling for SIGTERM and SIGINT signals
 *
 * The development server differs from the production server by:
 * - Using debug log level instead of info/warn
 * - Enabling development-specific logging to file
 * - Automatically connecting to all enabled servers on startup
 * - Providing enhanced error reporting for development debugging
 *
 * Usage:
 * - Called automatically when running `npm run dev` or `npm run dev:server`
 * - Should only be used in development environments, not production
 * - Handles its own process lifecycle including graceful shutdown
 *
 * Error Handling:
 * - Catches and logs any startup errors with full stack traces
 * - Cleans up PID file on startup failure
 * - Exits process with code 1 on fatal errors
 * - Provides graceful shutdown on termination signals
 *
 * @async
 * @returns {Promise<void>} Resolves when server starts successfully and begins listening.
 *                          Never resolves if server fails to start (process exits with code 1).
 * @throws {Error} If server fails to initialize or start due to configuration errors,
 *                 port conflicts, invalid server configurations, or other startup issues.
 *                 Note: Errors are caught internally and cause process.exit(1), so the promise
 *                 typically does not reject but rather the process terminates.
 *
 * @example
 * ```typescript
 * // Typically called automatically at module level
 * startDevServer();
 * ```
 *
 * @see {@link buildApp} - Creates the Fastify application instance
 * @see {@link configManager} - Manages server configuration and MCP server instances
 * @see {@link mcpConnectionManager} - Handles MCP server connections and communication
 * @see {@link telemetryManager} - Manages OpenTelemetry tracing and observability
 * @see {@link PidManager} - Handles PID file creation and cleanup
 */
async function startDevServer() {
  try {
    // Log startup separator
    logger.info('------------------------------------------------', LOG_MODULES.DEV_SERVER);
    logger.info('MCP Hub Lite Dev Server Starting...', LOG_MODULES.DEV_SERVER);
    logger.info(`Start Time: ${new Date().toISOString()}`, LOG_MODULES.DEV_SERVER);
    logger.info('------------------------------------------------', LOG_MODULES.DEV_SERVER);

    app = await buildApp();
    const config = configManager.getConfig();

    // Initialize OpenTelemetry tracing
    telemetryManager.initialize(config);

    // Auto-connect to enabled servers
    logger.info('Initializing server connections...', LOG_MODULES.DEV_SERVER);
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
            mcpConnectionManager.connect({ ...serverConfig, ...newInstance }).catch((err) => {
              logger.error(`Failed to auto-connect to ${serverName}:`, err, LOG_MODULES.DEV_SERVER);
            });
          } catch (err) {
            logger.error(
              `Failed to create instance for ${serverName}:`,
              err,
              LOG_MODULES.DEV_SERVER
            );
          }
        } else {
          // Connect existing instances
          existingInstances.forEach((instance) => {
            mcpConnectionManager.connect({ ...serverConfig, ...instance }).catch((err) => {
              logger.error(`Failed to auto-connect to ${serverName}:`, err, LOG_MODULES.DEV_SERVER);
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
    logger.info(
      `MCP Hub Lite Dev Server running at http://${config.system.host}:${config.system.port}`,
      LOG_MODULES.DEV_SERVER
    );

    // Write PID file after server starts successfully
    PidManager.writePid();
  } catch (err) {
    logger.error('Failed to start dev server:', err, LOG_MODULES.DEV_SERVER);
    // Clean up PID file if it exists
    PidManager.removePid();
    process.exit(1);
  }
}

/**
 * Handles graceful shutdown of the development server when receiving termination signals.
 *
 * This function performs a clean shutdown sequence to ensure:
 * - All MCP server connections are properly disconnected
 * - The Fastify HTTP server is closed gracefully
 * - OpenTelemetry tracing resources are properly shut down
 * - PID file is removed to prevent stale process detection
 * - All resources are cleaned up before process exit
 *
 * It handles both SIGTERM (termination request) and SIGINT (interrupt/CTRL+C) signals,
 * providing consistent shutdown behavior regardless of how the process is terminated.
 *
 * Error Handling:
 * - Catches and logs any errors during shutdown process
 * - Ensures PID file is always removed even if shutdown fails
 * - Exits with code 0 on successful shutdown, or after logging errors
 *
 * @param signal - The termination signal that triggered shutdown ('SIGTERM' or 'SIGINT')
 * @returns {Promise<void>} Resolves when shutdown sequence completes successfully
 */
// Handle graceful shutdown for better restart experience
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`, LOG_MODULES.DEV_SERVER);
  try {
    await mcpConnectionManager.disconnectAll();
    if (app) {
      await app.close();
    }
    // Shutdown OpenTelemetry gracefully
    await telemetryManager.shutdown();
    PidManager.removePid();
    logger.info('Dev server stopped gracefully', LOG_MODULES.DEV_SERVER);
  } catch (error) {
    logger.error('Error during shutdown:', error, LOG_MODULES.DEV_SERVER);
    PidManager.removePid();
  }
  process.exit(0);
};

process.on('SIGTERM', () =>
  shutdown('SIGTERM').catch((err) => {
    logger.error('Shutdown failed:', err, LOG_MODULES.DEV_SERVER);
    process.exit(1);
  })
);

process.on('SIGINT', () =>
  shutdown('SIGINT').catch((err) => {
    logger.error('Shutdown failed:', err, LOG_MODULES.DEV_SERVER);
    process.exit(1);
  })
);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err, LOG_MODULES.DEV_SERVER);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason, LOG_MODULES.DEV_SERVER);
  process.exit(1);
});

startDevServer();
