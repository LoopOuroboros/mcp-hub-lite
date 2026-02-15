import { buildApp } from '@src/app.js';
import { configManager } from '@config/config-manager.js';
import { logger } from '@utils/logger.js';
import { telemetryManager } from '@utils/telemetry/index.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { gateway } from '@services/gateway.service.js';
import { PidManager } from '@pid/manager.js';
import { checkPort } from '@utils/port-checker.js';

export async function runServer(options: { stdio?: boolean; port?: number; host?: string } = {}) {
  try {
    const isStdio = options.stdio || false;

    if (isStdio) {
      logger.setUseStderr(true);
      logger.info('Starting in MCP Gateway mode (stdio)...');
    }

    const config = configManager.getConfig();

    // Initialize OpenTelemetry tracing
    telemetryManager.initialize(config);

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
            mcpConnectionManager.connect({ ...serverConfig, ...newInstance }).catch((err) => {
              logger.error(`Failed to auto-connect to ${serverName}:`, err);
            });
          } catch (err) {
            logger.error(`Failed to create instance for ${serverName}:`, err);
          }
        } else {
          // Connect existing instances
          existingInstances.forEach((instance) => {
            mcpConnectionManager.connect({ ...serverConfig, ...instance }).catch((err) => {
              logger.error(`Failed to auto-connect to ${serverName}:`, err);
            });
          });
        }
      }
    }

    // Setup signal handlers for graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`);
      try {
        await mcpConnectionManager.disconnectAll();
        if (!isStdio && app) {
          await app.close();
        }
        // Shutdown OpenTelemetry gracefully
        await telemetryManager.shutdown();
        PidManager.removePid();
        logger.info('Server stopped gracefully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
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
      logger.info(`MCP Hub Lite Server running at http://${host}:${port}`);
      // Write PID after server starts successfully
      PidManager.writePid();
    }
  } catch (err) {
    logger.error('Failed to start server:', err);
    // Clean up PID file if it exists
    PidManager.removePid();
    process.exit(1);
  }
}
