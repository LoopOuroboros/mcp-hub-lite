/**
 * Start command implementation for MCP Hub Lite CLI.
 *
 * This command handles the startup of the MCP Hub Lite server with various
 * configuration options including port, host, and config file path.
 * It supports both foreground and background execution modes.
 *
 * @module cli/commands/start
 */

import { Command } from 'commander';
import { startServer } from '@cli/server.js';
import { parsePort, parseHost, validateConfigPath } from '@cli/parse-args.js';

/**
 * Creates and configures the start command for the CLI.
 *
 * The start command initializes and runs the MCP Hub Lite server with the specified
 * configuration options. It handles error cases gracefully and provides appropriate
 * exit codes for automation scripts.
 *
 * Available options:
 * - `--port, -p`: Specify the port to bind to (default: 3000)
 * - `--host, -h`: Specify the host to bind to (default: localhost)
 * - `--config`: Path to custom configuration file
 * - `--foreground, -f`: Run in foreground mode (no daemon)
 * - `--stdio`: Run in stdio mode for MCP protocol integration
 *
 * @returns {Command} Configured Commander.js command instance
 *
 * @example
 * ```bash
 * # Start server with default settings
 * mcp-hub-lite start
 *
 * # Start server on custom port and host
 * mcp-hub-lite start --port 8080 --host 0.0.0.0
 *
 * # Start with custom config file
 * mcp-hub-lite start --config ./custom-config.json
 * ```
 */
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
