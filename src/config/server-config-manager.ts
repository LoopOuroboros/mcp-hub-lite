/**
 * Server configuration management utilities.
 * Handles CRUD operations for server configurations and instances.
 */

import { ServerConfigSchema, ServerInstanceConfigSchema } from './config.schema.js';
import type { ServerConfig, ServerInstanceConfig } from './config.schema.js';
import { convertHttpToStreamableHttp } from './type-converter.js';

/**
 * Generates a unique server instance ID.
 *
 * @param serverName - Name of the server
 * @returns A unique instance ID
 */
function generateInstanceId(serverName: string): string {
  const ts = Date.now();
  return `${serverName}-${ts}-${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * Adds multiple server configurations to the system in a single operation.
 *
 * @param servers - Array of server objects containing name and partial configuration
 * @param currentServers - Current servers configuration object (will be modified)
 * @param serverInstances - Current server instances record (will be modified)
 * @returns The updated servers configuration
 */
export function addServers(
  servers: Array<{ name: string; config: Partial<ServerConfig> }>,
  currentServers: Record<string, ServerConfig>,
  serverInstances: Record<string, ServerInstanceConfig[]>
): Record<string, ServerConfig> {
  for (const { name, config } of servers) {
    // Unified type conversion: convert http to streamable-http
    const convertedConfig = convertHttpToStreamableHttp(config) as Partial<ServerConfig>;
    currentServers[name] = ServerConfigSchema.parse(convertedConfig);
    if (!serverInstances[name]) serverInstances[name] = [];
  }

  // Ensure server configurations are sorted by name
  return Object.fromEntries(Object.entries(currentServers).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Adds a new server configuration to the system.
 *
 * @param name - The unique name for the server
 * @param config - The server configuration (partial, will be validated)
 * @param currentServers - Current servers configuration object (will be modified)
 * @param serverInstances - Current server instances record (will be modified)
 * @returns The validated and complete server configuration
 */
export function addServer(
  name: string,
  config: Partial<ServerConfig>,
  currentServers: Record<string, ServerConfig>,
  serverInstances: Record<string, ServerInstanceConfig[]>
): ServerConfig {
  // Unified type conversion: convert http to streamable-http
  const convertedConfig = convertHttpToStreamableHttp(config);
  const validated = ServerConfigSchema.parse(convertedConfig);
  currentServers[name] = validated;
  if (!serverInstances[name]) serverInstances[name] = [];

  // Ensure server configurations are sorted by name
  const sortedServers = Object.fromEntries(
    Object.entries(currentServers).sort(([a], [b]) => a.localeCompare(b))
  );

  // Update the reference
  Object.keys(currentServers).forEach((key) => delete currentServers[key]);
  Object.assign(currentServers, sortedServers);

  return validated;
}

/**
 * Adds a new server instance for the specified server.
 *
 * @param name - The name of the server to add an instance for
 * @param instance - The server instance configuration (partial, will be validated)
 * @param serverInstances - Current server instances record (will be modified)
 * @returns The validated and complete server instance configuration
 */
export function addServerInstance(
  name: string,
  instance: Partial<ServerInstanceConfig>,
  serverInstances: Record<string, ServerInstanceConfig[]>
): ServerInstanceConfig {
  if (!serverInstances[name]) serverInstances[name] = [];

  // Minimal identity generation logic
  if (!instance.id) {
    const ts = Date.now();
    instance.id = generateInstanceId(name);
    instance.timestamp = ts;
    instance.hash = Math.random().toString(36);
  }

  const validated = ServerInstanceConfigSchema.parse(instance);
  serverInstances[name].push(validated);
  return validated;
}

/**
 * Updates an existing server configuration with the provided changes.
 *
 * @param name - The name of the server to update
 * @param updates - The partial configuration updates to apply
 * @param currentServers - Current servers configuration object (will be modified)
 * @returns True if the server was updated, false if it didn't exist
 */
export function updateServer(
  name: string,
  updates: Partial<ServerConfig>,
  currentServers: Record<string, ServerConfig>
): boolean {
  if (currentServers[name]) {
    // Unified type conversion: convert http to streamable-http
    const convertedUpdates = convertHttpToStreamableHttp(updates) as Partial<ServerConfig>;
    currentServers[name] = { ...currentServers[name], ...convertedUpdates };

    // Ensure server configurations are sorted by name
    const sortedServers = Object.fromEntries(
      Object.entries(currentServers).sort(([a], [b]) => a.localeCompare(b))
    );

    // Update the reference
    Object.keys(currentServers).forEach((key) => delete currentServers[key]);
    Object.assign(currentServers, sortedServers);

    return true;
  }
  return false;
}

/**
 * Updates an existing server instance configuration with the provided changes.
 *
 * @param name - The name of the server containing the instance to update
 * @param index - The index of the instance to update in the instances array
 * @param updates - The partial instance configuration updates to apply
 * @param serverInstances - Current server instances record (will be modified)
 * @returns True if the instance was updated, false if it didn't exist
 */
export function updateServerInstance(
  name: string,
  index: number,
  updates: Partial<ServerInstanceConfig>,
  serverInstances: Record<string, ServerInstanceConfig[]>
): boolean {
  if (serverInstances[name]?.[index]) {
    serverInstances[name][index] = { ...serverInstances[name][index], ...updates };
    return true;
  }
  return false;
}

/**
 * Removes a server configuration and all its instances from the system.
 *
 * @param name - The name of the server to remove
 * @param currentServers - Current servers configuration object (will be modified)
 * @param serverInstances - Current server instances record (will be modified)
 * @returns True if the server was removed, false if it didn't exist
 */
export function removeServer(
  name: string,
  currentServers: Record<string, ServerConfig>,
  serverInstances: Record<string, ServerInstanceConfig[]>
): boolean {
  if (currentServers[name]) {
    delete currentServers[name];
    delete serverInstances[name];

    // Ensure server configurations are sorted by name
    const sortedServers = Object.fromEntries(
      Object.entries(currentServers).sort(([a], [b]) => a.localeCompare(b))
    );

    // Update the reference
    Object.keys(currentServers).forEach((key) => delete currentServers[key]);
    Object.assign(currentServers, sortedServers);

    return true;
  }
  return false;
}

/**
 * Removes a specific server instance from the system.
 *
 * @param name - The name of the server containing the instance to remove
 * @param index - The index of the instance to remove from the instances array
 * @param serverInstances - Current server instances record (will be modified)
 * @returns True if the instance was removed, false if it didn't exist
 */
export function removeServerInstance(
  name: string,
  index: number,
  serverInstances: Record<string, ServerInstanceConfig[]>
): boolean {
  if (serverInstances[name]) {
    serverInstances[name].splice(index, 1);
    if (serverInstances[name].length === 0) {
      delete serverInstances[name];
    }
    return true;
  }
  return false;
}
