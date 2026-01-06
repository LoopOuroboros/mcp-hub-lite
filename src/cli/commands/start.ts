import { Command } from 'commander';
import { startServer } from '../server.js';
import { parsePort, parseHost, validateConfigPath } from '../parse-args.js';

export const startCommand = new Command('start')
  .description('Start the MCP Hub Lite server')
  .option('-p, --port <port>', 'Port to run on', parsePort, 3000)
  .option('-h, --host <host>', 'Host to bind to', parseHost, 'localhost')
  .option('--config <path>', 'Path to config file', validateConfigPath)
  .action(async (options) => {
    try {
      await startServer({
        port: options.port,
        host: options.host,
        configPath: options.config
      });
      console.log('MCP Hub Lite server started successfully');
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });