import { buildApp } from '@src/app.js';
import { configManager } from '@config/config-manager.js';
import { logger } from '@utils/logger.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';
import { setJsonPrettyConfigGetter } from '@utils/json-utils.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { PidManager } from '@pid/manager.js';
import { checkPortWithExit } from '@utils/port-checker.js';
import { collectConnectTasks, executeConnectTasks } from './startup.js';

/**
 * Starts the MCP Hub Lite server.
 *
 * This function is the main entry point for running the MCP Hub Lite server in production.
 * It handles the HTTP server mode with REST API, WebSocket support, and web interface
 * on the specified host and port.
 *
 * The function performs the following key operations:
 * - Validates and checks port availability
 * - Starts the Fastify HTTP server
 * - Triggers connection to all enabled MCP servers from configuration
 * - Sets up graceful shutdown handlers for SIGTERM and SIGINT signals
 * - Manages PID file creation and cleanup for process tracking
 * - Handles both successful startup and error scenarios with appropriate logging
 *
 * @param options - Configuration options for server startup
 * @param options.port - Override the configured port number
 * @param options.host - Override the configured host address
 *
 * @returns Promise that resolves when the server is successfully started,
 *          or rejects with an error if startup fails
 *
 * @throws {Error} If server startup fails due to port conflicts, configuration errors,
 *                 or other critical issues. The process will exit with code 1 in such cases.
 *
 * @example
 * // Start with default config
 * await runServer();
 *
 * @example
 * // Start on custom port and host
 * await runServer({ port: 8080, host: '0.0.0.0' });
 *
 * @remarks
 * - The function will check if the specified port is already in use and provide
 *   detailed error messages for port conflicts
 * - The function automatically connects to all enabled servers configured in .mcp-hub.json
 * - Graceful shutdown ensures proper cleanup of connections and PID files when receiving termination signals
 * - This function is typically called from the CLI entry point (`src/index.ts`)
 */
export async function runServer(options: { port?: number; host?: string } = {}) {
  try {
    const config = configManager.getConfig();

    // Set config getter for json-utils to use config from configManager
    setJsonPrettyConfigGetter(() => configManager.getConfig());

    const app = await buildApp();

    // Override config with options if provided
    const host = options.host || config.system.host;
    const port = options.port || config.system.port;

    // Check if port is already in use
    await checkPortWithExit(port);

    // Setup signal handlers for graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`, LOG_MODULES.SERVER);
      try {
        await mcpConnectionManager.disconnectAll();
        if (app) {
          await app.close();
        }
        PidManager.removePid();
        logger.info('Server stopped gracefully', LOG_MODULES.SERVER);
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error, LOG_MODULES.SERVER);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Start listening FIRST, then trigger connection tasks
    await app.listen({ port, host });
    logger.info(`MCP Hub Lite Server running at http://${host}:${port}`, LOG_MODULES.SERVER);
    // Write PID after server starts successfully
    PidManager.writePid();

    // Auto-create instances for enabled servers without existing instances
    const serverConfigs = configManager.getServers();
    for (const { name: serverName } of serverConfigs) {
      const existingInstances = configManager.getServerInstancesByName(serverName);
      if (existingInstances.length === 0) {
        try {
          await configManager.addServerInstance(serverName, {});
        } catch (err) {
          logger.error(`Failed to create instance for ${serverName}:`, err, LOG_MODULES.SERVER);
        }
      }
    }

    // Trigger connection tasks (fire-and-forget, with sequential delay)
    const tasks = collectConnectTasks();
    const baseDelay = config.system.startup?.startupDelay ?? 3000;
    executeConnectTasks(tasks, baseDelay, LOG_MODULES.SERVER);
  } catch (err) {
    logger.error('Failed to start server:', err, LOG_MODULES.SERVER);
    // Clean up PID file if it exists
    PidManager.removePid();
    process.exit(1);
  }
}
