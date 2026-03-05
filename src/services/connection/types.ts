/**
 * Represents the connection status and metadata of an MCP server instance.
 *
 * This interface tracks the operational state of connected MCP servers,
 * including connection status, error information, resource counts, and
 * process-level details for stdio-based servers.
 *
 * @interface ServerStatus
 * @property {boolean} connected - Whether the server is currently connected
 * @property {string} [error] - Error message if connection failed or was lost
 * @property {number} lastCheck - Timestamp (milliseconds) of last status check
 * @property {number} toolsCount - Number of tools available from this server
 * @property {number} resourcesCount - Number of resources available from this server
 * @property {number} [pid] - Process ID for stdio-based servers
 * @property {number} [startTime] - Server startup timestamp (milliseconds)
 * @property {string} [version] - Server version string from MCP protocol
 * @property {string} [hash] - Unique identifier hash for the server instance
 */
export interface ServerStatus {
  connected: boolean;
  error?: string;
  lastCheck: number;
  toolsCount: number;
  resourcesCount: number;
  pid?: number;
  startTime?: number;
  version?: string;
  hash?: string;
}
