import { Command } from 'commander';
import open from 'open';

export const uiCommand = new Command('ui')
  .description('Open the MCP Hub Lite web UI in browser')
  .option('-p, --port <port>', 'Port where server is running', '3000')
  .option('-h, --host <host>', 'Host where server is running', 'localhost')
  .action(async (options) => {
    try {
      const url = `http://${options.host}:${options.port}`;
      await open(url);
      console.log(`Opened MCP Hub Lite UI at ${url}`);
    } catch (error) {
      console.error('Failed to open UI:', error);
      process.exit(1);
    }
  });
