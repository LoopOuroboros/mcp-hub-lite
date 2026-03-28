import { hubManager } from '@services/hub-manager.service.js';
import { InstanceSelector } from './instance-selector.js';
import { logger } from '@utils/logger.js';
import type { RequestOptions, ServerInstanceInfo, ValidServer } from './types.js';

/**
 * Gets the description for a server, using a default if none is provided.
 *
 * @param serverConfig - Server configuration object (may contain description in template)
 * @param serverName - Name of the server
 * @returns The server description or a default one
 */
export function getServerDescription(
  serverConfig: { template?: { description?: string } } | undefined,
  serverName: string
): string {
  return serverConfig?.template?.description || `Connected MCP server: ${serverName}`;
}

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
 * handling both single and multiple instance scenarios using configurable instance
 * selection strategies (random, round-robin, tag-match-unique).
 *
 * The function performs the following steps:
 * 1. Retrieves all instances of the specified server name
 * 2. Returns undefined if no instances are found
 * 3. Gets the server configuration from the hub manager
 * 4. Uses InstanceSelector to choose the best instance based on configured strategy
 * 5. Handles errors gracefully and returns undefined on failure
 *
 * Supported instance selection strategies:
 * - random: Randomly selects from enabled instances
 * - round-robin: Cycles through enabled instances in order
 * - tag-match-unique: Selects instance that uniquely matches request tags
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
 * // With request options for tag matching
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
  const instances = hubManager.getServerInstancesByName(serverName);

  if (instances.length === 0) {
    return undefined;
  }

  // Get server configuration
  const serverConfig = hubManager.getServerByName(serverName);
  if (!serverConfig) {
    return undefined;
  }

  try {
    // Use the new instance selector
    const selectedInstance = InstanceSelector.selectInstance(
      serverName,
      serverConfig,
      requestOptions
    );

    if (!selectedInstance) {
      return undefined;
    }

    return {
      name: serverName,
      config: serverConfig,
      instance: selectedInstance
    };
  } catch (error) {
    // Handle tag matching errors and other exceptions gracefully
    logger.error(`Instance selection failed for server ${serverName}:`, error);
    return undefined;
  }
}
