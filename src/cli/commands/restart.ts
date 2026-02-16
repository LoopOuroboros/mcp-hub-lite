import { Command } from 'commander';
import { restartServer } from '@cli/server.js';

/**
 * CLI command for restarting the MCP Hub Lite server.
 *
 * This command provides a convenient way to stop the currently running MCP Hub Lite
 * service and start it again with the same or modified configuration. It handles
 * the graceful shutdown of the existing process and initiates a new server instance.
 *
 * The restart operation follows these steps:
 * 1. Validates the provided command-line options
 * 2. Sends a termination signal to the currently running server process (if any)
 * 3. Waits for the process to gracefully shut down
 * 4. Starts a new server instance with the specified configuration
 * 5. Provides feedback on the restart operation status
 *
 * @remarks
 * - If no server is currently running, the command will simply start a new instance
 * - The command uses the PID file mechanism to identify and manage the server process
 * - All configuration options are passed through to the underlying server restart function
 * - Error handling ensures proper exit codes and user-friendly error messages
 *
 * @example
 * ```bash
 * # Basic restart with default settings
 * mcp-hub-lite restart
 *
 * # Restart with custom port and host
 * mcp-hub-lite restart --port 8080 --host 0.0.0.0
 *
 * # Restart with custom configuration file
 * mcp-hub-lite restart --config ./custom-config.json
 *
 * # Combined options
 * mcp-hub-lite restart --port 9000 --host localhost --config /path/to/config.json
 * ```
 *
 * @see {@link restartServer} - The underlying server restart implementation
 * @see {@link src/config/config-manager.ts} - Configuration management system
 * @see {@link src/pid/manager.ts} - Process ID management utilities
 */
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
