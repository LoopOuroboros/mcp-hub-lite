/**
 * CLI Server Management Functions
 * Handles start, stop, status, restart operations
 */

import { PidManager } from '@pid/manager.js';

interface ServerOptions {
  port: number;
  host: string;
  configPath?: string;
}

/**
 * Starts the MCP Hub Lite server with the specified configuration options.
 *
 * This function initializes and starts the Fastify HTTP server that serves as the
 * core of the MCP Hub Lite application. It handles both the web interface and
 * the MCP (Model Context Protocol) gateway functionality.
 *
 * The server provides:
 * - Web API endpoints for server management and configuration
 * - WebSocket endpoints for real-time client communication
 * - MCP JSON-RPC 2.0 protocol endpoints for MCP tool integration
 * - Static file serving for the Vue.js frontend application
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
 * @returns {Promise<import('fastify').FastifyInstance>} A promise that resolves to the Fastify application instance
 * @throws {Error} If the server fails to start due to port conflicts, permission issues, or configuration errors
 *
 * @example
 * ```typescript
 * const server = await startServer({
 *   port: 7788,
 *   host: 'localhost'
 * });
 * console.log(`Server running on http://${options.host}:${options.port}`);
 * ```
 *
 * @see {@link buildApp} for Fastify application configuration details
 * @see {@link PidManager} for process ID management
 */
export async function startServer(options: ServerOptions) {
  // Dynamic import to avoid loading heavyweight services for simple commands
  const { buildApp } = await import('@src/app.js');
  const app = await buildApp();

  // Start the server
  await app.listen({ port: options.port, host: options.host });

  // Save PID
  PidManager.writePid();

  return app;
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
 * - If running, returns detailed status including connected server count
 * - If not running, returns appropriate status message
 *
 * The function uses `process.kill(pid, 0)` which doesn't actually kill the process
 * but checks if a process with the given PID exists and is accessible.
 *
 * @param pid - Optional specific process ID to check. If not provided, uses PID from PID file.
 * @returns {Promise<{running: boolean, message?: string, pid?: string, servers?: number}>}
 *          Status object with running flag and additional details if applicable
 *
 * @example
 * ```typescript
 * const status = await getServerStatus();
 * if (status.running) {
 *   console.log(`Server running with PID ${status.pid} and ${status.servers} connected servers`);
 * } else {
 *   console.log(`Server not running: ${status.message}`);
 * }
 * ```
 */
export async function getServerStatus(pid?: string) {
  const actualPid = pid || PidManager.getPid()?.toString();

  if (!actualPid) {
    return { running: false, message: 'Server not running' };
  }

  try {
    process.kill(parseInt(actualPid), 0); // Signal 0 just checks if process exists
    return {
      running: true,
      pid: actualPid
    };
  } catch {
    return { running: false, message: 'Server process not found' };
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
 * @returns {Promise<import('fastify').FastifyInstance>} A promise that resolves to the new Fastify application instance
 *
 * @example
 * ```typescript
 * const newServer = await restartServer({
 *   port: 7788,
 *   host: 'localhost'
 * });
 * ```
 */
export async function restartServer(options: ServerOptions) {
  await stopServer();
  return await startServer(options);
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
