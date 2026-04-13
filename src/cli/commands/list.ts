import { Command } from 'commander';
import { listServers } from '@cli/server.js';

/**
 * CLI command to list all configured MCP (Model Context Protocol) servers.
 *
 * This command provides a comprehensive overview of all MCP servers that have been
 * configured in the MCP Hub Lite system. It displays essential information about
 * each server including its name, type, enabled status, and the number of active
 * instances.
 *
 * The command supports two output formats:
 * - **Table format** (default): Human-readable tabular display showing key server information
 * - **JSON format**: Machine-readable JSON output containing complete server details
 *
 * ## Usage Examples
 *
 * ```bash
 * # List servers in default table format
 * mcp-hub-lite list
 *
 * # List servers in JSON format for programmatic processing
 * mcp-hub-lite list --format json
 *
 * # List servers in table format (explicit)
 * mcp-hub-lite list --format table
 * ```
 *
 * ## Output Fields (Table Format)
 *
 * - **Name**: The unique identifier/name of the MCP server
 * - **Instances**: Number of active instances running for this server
 * - **Type**: The transport type of the server (e.g., 'http', 'stdio', 'sse')
 * - **Enabled**: Boolean indicating whether the server is currently enabled
 *
 * ## Error Handling
 *
 * If the command fails to retrieve server information (e.g., due to configuration
 * issues or file system errors), it will display an error message and exit with
 * status code 1.
 *
 * ## Use Cases
 *
 * - **System Administration**: Quickly verify which MCP servers are configured
 * - **Debugging**: Check server status and configuration during development
 * - **Automation**: Use JSON output format for integration with other tools
 * - **Monitoring**: Verify that expected servers are properly registered
 *
 * @example
 * // Default table output
 * MCP Servers:
 * ┌─────────┬────────────┬────────┬─────────┐
 * │ (index) │    Name    │Instances│  Type   │ Enabled │
 * ├─────────┼────────────┼────────┼─────────┤
 * │    0    │ 'my-server'│    1   │ 'http'  │  true   │
 * └─────────┴────────────┴────────┴─────────┘
 *
 * @example
 * // JSON output format
 * [
 *   {
 *     "name": "my-server",
 *     "config": {
 *       "type": "http",
 *       "enabled": true,
 *       // ... other config properties
 *     },
 *     "instances": [...]
 *   }
 * ]
 */
export const listCommand = new Command('list')
  .description('List all configured MCP servers')
  .option('--format <format>', 'Output format (json, table)', 'table')
  .action(async (options) => {
    try {
      const servers = await listServers();

      if (options.format === 'json') {
        console.log(JSON.stringify(servers, null, 2));
      } else {
        // Table format
        console.log('MCP Servers:');
        console.table(
          servers.map((server) => ({
            Name: server.name,
            // Now need to display server instance information
            Instances: server.instances?.length || 0,
            Type: server.config.template.type,
            Enabled: server.config.instances.some((i) => i.enabled !== false)
          }))
        );
      }
      process.exit(0);
    } catch (error) {
      console.error('Failed to list servers:', error);
      process.exit(1);
    }
  });
