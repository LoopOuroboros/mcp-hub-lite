import { buildApp } from '../app.js';
import { configManager } from '../config/config-manager.js';
import { logger } from '../utils/logger.js';
import { mcpConnectionManager } from '../services/mcp-connection-manager.js';
import { gateway } from '../services/gateway.service.js';
import { PidManager } from '../pid/manager.js';
import { checkPort } from '../utils/port-checker.js';

export async function runServer(options: { stdio?: boolean, port?: number, host?: string } = {}) {
  try {
    const isStdio = options.stdio || false;

    if (isStdio) {
        logger.setUseStderr(true);
        logger.info('Starting in MCP Gateway mode (stdio)...');
    }

    const app = isStdio ? null : await buildApp();
    const config = configManager.getConfig();

    // Override config with options if provided
    const host = options.host || config.host;
    const port = options.port || config.port;

    // Check if port is already in use (only for HTTP mode)
    if (!isStdio) {
      const portCheck = await checkPort(port);
      if (portCheck.inUse) {
        if (portCheck.isSelfProject) {
          // 本项目已在运行
          logger.error(`MCP Hub Lite is already running on port ${port} (PID: ${portCheck.pid})`);
          logger.error(`Use 'npm run stop' or 'mcp-hub-lite stop' to stop the running instance.`);
          process.exit(1);
        } else {
          // 其他程序占用端口
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
    const servers = config.servers.filter((s: any) => s.enabled);
    for (const server of servers) {
        // Connect in background to not block startup
        mcpConnectionManager.connect(server).catch(err => {
            logger.error(`Failed to auto-connect to ${server.name}:`, err);
        });
    }

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
