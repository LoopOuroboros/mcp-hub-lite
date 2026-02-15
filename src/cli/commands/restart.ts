import { Command } from 'commander';
import { restartServer } from '@cli/server.js';

export const restartCommand = new Command('restart')
  .description('Restart the MCP Hub Lite server')
  .option('-p, --port <port>', 'Port to run on', '3000')
  .option('-h, --host <host>', 'Host to bind to', 'localhost')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      await restartServer({
        port: parseInt(options.port),
        host: options.host,
        configPath: options.config
      });
      console.log('MCP Hub Lite server restarted successfully');
    } catch (error) {
      console.error('Failed to restart server:', error);
      process.exit(1);
    }
  });
