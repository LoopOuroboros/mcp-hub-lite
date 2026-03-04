/**
 * CLI Server Management Functions
 * Handles start, stop, status, restart operations
 */

import { PidManager } from '@pid/manager.js';
import { getConfigManager } from '@config/config-manager.js';
import { getPidFilePath } from '@pid/file.js';
import { runServer } from '@server/runner.js';

interface ServerOptions {
  port: number;
  host: string;
  configPath?: string;
}

interface McpServerStatus {
  name: string;
  type: string;
  connected: boolean;
  toolsCount: number;
  resourcesCount: number;
  error?: string;
}

export interface EnhancedServerStatus {
  running: boolean;
  pid?: string;
  host: string;
  port: number;
  message?: string;
  pidFilePath: string;
  mcpServers?: McpServerStatus[];
}

/**
 * Starts the MCP Hub Lite server with the specified configuration options.
 *
 * This function initializes and starts the full MCP Hub Lite server, including:
 * - Fastify HTTP server with web interface and API
 * - Automatic connection to enabled MCP servers
 * - Port conflict detection
 * - Graceful shutdown handlers
 * - PID file management
 *
 * After successful startup, the process ID is written to a PID file for
 * process management and monitoring purposes.
 *
 * Note: The `configPath` option is accepted for API consistency but is not
 * currently used by this function. Configuration loading is handled by the
 * ConfigManager singleton during module initialization.
 *
 * @param {ServerOptions} options - Configuration options for server startup
 * @param {number} options.port - The port number to listen on (e.g., 7788)
 * @param {string} options.host - The host address to bind to (e.g., 'localhost', '0.0.0.0')
 * @param {string} [options.configPath] - Optional path to custom configuration file (currently unused)
 * @returns {Promise<void>} A promise that resolves when the server is successfully started
 * @throws {Error} If the server fails to start due to port conflicts, permission issues, or configuration errors
 *
 * @example
 * ```typescript
 * await startServer({
 *   port: 7788,
 *   host: 'localhost'
 * });
 * console.log(`Server running on http://localhost:7788`);
 * ```
 *
 * @see {@link runServer} for the full server startup implementation
 * @see {@link PidManager} for process ID management
 */
export async function startServer(options: ServerOptions): Promise<void> {
  // Use the full runServer implementation which includes auto-connection of MCP servers
  await runServer({
    port: options.port,
    host: options.host
  });
}

/**
 * Stops the MCP Hub Lite server gracefully by sending a termination signal.
 *
 * This function terminates the running server process by:
 * - Reading the PID from the PID file (or using provided PID)
 * - Sending SIGTERM signal to gracefully terminate the process
 * - Cleaning up the PID file to prevent stale process detection
 *
 * If no PID is provided, it reads from the PID file managed by PidManager.
 * If the PID file doesn't exist or the process is already terminated,
 * the function handles this gracefully without throwing errors.
 *
 * @param pid - Optional specific process ID to stop. If not provided, uses PID from PID file.
 * @returns {Promise<void>} Resolves when the stop operation completes (regardless of success/failure)
 *
 * @example
 * ```typescript
 * // Stop the currently running server
 * await stopServer();
 *
 * // Stop a specific process ID
 * await stopServer('12345');
 * ```
 */
export async function stopServer(pid?: string) {
  const actualPid = pid || PidManager.getPid()?.toString();

  if (actualPid) {
    process.kill(parseInt(actualPid), 'SIGTERM');
    PidManager.removePid();
  }
}

/**
 * Retrieves the current status of the MCP Hub Lite server.
 *
 * This function checks if the server is running by:
 * - Reading the PID from the PID file (or using provided PID)
 * - Verifying if the process with that PID is still active
 * - If running, attempts to fetch additional runtime status via HTTP API
 * - Returns enhanced status with configuration and runtime information
 *
 * The function uses `process.kill(pid, 0)` which doesn't actually kill the process
 * but checks if a process with the given PID exists and is accessible.
 *
 * @param pid - Optional specific process ID to check. If not provided, uses PID from PID file.
 * @returns {Promise<EnhancedServerStatus>} Enhanced status object with full details
 *
 * @example
 * ```typescript
 * const status = await getServerStatus();
 * if (status.running) {
 *   console.log(`Server running on ${status.host}:${status.port} with PID ${status.pid}`);
 * }
 * ```
 */
export async function getServerStatus(pid?: string): Promise<EnhancedServerStatus> {
  const configManager = getConfigManager();
  const config = configManager.getConfig();
  const host = process.env.HOST || config.system.host;
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : config.system.port;
  const pidFilePath = getPidFilePath();

  const actualPid = pid || PidManager.getPid()?.toString();

  if (!actualPid) {
    return {
      running: false,
      host,
      port,
      pidFilePath,
      message: 'Server not running'
    };
  }

  try {
    process.kill(parseInt(actualPid), 0); // Signal 0 just checks if process exists

    // Try to fetch runtime status via HTTP API
    const mcpServers = await fetchRuntimeStatus(host, port);

    return {
      running: true,
      pid: actualPid,
      host,
      port,
      pidFilePath,
      mcpServers
    };
  } catch {
    return {
      running: false,
      host,
      port,
      pidFilePath,
      message: 'Server process not found'
    };
  }
}

/**
 * Fetches runtime status from the running server via HTTP API.
 *
 * This function attempts to connect to the local server API to retrieve
 * real-time status information about connected MCP servers. It uses a
 * short timeout to ensure the status command remains responsive even
 * if the server is unresponsive.
 *
 * @param host - The host address to connect to
 * @param port - The port number to connect to
 * @returns Promise with array of MCP server status, or undefined if API call fails
 */
async function fetchRuntimeStatus(
  host: string,
  port: number
): Promise<McpServerStatus[] | undefined> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);

    const response = await fetch(`http://${host}:${port}/web/mcp/status`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return undefined;
    }

    const statusData = (await response.json()) as Array<{
      id: string;
      name: string;
      type: string;
      status: {
        connected: boolean;
        error?: string;
        toolsCount: number;
        resourcesCount: number;
      };
    }>;

    // Map status data directly (API now includes name and type)
    const result: McpServerStatus[] = statusData.map((item) => ({
      name: item.name,
      type: item.type,
      connected: item.status.connected,
      toolsCount: item.status.toolsCount,
      resourcesCount: item.status.resourcesCount,
      error: item.status.error
    }));

    return result;
  } catch {
    // Silent failure - API not available, just return undefined
    return undefined;
  }
}

/**
 * Restarts the MCP Hub Lite server with the same configuration options.
 *
 * This function performs a graceful restart by:
 * - First stopping the currently running server (if any)
 * - Then starting a new server instance with the provided options
 *
 * This is useful for applying configuration changes or recovering from
 * transient issues without manual intervention.
 *
 * @param options - Configuration options for the new server instance
 * @param {number} options.port - The port number to listen on
 * @param {string} options.host - The host address to bind to
 * @param {string} [options.configPath] - Optional path to custom configuration file
 * @returns {Promise<void>} A promise that resolves when the server is successfully restarted
 *
 * @example
 * ```typescript
 * await restartServer({
 *   port: 7788,
 *   host: 'localhost'
 * });
 * ```
 */
export async function restartServer(options: ServerOptions): Promise<void> {
  await stopServer();
  await startServer(options);
}

/**
 * Lists all configured MCP servers with their instances.
 *
 * This function retrieves all servers managed by the HubManager and
 * enriches them with their associated instances (if any). Each server
 * object includes its configuration and an array of active instances.
 *
 * This is primarily used by the CLI `list` command to display the
 * current server configuration to users.
 *
 * @returns {Promise<Array>} Array of server objects with instances included
 *
 * @example
 * ```typescript
 * const servers = await listServers();
 * servers.forEach(server => {
 *   console.log(`Server: ${server.name}`);
 *   console.log(`Instances: ${server.instances.length}`);
 * });
 * ```
 */
export async function listServers() {
  // Dynamic import to avoid loading heavyweight services for simple commands
  const { hubManager } = await import('@services/hub-manager.service.js');
  const servers = hubManager.getAllServers();
  const serverInstances = hubManager.getServerInstances();

  return servers.map((server) => ({
    ...server,
    instances: serverInstances[server.name] || []
  }));
}
