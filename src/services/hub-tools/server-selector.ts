import { hubManager } from '@services/hub-manager.service.js';
import type { RequestOptions, ServerInstanceInfo, ValidServer } from './types.js';

/**
 * Type guard to validate that a server object has valid name and configuration.
 *
 * This function checks if the provided object is a valid server with both a non-empty
 * name string and a configuration object, ensuring type safety for server operations.
 *
 * @param {unknown} server - Object to validate as a server
 * @returns {boolean} True if the object is a valid server with name and config
 *
 * @example
 * ```typescript
 * const server = { name: 'my-server', config: { type: 'stdio' } };
 * if (hasValidId(server)) {
 *   // TypeScript knows server is properly typed
 *   console.log(server.name);
 * }
 * ```
 */
export function hasValidId(server: unknown): server is ValidServer {
  if (typeof server !== 'object' || server === null) {
    return false;
  }
  const s = server as { name?: unknown; config?: unknown };
  return typeof s.name === 'string' && s.name.length > 0 && typeof s.config === 'object';
}

/**
 * Selects the best server instance based on server name and request options.
 *
 * This function resolves a server name to its configuration and instance details,
 * handling both single and multiple instance scenarios. Currently, it returns
 * the first instance for multi-instance servers, but the architecture supports
 * future extensions for intelligent instance selection based on session ID,
 * tags, client ID, or load conditions.
 *
 * The function performs the following steps:
 * 1. Retrieves all instances of the specified server name
 * 2. Returns undefined if no instances are found
 * 3. Gets the server configuration from the hub manager
 * 4. For single-instance servers, returns the instance directly
 * 5. For multi-instance servers, currently returns the first instance (with future extension support)
 *
 * Future extensions planned include:
 * - Session-aware instance selection based on sessionId
 * - Tag-based instance selection for matching specific requirements
 * - Load-balancing across multiple instances
 * - Client-specific instance assignment
 *
 * @param {string} serverName - Name of the server to select an instance for
 * @param {RequestOptions} [requestOptions] - Optional request options for instance selection
 * @returns {{ name: string; config: ServerConfig; instance: ServerInstanceConfig & Record<string, unknown> } | undefined}
 * Server information with configuration and instance details, or undefined if not found
 *
 * @example
 * ```typescript
 * const serverInfo = selectBestInstance('my-mcp-server');
 * if (serverInfo) {
 *   console.log(`Selected instance: ${serverInfo.instance.id}`);
 * }
 *
 * // With request options (future extension)
 * const serverInfoWithOptions = selectBestInstance('my-mcp-server', {
 *   sessionId: 'session-123',
 *   tags: { environment: 'production' }
 * });
 * ```
 */
export function selectBestInstance(
  serverName: string,
  requestOptions?: RequestOptions
): ServerInstanceInfo | undefined {
  // Get all instances of the server
  const instances = hubManager.getServerInstanceByName(serverName);

  if (instances.length === 0) {
    return undefined;
  }

  // Get server configuration
  const serverConfig = hubManager.getServerByName(serverName);
  if (!serverConfig) {
    return undefined;
  }

  // If there's only one instance, return it directly
  if (instances.length === 1) {
    return {
      name: serverName,
      config: serverConfig,
      instance: instances[0]
    };
  }

  // Multi-instance selection logic (for future extension)
  // Currently simplified implementation: return the first instance
  // Future extensions could support:
  // - Selecting specific instance based on sessionId
  // - Selecting optimal instance based on tags matching
  // - Selecting dedicated instance based on client ID
  // - Selecting instance based on load conditions

  // Although requestOptions is not currently used, it's kept for future extension
  if (requestOptions?.sessionId) {
    // In the future, specific instance can be selected based on sessionId
    // Currently return the first instance temporarily
  }

  if (requestOptions?.tags) {
    // In the future, optimal instance can be selected based on tags matching
    // Currently return the first instance temporarily
  }

  return {
    name: serverName,
    config: serverConfig,
    instance: instances[0] // Will be extended to intelligent selection logic later
  };
}
