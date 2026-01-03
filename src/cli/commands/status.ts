import { Command } from 'commander';
import { getServerStatus } from '../server.js';

export const statusCommand = new Command('status')
  .description('Get the status of MCP Hub Lite server')
  .option('--pid <pid>', 'PID of the server to check')
  .action(async (options) => {
    try {
      const status = await getServerStatus(options.pid);
      console.log('Server Status:', status);
    } catch (error) {
      console.error('Failed to get server status:', error);
      process.exit(1);
    }
  });