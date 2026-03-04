import { Command } from 'commander';
import { exec } from 'child_process';
import { getConfigManager } from '@config/config-manager.js';

/**
 * CLI command to open the MCP Hub Lite web user interface in the default system browser.
 *
 * This command provides a convenient way for users to access the web-based management
 * interface without manually typing the URL. It automatically constructs the URL using
 * the specified host and port options, then opens it in the user's default browser.
 *
 * The command is designed to work with both local development instances and production
 * deployments, allowing users to easily access the UI regardless of the server configuration.
 *
 * Priority order for host and port resolution:
 * 1. Command line options (--host, --port)
 * 2. Environment variables (HOST, PORT)
 * 3. Configuration file settings
 * 4. Default values (localhost:7788)
 *
 * @example
 * ```bash
 * # Open UI with configured settings from .mcp-hub.json
 * mcp-hub-lite ui
 *
 * # Open UI on a specific port
 * mcp-hub-lite ui --port 7788
 *
 * # Open UI on a specific host and port
 * mcp-hub-lite ui --host 192.168.1.100 --port 8080
 *
 * # Using short option flags
 * mcp-hub-lite ui -p 7788 -h my-server.local
 *
 * # Using environment variables
 * PORT=9999 mcp-hub-lite ui
 * ```
 *
 * @command ui
 * @description Opens the MCP Hub Lite web UI in the default system browser
 * @option {string} -p, --port <port> - Port where the MCP Hub Lite server is running
 * @option {string} -h, --host <host> - Host where the MCP Hub Lite server is running
 * @throws {Error} If the browser fails to open or the system encounters an error during execution
 * @returns {Promise<void>} Resolves when the browser has been successfully opened
 */
export const uiCommand = new Command('ui')
  .description('Open the MCP Hub Lite web UI in browser')
  .option('-p, --port <port>', 'Port where server is running')
  .option('-h, --host <host>', 'Host where server is running')
  .action(async (options) => {
    try {
      const configManager = getConfigManager();
      const config = configManager.getConfig();

      // Priority: command line options > environment variables > config file > defaults
      const host = options.host || process.env.HOST || config.system.host || 'localhost';
      const port = options.port || process.env.PORT || String(config.system.port) || '7788';

      const url = `http://${host}:${port}`;
      console.log(`Opening MCP Hub Lite UI at ${url}`);

      // Open URL in browser based on platform
      const platform = process.platform;
      let openCommand = '';

      if (platform === 'win32') {
        // Windows
        openCommand = `start ${url}`;
      } else if (platform === 'darwin') {
        // macOS
        openCommand = `open ${url}`;
      } else if (platform === 'linux') {
        // Linux
        openCommand = `xdg-open ${url}`;
      } else {
        console.error('Unsupported platform for opening browser');
        process.exit(1);
      }

      exec(openCommand, (error) => {
        if (error) {
          console.error('Failed to open browser:', error.message);
          process.exit(1);
        } else {
          process.exit(0);
        }
      });

      // Set a timeout to exit in case exec callback doesn't fire
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    } catch (error) {
      console.error('Failed to open UI:', error);
      process.exit(1);
    }
  });
