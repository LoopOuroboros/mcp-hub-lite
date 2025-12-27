#!/usr/bin/env node
import { Command } from 'commander';
import { runServer } from './server/runner.js';
import { configManager } from './config/config.manager.js';
import { PidManager } from './server/pid.manager.js';

const program = new Command();

program
  .name('mcp-hub-lite')
  .description('MCP Hub Lite CLI')
  .version('0.0.1');

program
  .command('start')
  .description('Start the MCP Hub Lite server')
  .option('--stdio', 'Run in stdio mode for MCP protocol')
  .option('-p, --port <number>', 'Port to run on')
  .option('-h, --host <string>', 'Host to bind to')
  .action(async (options) => {
    await runServer({
      stdio: options.stdio,
      port: options.port ? parseInt(options.port) : undefined,
      host: options.host
    });
  });

program
  .command('list')
  .description('List all managed MCP servers')
  .action(async () => {
    const config = configManager.getConfig();
    const url = `http://${config.host}:${config.port}/api/servers`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const servers = await response.json();
        console.table(servers);
    } catch (error: any) {
        console.error('Failed to list servers:', error.message);
        console.error('Is the server running?');
    }
  });

program
  .command('status')
  .description('Show system status')
  .action(async () => {
    const config = configManager.getConfig();
    const url = `http://${config.host}:${config.port}/api/connections`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const status = await response.json();
        console.table(status);
    } catch (error: any) {
        console.error('Failed to get status:', error.message);
        console.error('Is the server running?');
    }
  });

program
  .command('stop')
  .description('Stop the running MCP Hub Lite server')
  .action(() => {
    const pid = PidManager.getPid();
    if (!pid) {
      console.error('No running server found (PID file missing).');
      return;
    }
    
    try {
      console.log(`Stopping server (PID: ${pid})...`);
      process.kill(pid, 'SIGTERM');
      console.log('Stop signal sent.');
      // Optionally wait for it to disappear
    } catch (error: any) {
      if (error.code === 'ESRCH') {
        console.error('Server process not found (stale PID file?). Cleaning up...');
        PidManager.removePid();
      } else {
        console.error('Failed to stop server:', error.message);
      }
    }
  });

program
  .command('restart')
  .description('Restart the MCP Hub Lite server')
  .action(async () => {
    // 1. Stop
    const pid = PidManager.getPid();
    if (pid) {
        try {
            console.log(`Stopping server (PID: ${pid})...`);
            process.kill(pid, 'SIGTERM');
            // Simple wait loop
            let tries = 0;
            while (PidManager.isRunning() && tries < 10) {
                await new Promise(r => setTimeout(r, 500));
                tries++;
            }
        } catch (error: any) {
             if (error.code !== 'ESRCH') console.error('Error stopping:', error.message);
        }
    }
    
    // 2. Start
    console.log('Starting server...');
    // We can't easily spawn a new detached process from here without more complex logic (like spawn detached).
    // But usually 'restart' in this context implies 'run start'.
    // However, if we are running in terminal, we might want to just run the server function.
    // If the user expects background restart, that's different.
    // Given 'start' is blocking, 'restart' here will just run it in the current process.
    await runServer();
  });

program
  .command('ui')
  .description('Open the Web UI')
  .action(async () => {
    const config = configManager.getConfig();
    const url = `http://${config.host}:${config.port}`;
    console.log(`Opening Web UI at ${url}...`);
    const { exec } = await import('child_process');
    const start = (process.platform == 'darwin'? 'open': process.platform == 'win32'? 'start': 'xdg-open');
    exec(`${start} ${url}`);
  });


// Handle default execution (if no args provided, maybe just show help or start?)
// For now, if no args, we default to help. 
// But existing behavior was "start server". 
// To keep backward compatibility or easy usage:
if (process.argv.length === 2) {
    // No args provided. We can default to start?
    // Usually CLI tools show help.
    // But since this IS the server binary, maybe defaulting to start is better if it's meant to be run as `npm start`.
    // Let's check package.json scripts. "start": "npm start" -> "node dist/index.js".
    // If I change it to require "start" subcommand, `npm start` will fail unless I update package.json.
    // I should update package.json script to "mcp-hub-lite start" or handle default.
    // I'll update package.json script later. For now, let's make it show help.
}

program.parse();
