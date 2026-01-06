#!/usr/bin/env node
import { Command } from 'commander';
import { runServer } from './server/runner.js';
import { configManager } from './config/config-manager.js';
import { PidManager } from './pid/manager.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { LogRotator } from './utils/log-rotator.js';

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
      const logRotator = new LogRotator(logDir, 'mcp-hub');

      // Rotate old logs before starting
      logRotator.rotateLogs();

      const logFile = logRotator.getCurrentLogFilePath();
      const logStream = fs.openSync(logFile, 'a');

      console.log(`Starting server in background...`);
      console.log(`Logs: ${logFile}`);

      const subprocess = spawn(process.argv[0], args, {
        detached: true,
        stdio: ['ignore', logStream, logStream]
      });

      subprocess.unref();

      // Wait for server to initialize and write PID file
      const startTime = Date.now();
      const maxWaitTime = 5000; // 5 seconds max wait
      const checkInterval = 200; // Check every 200ms

      await new Promise<void>((resolve) => {
        const checkPid = setInterval(() => {
          const elapsed = Date.now() - startTime;

          // Check if PID file exists
          if (PidManager.pidFileExists()) {
            clearInterval(checkPid);
            const pid = PidManager.getPid();
            console.log(`✓ Server started successfully (PID: ${pid})`);
            console.log(`\nAccess the web UI at: http://${options.host || 'localhost'}:${options.port || 7788}`);
            resolve();
            return;
          }

          // Timeout - check if subprocess is still running
          if (elapsed > maxWaitTime) {
            clearInterval(checkPid);
            console.error(`\n✗ Server failed to start within ${maxWaitTime}ms`);

            // Try to read the last few lines of log to provide helpful error message
            try {
              const logContent = fs.readFileSync(logFile, 'utf-8');
              const logLines = logContent.trim().split('\n');
              const recentLines = logLines.slice(-10); // Last 10 lines

              // Check for common error patterns
              const portInUsePattern = /EADDRINUSE.*:(\d+)/;
              const alreadyRunningPattern = /MCP Hub Lite is already running/;

              for (const line of recentLines) {
                if (alreadyRunningPattern.test(line)) {
                  console.error(`\n⚠️  MCP Hub Lite is already running!`);
                  console.error(`   Use 'npm run stop' to stop the existing instance.`);
                  break;
                } else if (portInUsePattern.test(line)) {
                  const match = line.match(portInUsePattern);
                  const port = match ? match[1] : 'unknown';
                  console.error(`\n⚠️  Port ${port} is already in use by another application.`);
                  console.error(`   Solutions:`);
                  console.error(`   1. Stop the application using port ${port}`);
                  console.error(`   2. Use a different port: npm run start -- --port <PORT>`);
                  break;
                }
              }
            } catch (err) {
              // Ignore log read errors
            }

            console.error(`\n📄 Check full logs for details: ${logFile}\n`);
            process.exit(1);
          }
        }, checkInterval);
      });

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
    const url = `http://${config.host}:${config.port}/web/servers`;
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
    const pid = PidManager.getPid();
    const isRunning = PidManager.isRunning();

    // ANSI color codes
    const colors = {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m'
    };

    // Display basic system info
    console.log(`${colors.bold}MCP Hub Lite - System Status${colors.reset}`);
    console.log('============================');
    console.log(`${colors.cyan}Process ID:${colors.reset} ${isRunning ? pid : 'Not running'}`);
    console.log(`${colors.cyan}Port:${colors.reset} ${config.port}`);
    console.log(`${colors.cyan}Host:${colors.reset} ${config.host}`);
    console.log(`${colors.cyan}Status:${colors.reset} ${isRunning ? `${colors.green}Running${colors.reset}` : `${colors.red}Stopped${colors.reset}`}`);
    console.log('');

    // Display MCP connection example
    console.log(`${colors.bold}MCP Integration:${colors.reset}`);
    console.log('================');
    console.log(`${colors.yellow}Endpoint:${colors.reset} http://${config.host}:${config.port}/mcp`);
    console.log(`${colors.yellow}Transport:${colors.reset} HTTP-Stream`);
    console.log('');
    const mcpClientConfig = {
      "mcpServers": {
        "mcp-hub-lite": {
          "type": "http-stream",
          "url": `http://${config.host}:${config.port}/mcp`
        }
      }
    };
    console.log(JSON.stringify(mcpClientConfig, null, 2));
    console.log('');

    // Try to fetch server list if running
    if (isRunning) {
      try {
        const url = `http://${config.host}:${config.port}/web/servers`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const servers = await response.json() as any[];

        if (servers.length > 0) {
          console.log(`${colors.bold}Managed MCP Servers:${colors.reset}`);
          console.log('===================');
          console.table(servers);
        } else {
          console.log('No managed MCP servers configured.');
        }
      } catch (error: any) {
        console.error('Warning: Failed to fetch server list:', error.message);
      }
    } else {
      console.log('Server is not running. Start it with: npm run start');
    }

    process.exit(0);
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
