import { buildApp } from './app.js';
import { configManager } from './config/config.manager.js';
import { logger } from './utils/logger.js';

async function start() {
  try {
    const app = await buildApp();
    const config = configManager.getConfig();
    
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
