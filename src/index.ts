#!/usr/bin/env node
import { Command } from 'commander';
import { runServer } from './server/runner.js';
import { configManager } from './config/config.manager.js';
import { PidManager } from './server/pid.manager.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

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
  .option('-f, --foreground', 'Run in foreground (blocking)')
  .action(async (options) => {
    // Daemon mode by default unless --foreground or --stdio is specified
    if (!options.foreground && !options.stdio) {
      const args = [process.argv[1], 'start', '--foreground'];
      if (options.port) args.push('--port', options.port);
      if (options.host) args.push('--host', options.host);

      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFile = path.join(logDir, 'mcp-hub.log');
      const errFile = path.join(logDir, 'mcp-hub.error.log');
      const out = fs.openSync(logFile, 'a');
      const err = fs.openSync(errFile, 'a');

      console.log(`Starting server in background...`);
      console.log(`Logs: ${logFile}`);

      const subprocess = spawn(process.argv[0], args, {
        detached: true,
        stdio: ['ignore', out, err]
      });
      
      subprocess.unref();
      console.log(`Server started (PID: ${subprocess.pid})`);
      process.exit(0);
    }

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const servers = await response.json();
        console.table(servers);
        process.exit(0);
    } catch (error: any) {
        console.error('Failed to list servers:', error.message);
        console.error('Is the server running?');
        process.exit(1);
    }
  });

program
  .command('status')
  .description('Show system status')
  .action(async () => {
    const config = configManager.getConfig();
    const url = `http://${config.host}:${config.port}/api/mcp/status`;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const status = await response.json();
        console.table(status);
        process.exit(0);
    } catch (error: any) {
        console.error('Failed to get status:', error.message);
        console.error('Is the server running?');
        process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop the running MCP Hub Lite server')
  .action(() => {
    const pid = PidManager.getPid();
    if (!pid) {
      console.error('No running server found (PID file missing).');
      process.exit(1);
    }

    try {
      console.log(`Stopping server (PID: ${pid})...`);
      process.kill(pid, 'SIGTERM');
      console.log('Stop signal sent.');
      // Wait a bit for signal to process
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error: any) {
      if (error.code === 'ESRCH') {
        console.error('Server process not found (stale PID file?). Cleaning up...');
        PidManager.removePid();
        process.exit(0);
      } else {
        console.error('Failed to stop server:', error.message);
        process.exit(1);
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

    // Get the path to the executable (node) and the script (dist/index.js)
    const args = ['start'];

    // Check if we are running from node or binary
    const isNode = process.argv[0].endsWith('node') || process.argv[0].endsWith('node.exe');

    const childArgs = isNode ? [process.argv[1], ...args] : [...args];

    try {
        const child = spawn(process.argv[0], childArgs, {
            detached: false,
            stdio: 'inherit',
            cwd: process.cwd() // Ensure we run in same directory
        });

        child.on('close', (code) => {
           process.exit(code || 0);
        });
    } catch (e: any) {
        console.error('Failed to restart server:', e.message);
        process.exit(1);
    }
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
    exec(`${start} ${url}`, (error) => {
      if (error) {
        console.error('Failed to open browser:', error.message);
        process.exit(1);
      } else {
        console.log('Browser opened successfully');
        process.exit(0);
      }
    });
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
