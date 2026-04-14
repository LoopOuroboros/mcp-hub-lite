#!/usr/bin/env node

/**
 * MCP Hub Lite CLI Entry Point
 * Implements 6 core commands: start, stop, status, ui, list, restart
 */

import { Command } from 'commander';
import { argv } from 'node:process';
import { pathToFileURL } from 'node:url';
import { getAppVersion } from '@utils/version.js';
import { startCommand } from '@cli/commands/start.js';
import { stopCommand } from '@cli/commands/stop.js';
import { statusCommand } from '@cli/commands/status.js';
import { uiCommand } from '@cli/commands/ui.js';
import { listCommand } from '@cli/commands/list.js';
import { restartCommand } from '@cli/commands/restart.js';
import { mcpToolUseCommand } from '@cli/commands/tool-use.js';

/**
 * Creates and configures the CLI application using Commander.js
 *
 * This function initializes the main CLI program with its name, description, and version,
 * then registers all available commands to provide a complete command-line interface
 * for managing the MCP Hub Lite service.
 *
 * The CLI provides six core commands:
 * - start: Launches the MCP Hub Lite service in daemon or foreground mode
 * - stop: Gracefully terminates the running service instance
 * - status: Displays current service status including PID, port, host, and server count
 * - ui: Opens the web-based user interface in the default browser
 * - list: Shows all configured MCP servers in a tabular format
 * - restart: Stops and restarts the service with the same configuration
 *
 * Usage examples:
 * ```bash
 * # Start service in daemon mode
 * mcp-hub-lite start
 *
 * # Start service in foreground mode on custom port
 * mcp-hub-lite start --port 8080 --foreground
 *
 * # Stop the running service
 * mcp-hub-lite stop
 *
 * # Check service status
 * mcp-hub-lite status
 *
 * # Open web UI
 * mcp-hub-lite ui
 *
 * # List all configured servers
 * mcp-hub-lite list
 *
 * # Restart the service
 * mcp-hub-lite restart
 * ```
 *
 * @returns {Command} The configured CLI program instance ready for parsing
 *
 * @example
 * ```typescript
 * const cli = createCli();
 * cli.parse(); // Parse command line arguments and execute
 * ```
 *
 * @see {@link startCommand} - Implementation of the start command
 * @see {@link stopCommand} - Implementation of the stop command
 * @see {@link statusCommand} - Implementation of the status command
 * @see {@link uiCommand} - Implementation of the ui command
 * @see {@link listCommand} - Implementation of the list command
 * @see {@link restartCommand} - Implementation of the restart command
 */
export function createCli(): Command {
  const program = new Command();

  program
    .name('mcp-hub-lite')
    .description('Lightweight MCP Gateway for managing MCP servers')
    .version(process.env.npm_package_version ?? getAppVersion(), '-v, --version');

  // Register all core commands
  program.addCommand(startCommand);
  program.addCommand(stopCommand);
  program.addCommand(statusCommand);
  program.addCommand(uiCommand);
  program.addCommand(listCommand);
  program.addCommand(restartCommand);
  program.addCommand(mcpToolUseCommand);

  return program;
}

// Execute the CLI if this file is run directly
if (argv[1] && pathToFileURL(argv[1]).href === import.meta.url) {
  const cli = createCli();
  cli.parse();
}
