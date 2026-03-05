import { buildApp } from '@src/app.js';
import { configManager } from '@config/config-manager.js';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { setJsonPrettyConfigGetter } from '@utils/json-utils.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { gateway } from '@services/gateway.service.js';
import { PidManager } from '@pid/manager.js';
import { checkPort } from '@utils/port-checker.js';

/**
 * Starts the MCP Hub Lite server in either HTTP mode or stdio MCP gateway mode.
 *
 * This function is the main entry point for running the MCP Hub Lite server in production.
 * It handles two distinct operational modes:
 *
 * 1. **HTTP Server Mode** (default): Runs a full Fastify HTTP server with REST API,
 *    WebSocket support, and web interface on the specified host and port.
 *
 * 2. **Stdio MCP Gateway Mode**: Runs as an MCP (Model Context Protocol) gateway
 *    that communicates via stdin/stdout streams, suitable for integration with
 *    MCP-compatible clients like IDEs or AI assistants.
 *
 * The function performs the following key operations:
 * - Validates and checks port availability (HTTP mode only)
 * - Automatically connects to all enabled MCP servers from configuration
 * - Sets up graceful shutdown handlers for SIGTERM and SIGINT signals
 * - Manages PID file creation and cleanup for process tracking
 * - Handles both successful startup and error scenarios with appropriate logging
 *
 * @param options - Configuration options for server startup
 * @param options.stdio - When true, runs in stdio MCP gateway mode instead of HTTP server mode
 * @param options.port - Override the configured port number (HTTP mode only)
 * @param options.host - Override the configured host address (HTTP mode only)
 *
 * @returns Promise that resolves when the server is successfully started,
 *          or rejects with an error if startup fails
 *
 * @throws {Error} If server startup fails due to port conflicts, configuration errors,
 *                 or other critical issues. The process will exit with code 1 in such cases.
 *
 * @example
 * // Start in default HTTP mode
 * await runServer();
 *
 * @example
 * // Start in stdio MCP gateway mode
 * await runServer({ stdio: true });
 *
 * @example
 * // Start HTTP server on custom port and host
 * await runServer({ port: 8080, host: '0.0.0.0' });
 *
 * @remarks
 * - In HTTP mode, the function will check if the specified port is already in use
 *   and provide detailed error messages for port conflicts
 * - In stdio mode, port checking is skipped as no network ports are used
 * - The function automatically connects to all enabled servers configured in .mcp-hub.json
 * - Graceful shutdown ensures proper cleanup of connections and PID files when receiving termination signals
 * - This function is typically called from the CLI entry point (`src/index.ts`)
 */
export async function runServer(options: { stdio?: boolean; port?: number; host?: string } = {}) {
  try {
    const isStdio = options.stdio || false;

    if (isStdio) {
      logger.setUseStderr(true);
      logger.info('Starting in MCP Gateway mode (stdio)...', LOG_MODULES.SERVER);
    }

    const config = configManager.getConfig();

    // Set config getter for json-utils to use config from configManager
    setJsonPrettyConfigGetter(() => configManager.getConfig());

    const app = isStdio ? null : await buildApp();

    // Override config with options if provided
    const host = options.host || config.system.host;
    const port = options.port || config.system.port;

    // Check if port is already in use (only for HTTP mode)
    if (!isStdio) {
      const portCheck = await checkPort(port);
      if (portCheck.inUse) {
        if (portCheck.isSelfProject) {
          // This project is already running
          logger.error(`MCP Hub Lite is already running on port ${port} (PID: ${portCheck.pid})`);
          logger.error(`Use 'npm run stop' or 'mcp-hub-lite stop' to stop the running instance.`);
          process.exit(1);
        } else {
          // Port is occupied by another application
          logger.error(`Port ${port} is already in use by another application:`);
          logger.error(`  Process: ${portCheck.processName} (PID: ${portCheck.pid})`);
          if (portCheck.commandLine) {
            logger.error(`  Command: ${portCheck.commandLine}`);
          }
          logger.error(`Please stop the conflicting application or use a different port.`);
          process.exit(1);
        }
      }
    }

    // Auto-connect to enabled servers
    logger.info('Initializing server connections...', LOG_MODULES.SERVER);
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
              logger.error(`Failed to auto-connect to ${serverName}:`, err, LOG_MODULES.SERVER);
            });
          } catch (err) {
            logger.error(`Failed to create instance for ${serverName}:`, err, LOG_MODULES.SERVER);
          }
        } else {
          // Connect existing instances
          existingInstances.forEach((instance) => {
            mcpConnectionManager.connect({ ...serverConfig, ...instance }).catch((err) => {
              logger.error(`Failed to auto-connect to ${serverName}:`, err, LOG_MODULES.SERVER);
            });
          });
        }
      }
    }

    // Setup signal handlers for graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`, LOG_MODULES.SERVER);
      try {
        await mcpConnectionManager.disconnectAll();
        if (!isStdio && app) {
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

    if (isStdio) {
      await gateway.start();
      // Write PID after gateway starts successfully
      PidManager.writePid();
    } else {
      await app!.listen({ port, host });
      logger.info(`MCP Hub Lite Server running at http://${host}:${port}`, LOG_MODULES.SERVER);
      // Write PID after server starts successfully
      PidManager.writePid();
    }
  } catch (err) {
    logger.error('Failed to start server:', err, LOG_MODULES.SERVER);
    // Clean up PID file if it exists
    PidManager.removePid();
    process.exit(1);
  }
}
