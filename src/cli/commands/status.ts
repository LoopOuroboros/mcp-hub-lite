import { Command } from 'commander';
import { getServerStatus } from '@cli/server.js';
import type { EnhancedServerStatus } from '@cli/server.js';
import os from 'os';

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
 * @returns {Command} The configured status command instance for registration with Commander.js
 */
export const statusCommand = new Command('status')
  .description('Get the status of MCP Hub Lite server')
  .option('--pid <pid>', 'PID of the server to check')
  .action(async (options) => {
    try {
      const status = await getServerStatus(options.pid);
      printFormattedStatus(status);
      process.exit(0);
    } catch (error) {
      console.error('Failed to get server status:', error);
      process.exit(1);
    }
  });

/**
 * Prints formatted status output with emojis and sections.
 *
 * @param status - The enhanced server status object to display
 */
function printFormattedStatus(status: EnhancedServerStatus): void {
  // ANSI color codes
  const reset = '\x1b[0m';
  const green = '\x1b[32m';
  const red = '\x1b[31m';
  const yellow = '\x1b[33m';
  const cyan = '\x1b[36m';
  const dim = '\x1b[2m';

  const webUiUrl = `http://${status.host}:${status.port}`;
  const mcpEndpoint = `${webUiUrl}/mcp`;

  // Main header
  console.log('');
  console.log(`${cyan}📊 MCP Hub Lite - System Status${reset}`);
  console.log(`${dim}════════════════════════════════════${reset}`);

  // Status section
  const statusIcon = status.running ? `${green}✅${reset}` : `${red}❌${reset}`;
  const statusText = status.running ? 'Running' : 'Stopped';
  console.log(`${statusIcon} Status: ${status.running ? green : red}${statusText}${reset}`);

  if (status.pid) {
    console.log(`🆔 Process ID: ${cyan}${status.pid}${reset}`);
  }
  console.log(`🌐 Host: ${cyan}${status.host}${reset}`);
  console.log(`🔌 Port: ${cyan}${status.port}${reset}`);
  console.log(`📡 Web UI: ${cyan}${webUiUrl}${reset}`);
  console.log(`🔗 MCP Endpoint: ${cyan}${mcpEndpoint}${reset}`);
  console.log(`📄 PID File: ${dim}${formatPath(status.pidFilePath)}${reset}`);

  // MCP Servers section - split into connected and disconnected
  if (status.mcpServers && status.mcpServers.length > 0) {
    const connectedServers = status.mcpServers.filter((s) => s.connected);
    const disconnectedServers = status.mcpServers.filter((s) => !s.connected);

    // Function to display a server list
    const displayServerList = (
      servers: typeof status.mcpServers,
      title: string,
      titleColor: string
    ) => {
      if (servers.length === 0) return;

      console.log('');
      console.log(`${titleColor}${title}${reset}`);
      console.log(`${dim}${'═'.repeat(title.length)}${reset}`);

      // Calculate column widths
      let maxNameLen = 'Server Name'.length;
      let maxTypeLen = 'Type'.length;
      const maxStatusLen = 'Disconnected'.length;
      let maxDisplayNameLen = 'DisplayName'.length;
      let maxTagsLen = 'Tags'.length;

      for (const server of servers) {
        maxNameLen = Math.max(maxNameLen, (server.name || '').length);
        maxTypeLen = Math.max(maxTypeLen, (server.type || '').length);
        const displayName = server.displayName || '';
        const tags = JSON.stringify(server.tags || {});
        maxDisplayNameLen = Math.max(maxDisplayNameLen, displayName.length);
        maxTagsLen = Math.max(maxTagsLen, tags.length);
      }

      // Simple table without complex borders
      const headerName = 'Server Name'.padEnd(maxNameLen);
      const headerType = 'Type'.padEnd(maxTypeLen);
      const headerStatus = 'Status'.padEnd(maxStatusLen);
      const headerDisplayName = 'DisplayName'.padEnd(maxDisplayNameLen);
      const headerTags = 'Tags'.padEnd(maxTagsLen);

      console.log(
        `${cyan}${headerName}  ${headerType}  ${headerStatus}  Tools  Resources  ${headerDisplayName}  ${headerTags}${reset}`
      );
      console.log(
        `${dim}${'─'.repeat(maxNameLen + maxTypeLen + maxStatusLen + 26 + maxDisplayNameLen + maxTagsLen)}${reset}`
      );

      for (const server of servers) {
        const name = (server.name || '').padEnd(maxNameLen);
        const type = (server.type || '').padEnd(maxTypeLen);
        const statusText = server.connected
          ? `${green}Connected${reset}`.padEnd(maxStatusLen + 9)
          : `${red}Disconnected${reset}`.padEnd(maxStatusLen + 9);
        const tools = server.toolsCount.toString().padStart(5);
        const resources = server.resourcesCount.toString().padStart(9);
        const displayName = (server.displayName || '').padEnd(maxDisplayNameLen);
        const tags = JSON.stringify(server.tags || {}).padEnd(maxTagsLen);

        console.log(
          `${name}  ${type}  ${statusText}  ${tools}  ${resources}  ${displayName}  ${tags}`
        );

        if (server.error) {
          console.log(`  ${red}Error: ${server.error}${reset}`);
        }
      }
    };

    // Display connected servers first
    displayServerList(connectedServers, 'MCP Servers (Connected):', green);

    // Then display disconnected servers
    displayServerList(disconnectedServers, 'MCP Servers (Disconnected):', red);
  }

  // MCP Client Configuration
  console.log('');
  console.log(`${yellow}🔌 MCP Client Configuration:${reset}`);
  console.log(`${dim}═══════════════════════════════${reset}`);
  console.log('Add this to your MCP client config:');
  console.log('');
  console.log(`${dim}{${reset}`);
  console.log(`${dim}  "mcpServers": {${reset}`);
  console.log(`${dim}    "mcp-hub-lite": {${reset}`);
  console.log(`${dim}      "url": "${cyan}${mcpEndpoint}${dim}"${reset}`);
  console.log(`${dim}    }${reset}`);
  console.log(`${dim}  }${reset}`);
  console.log(`${dim}}${reset}`);

  // Quick Commands
  console.log('');
  console.log(`${yellow}💡 Quick Commands:${reset}`);
  console.log(`   ${cyan}mcp-hub-lite ui${reset}     ${dim}# Open web interface${reset}`);
  console.log(`   ${cyan}mcp-hub-lite list${reset}   ${dim}# List all MCP servers${reset}`);
  if (status.running) {
    console.log(`   ${cyan}mcp-hub-lite stop${reset}   ${dim}# Stop the server${reset}`);
  } else {
    console.log(`   ${cyan}mcp-hub-lite start${reset}  ${dim}# Start the server${reset}`);
  }
  console.log('');

  // Final message
  if (status.running) {
    console.log(`${green}🚀 Ready to use!${reset}`);
  } else {
    console.log(`${yellow}⏸️ Server not running. Use "mcp-hub-lite start" to start it.${reset}`);
  }
  console.log('');
}

/**
 * Formats a file path for display, replacing home directory with ~.
 *
 * @param filePath - The full file path to format
 * @returns Formatted path with ~ for home directory
 */
function formatPath(filePath: string): string {
  const homeDir = os.homedir();
  if (filePath.startsWith(homeDir)) {
    return '~' + filePath.slice(homeDir.length);
  }
  return filePath;
}
