import { Command } from 'commander';
import open from 'open';

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
 * @example
 * ```bash
 * # Open UI with default settings (localhost:3000)
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
 * ```
 *
 * @command ui
 * @description Opens the MCP Hub Lite web UI in the default system browser
 * @option {string} -p, --port <port> - Port where the MCP Hub Lite server is running (default: "3000")
 * @option {string} -h, --host <host> - Host where the MCP Hub Lite server is running (default: "localhost")
 * @throws {Error} If the browser fails to open or the system encounters an error during execution
 * @returns {Promise<void>} Resolves when the browser has been successfully opened
 * @see {@link https://github.com/sindresorhus/open} - Underlying open library documentation
 */
export const uiCommand = new Command('ui')
  .description('Open the MCP Hub Lite web UI in browser')
  .option('-p, --port <port>', 'Port where server is running', '3000')
  .option('-h, --host <host>', 'Host where server is running', 'localhost')
  .action(async (options) => {
    try {
      const url = `http://${options.host}:${options.port}`;
      await open(url);
      console.log(`Opened MCP Hub Lite UI at ${url}`);
    } catch (error) {
      console.error('Failed to open UI:', error);
      process.exit(1);
    }
  });
