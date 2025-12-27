import { buildApp } from './app.js';
import { configManager } from './config/config.manager.js';
import { logger } from './utils/logger.js';
import { mcpConnectionManager } from './services/mcp-connection.manager.js';

async function start() {
  try {
    const app = await buildApp();
    const config = configManager.getConfig();
    
    // Auto-connect to enabled servers
    logger.info('Initializing server connections...');
    const servers = config.servers.filter(s => s.enabled);
    for (const server of servers) {
        // Connect in background to not block startup
        mcpConnectionManager.connect(server).catch(err => {
            logger.error(`Failed to auto-connect to ${server.name}:`, err);
        });
    }

    const host = config.host;
    const port = config.port;

    await app.listen({ port, host });
    logger.info(`MCP Hub Lite Server running at http://${host}:${port}`);
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
