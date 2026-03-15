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
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { startServer } from '@cli/server.js';
import { parsePort, parseHost, validateConfigPath } from '@cli/parse-args.js';
import { LogRotator } from '@utils/log-rotator.js';
import { PidManager } from '@pid/manager.js';
import { getConfigManager } from '@config/config-manager.js';

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
 * # Start server with default settings (background mode)
 * mcp-hub-lite start
 *
 * # Start server on custom port and host
 * mcp-hub-lite start --port 8080 --host 0.0.0.0
 *
 * # Start with custom config file
 * mcp-hub-lite start --config ./custom-config.json
 *
 * # Start in foreground mode for debugging
 * mcp-hub-lite start --foreground
 * ```
 */
export const startCommand = new Command('start')
  .description('Start the MCP Hub Lite server')
  .option('-p, --port <port>', 'Port to run on', parsePort)
  .option('-h, --host <host>', 'Host to bind to', parseHost)
  .option('--config <path>', 'Path to config file', validateConfigPath)
  .option('-f, --foreground', 'Run in foreground (blocking)')
  .option('--stdio', 'Run in stdio mode for MCP protocol')
  .action(async (options) => {
    // Get config manager to read actual config values
    const configManager = getConfigManager();
    const config = configManager.getConfig();

    // Priority: command line options > environment variables > config file > defaults
    const actualHost = options.host || process.env.HOST || config.system.host || 'localhost';
    const actualPort =
      options.port ||
      (process.env.PORT ? Number(process.env.PORT) : undefined) ||
      config.system.port ||
      7788;

    // Daemon mode by default unless --foreground or --stdio is specified
    if (!options.foreground && !options.stdio) {
      const args = [process.argv[1], 'start', '--foreground'];
      if (options.port) args.push('--port', String(options.port));
      if (options.host) args.push('--host', options.host);
      if (options.config) args.push('--config', options.config);

      const logDir = path.join(os.homedir(), '.mcp-hub-lite', 'logs');
      const logRotator = new LogRotator(logDir, 'mcp-hub', undefined, () =>
        getConfigManager().getConfig()
      );

      // Rotate old logs before starting
      logRotator.rotateLogs();

      const logFile = logRotator.createNewLogFilePath();
      const logStream = fs.openSync(logFile, 'a');

      console.log(`Starting server in background...`);
      console.log(`Logs: ${logFile}`);

      const subprocess = spawn(process.argv[0], args, {
        detached: true,
        stdio: ['ignore', logStream, logStream],
        env: {
          ...process.env,
          NO_COLOR: '1'
        }
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
            console.log(`\nAccess the web UI at: http://${actualHost}:${actualPort}`);
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
            } catch {
              // Ignore log read errors
            }

            console.error(`\n📄 Check full logs for details: ${logFile}\n`);
            process.exit(1);
          }
        }, checkInterval);
      });

      process.exit(0);
    }

    try {
      await startServer({
        port: actualPort,
        host: actualHost,
        configPath: options.config
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });
