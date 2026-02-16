import { Command } from 'commander';
import { getServerStatus } from '@cli/server.js';

/**
 * CLI command for retrieving the current status of the MCP Hub Lite server.
 *
 * This command provides comprehensive information about the running MCP Hub Lite instance,
 * including process details, configuration status, and managed MCP servers. It is designed
 * to help users monitor their MCP gateway service and troubleshoot any operational issues.
 *
 * The status command performs the following functions:
 * - Checks if the MCP Hub Lite process is currently running
 * - Retrieves the process ID (PID) from the PID file
 * - Displays the configured host and port settings
 * - Shows the current MCP integration endpoint configuration
 * - Lists all managed MCP servers and their connection status
 * - Provides detailed operational status information
 *
 * Usage scenarios:
 * - Verifying that the MCP Hub Lite service is running correctly
 * - Debugging connection issues with managed MCP servers
 * - Monitoring system health and resource usage
 * - Validating configuration after changes or updates
 * - Checking the status before performing maintenance operations
 *
 * The command supports an optional --pid parameter to check a specific process ID,
 * which is useful when multiple instances might be running or when the PID file
 * is unavailable or corrupted.
 *
 * @example
 * // Basic usage - check default instance
 * mcp-hub-lite status
 *
 * @example
 * // Check specific process ID
 * mcp-hub-lite status --pid 12345
 *
 * @example
 * // Expected output format:
 * // MCP Hub Lite - System Status
 * // ============================
 * // Process ID: 12345
 * // Port: 7788
 * // Host: localhost
 * // Status: Running
 * //
 * // MCP Integration:
 * // ================
 * // Endpoint: http://localhost:7788/mcp
 * // Transport: StreamableHttp
 * //
 * // {
 * //   "mcpServers": {
 * //     "mcp-hub-lite": {
 * //       "type": "http",
 * //       "url": "http://localhost:7788/mcp"
 * //     }
 * //   }
 * // }
 *
 * @returns {Command} The configured status command instance for registration with Commander.js
 */
export const statusCommand = new Command('status')
  .description('Get the status of MCP Hub Lite server')
  .option('--pid <pid>', 'PID of the server to check')
  .action(async (options) => {
    try {
      const status = await getServerStatus(options.pid);
      console.log('Server Status:', status);
    } catch (error) {
      console.error('Failed to get server status:', error);
      process.exit(1);
    }
  });
