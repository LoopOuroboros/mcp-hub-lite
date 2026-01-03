#!/usr/bin/env node

/**
 * MCP Hub Lite CLI Entry Point
 * Implements 6 core commands: start, stop, status, ui, list, restart
 */

import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { uiCommand } from './commands/ui.js';
import { listCommand } from './commands/list.js';
import { restartCommand } from './commands/restart.js';

const program = new Command();

program
  .name('mcp-hub-lite')
  .description('Lightweight MCP Gateway for managing MCP servers')
  .version('1.0.0');

// Register all 6 core commands
program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);
program.addCommand(uiCommand);
program.addCommand(listCommand);
program.addCommand(restartCommand);

program.parse();