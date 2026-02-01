import { Command } from 'commander';
import { stopServer } from '@cli/server.js';

export const stopCommand = new Command('stop')
  .description('Stop the MCP Hub Lite server')
  .option('--pid <pid>', 'PID of the server to stop')
  .action(async (options) => {
    try {
      await stopServer(options.pid);
      console.log('MCP Hub Lite server stopped successfully');
    } catch (error) {
      console.error('Failed to stop server:', error);
      process.exit(1);
    }
  });