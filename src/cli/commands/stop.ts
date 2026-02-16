/**
 * Stop command implementation for MCP Hub Lite CLI.
 *
 * This command handles the graceful shutdown of the MCP Hub Lite server.
 * It can stop either the currently running server instance or a specific
 * server process identified by PID.
 *
 * @module cli/commands/stop
 */

import { Command } from 'commander';
import { stopServer } from '@cli/server.js';

/**
 * Creates and configures the stop command for the CLI.
 *
 * The stop command gracefully terminates the MCP Hub Lite server process,
 * ensuring proper cleanup of resources, active connections, and persistent
 * session data. It reads the PID from the PID file or accepts a specific
 * PID as an option.
 *
 * Available options:
 * - `--pid`: Specify a specific PID to stop (optional)
 *
 * @returns {Command} Configured Commander.js command instance
 *
 * @example
 * ```bash
 * # Stop the currently running server
 * mcp-hub-lite stop
 *
 * # Stop a specific server process by PID
 * mcp-hub-lite stop --pid 12345
 * ```
 */
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
