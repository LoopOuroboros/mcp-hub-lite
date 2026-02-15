#!/usr/bin/env node

/**
 * MCP Hub Lite CLI Entry Point
 * Implements 6 core commands: start, stop, status, ui, list, restart
 */

import { Command } from 'commander';
import { startCommand } from '@cli/commands/start.js';
import { stopCommand } from '@cli/commands/stop.js';
import { statusCommand } from '@cli/commands/status.js';
import { uiCommand } from '@cli/commands/ui.js';
import { listCommand } from '@cli/commands/list.js';
import { restartCommand } from '@cli/commands/restart.js';

const program = new Command();

program
  .name('mcp-hub-lite')
  .description('Lightweight MCP Gateway for managing MCP servers')
  .version('1.0.0');

// Register all core commands
program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);
program.addCommand(uiCommand);
program.addCommand(listCommand);
program.addCommand(restartCommand);

program.parse();
