/**
 * Server configuration management utilities for v1.1 format.
 * Handles CRUD operations for server templates and instances.
 */

import { ServerTemplateSchema, ServerInstanceSchema, ServerConfigSchema } from './config.schema.js';
import type { ServerTemplate, ServerInstance, ServerConfig } from './config.schema.js';
import type { InstanceSelectionStrategy } from '@shared-models/server.model.js';
import { convertHttpToStreamableHttp } from './type-converter.js';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { getObjectChanges, logObjectChangesWithTitle } from './config-change-logger.js';
import { sortServerConfigEnvHeaders } from '@utils/sort-utils.js';
import { generateInstanceId } from '@utils/instance-id.js';

/**
 * Creates a default server instance with index assignment.
 *
 * @param serverName - Name of the server
 * @param existingInstances - Existing instances for index calculation
 * @param partialInstance - Partial instance configuration
 * @returns A complete server instance
 */
function createDefaultInstance(
  serverName: string,
  existingInstances: ServerInstance[],
  partialInstance: Partial<ServerInstance> = {}
): ServerInstance {
  const instance: Partial<ServerInstance> = {
    ...partialInstance
  };

  // Generate content-based ID with deduplication
  if (!instance.id) {
    const baseId = generateInstanceId(serverName, partialInstance);
    let id = baseId;
    let suffix = 2;
    while (existingInstances.some((inst) => inst.id === id)) {
      id = `${baseId}-${suffix}`;
      suffix++;
    }
    instance.id = id;
  }

  // Assign index: max index + 1, or 0 if no existing instances
  if (instance.index === undefined) {
    if (existingInstances.length === 0) {
      instance.index = 0;
    } else {
      const indexes = existingInstances.map((inst) => inst.index ?? 0);
      const maxIndex = Math.max(...indexes);
      instance.index = maxIndex + 1;
    }
  }

  return ServerInstanceSchema.parse(instance);
}

/**
 * Adds multiple server configurations to the system in a single operation.
 *
 * @param servers - Array of server objects containing name and partial template configuration
 * @param currentServers - Current servers configuration object (will be modified)
 * @returns The updated servers configuration
 */
export function addServers(
  servers: Array<{ name: string; config: Partial<ServerTemplate> }>,
  currentServers: Record<string, ServerConfig>
): Record<string, ServerConfig> {
  for (const { name, config } of servers) {
    // Unified type conversion: convert http to streamable-http
    const convertedConfig = convertHttpToStreamableHttp(config) as Partial<ServerTemplate>;
    let template = ServerTemplateSchema.parse(convertedConfig);

    // Sort env and headers keys for consistency
    template = sortServerConfigEnvHeaders(template);

    // Create default instance
    let defaultInstance = createDefaultInstance(name, []);

    // Sort env and headers keys for consistency
    defaultInstance = sortServerConfigEnvHeaders(defaultInstance);

    // Extract instance selection strategy from config if provided, otherwise default to random
    const { instanceSelectionStrategy = 'random' } = config as Partial<ServerTemplate> & {
      instanceSelectionStrategy?: InstanceSelectionStrategy;
    };

    currentServers[name] = ServerConfigSchema.parse({
      template,
      instances: [defaultInstance],
      instanceSelectionStrategy
    });
  }

  // Ensure server configurations are sorted by name
  return Object.fromEntries(Object.entries(currentServers).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Adds a new server configuration to the system (v1.1 format).
 * Creates a template and a default instance.
 *
 * @param name - The unique name for the server
 * @param config - The server template configuration (partial, will be validated)
 * @param currentServers - Current servers configuration object (will be modified)
 * @returns The complete server configuration (v1.1)
 */
export function addServer(
  name: string,
  config: Partial<ServerTemplate>,
  currentServers: Record<string, ServerConfig>
): ServerConfig {
  // Unified type conversion: convert http to streamable-http
  const convertedConfig = convertHttpToStreamableHttp(config);
  let template = ServerTemplateSchema.parse(convertedConfig);

  // Sort env and headers keys for consistency
  template = sortServerConfigEnvHeaders(template);

  // Create default instance
  let defaultInstance = createDefaultInstance(name, []);

  // Sort env and headers keys for consistency
  defaultInstance = sortServerConfigEnvHeaders(defaultInstance);

  // Extract instance selection strategy from config if provided, otherwise default to random
  const { instanceSelectionStrategy = 'random' } = config as Partial<ServerTemplate> & {
    instanceSelectionStrategy?: InstanceSelectionStrategy;
  };

  const serverConfig = ServerConfigSchema.parse({
    template,
    instances: [defaultInstance],
    instanceSelectionStrategy
  });

  currentServers[name] = serverConfig;

  // Ensure server configurations are sorted by name
  const sortedServers = Object.fromEntries(
    Object.entries(currentServers).sort(([a], [b]) => a.localeCompare(b))
  );

  // Update the reference
  Object.keys(currentServers).forEach((key) => delete currentServers[key]);
  Object.assign(currentServers, sortedServers);

  return serverConfig;
}

/**
 * Adds a new server instance for the specified server.
 *
 * @param name - The name of the server to add an instance for
 * @param instance - The server instance configuration (partial, will be validated)
 * @param currentServers - Current servers configuration object (will be modified)
 * @returns The validated and complete server instance configuration
 */
export function addServerInstance(
  name: string,
  instance: Partial<ServerInstance>,
  currentServers: Record<string, ServerConfig>
): ServerInstance {
  if (!currentServers[name]) {
    throw new Error(`Server not found: ${name}`);
  }

  const existingInstances = currentServers[name].instances || [];
  let newInstance = createDefaultInstance(name, existingInstances, instance);

  // Sort env and headers keys for consistency
  newInstance = sortServerConfigEnvHeaders(newInstance);

  currentServers[name].instances = [...existingInstances, newInstance];
  return newInstance;
}

/**
 * Reassigns server instance indexes to be consecutive (0, 1, 2, ...).
 *
 * @param name - The name of the server to reassign indexes for
 * @param currentServers - Current servers configuration object (will be modified)
 * @returns True if the server exists and indexes were reassigned
 */
export function reassignServerInstanceIndexes(
  name: string,
  currentServers: Record<string, ServerConfig>
): boolean {
  if (!currentServers[name] || currentServers[name].instances.length === 0) {
    return false;
  }

  // Sort instances by their current index
  const sortedInstances = [...currentServers[name].instances].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  );

  // Reassign indexes to be consecutive starting from 0
  sortedInstances.forEach((instance, newIndex) => {
    instance.index = newIndex;
  });

  // Update the server instances array
  currentServers[name].instances = sortedInstances;
  return true;
}

/**
 * Updates an existing server configuration (template and/or instance selection strategy).
 *
 * @param name - The name of the server to update
 * @param updates - The partial server configuration updates to apply (can include template and instanceSelectionStrategy)
 * @param currentServers - Current servers configuration object (will be modified)
 * @returns True if the server was updated
 */
export function updateServerTemplate(
  name: string,
  updates: Partial<ServerTemplate> & { instanceSelectionStrategy?: InstanceSelectionStrategy },
  currentServers: Record<string, ServerConfig>
): boolean {
  if (currentServers[name]) {
    const oldServerConfig = JSON.parse(JSON.stringify(currentServers[name]));

    // Handle instance selection strategy update
    if (updates.instanceSelectionStrategy !== undefined) {
      currentServers[name].instanceSelectionStrategy = updates.instanceSelectionStrategy;
    }

    // Handle template updates
    const templateUpdates = { ...updates };
    delete templateUpdates.instanceSelectionStrategy;

    if (Object.keys(templateUpdates).length > 0) {
      // Unified type conversion: convert http to streamable-http
      const convertedUpdates = convertHttpToStreamableHttp(
        templateUpdates
      ) as Partial<ServerTemplate>;
      currentServers[name].template = {
        ...currentServers[name].template,
        ...convertedUpdates
      };
      // Sort env and headers keys for consistency
      currentServers[name].template = sortServerConfigEnvHeaders(currentServers[name].template);
    }

    // Ensure server configurations are sorted by name
    const sortedServers = Object.fromEntries(
      Object.entries(currentServers).sort(([a], [b]) => a.localeCompare(b))
    );

    // Update the reference
    Object.keys(currentServers).forEach((key) => delete currentServers[key]);
    Object.assign(currentServers, sortedServers);

    // Log template changes
    const changes = getObjectChanges(oldServerConfig, currentServers[name]);
    if (changes.length > 0) {
      const title = `Template updated: ${name}`;
      logObjectChangesWithTitle(
        title,
        oldServerConfig,
        currentServers[name],
        LOG_MODULES.SERVER_CONFIG_MANAGER
      );
    }

    return true;
  }
  return false;
}

/**
 * Updates an existing server instance configuration.
 *
 * @param name - The name of the server containing the instance to update
 * @param index - The index of the instance to update
 * @param updates - The partial instance updates to apply
 * @param currentServers - Current servers configuration object (will be modified)
 * @returns True if the instance was updated
 */
export function updateServerInstance(
  name: string,
  index: number | string,
  updates: Partial<ServerInstance>,
  currentServers: Record<string, ServerConfig>
): boolean {
  const numericIndex = typeof index === 'string' ? parseInt(index, 10) : index;

  logger.debug(
    `updateServerInstance called: server=${name}, index=${numericIndex}`,
    LOG_MODULES.SERVER_CONFIG_MANAGER
  );

  if (currentServers[name]?.instances) {
    const instances = currentServers[name].instances;
    const instanceIndex = instances.findIndex((inst) => inst.index === numericIndex);

    if (instanceIndex !== -1) {
      const originalInstance = JSON.parse(JSON.stringify(instances[instanceIndex]));

      let updatedInstance = {
        ...instances[instanceIndex],
        ...updates,
        // Explicitly preserve the original index field
        index: originalInstance.index
      };
      // Sort env and headers keys for consistency
      updatedInstance = sortServerConfigEnvHeaders(updatedInstance);

      // Always recalculate ID based on current content
      const newId = generateInstanceId(name, updatedInstance);
      let finalId = newId;
      let suffix = 2;
      while (instances.some((inst, i) => i !== instanceIndex && inst.id === finalId)) {
        finalId = `${newId}-${suffix}`;
        suffix++;
      }
      updatedInstance.id = finalId;

      instances[instanceIndex] = updatedInstance;

      // Log instance changes
      const changes = getObjectChanges(originalInstance, instances[instanceIndex]);
      if (changes.length > 0) {
        const title = originalInstance.displayName
          ? `Instance [id=${originalInstance.id}, displayName=${originalInstance.displayName}] updated:`
          : `Instance [id=${originalInstance.id}] updated:`;
        logObjectChangesWithTitle(
          title,
          originalInstance,
          instances[instanceIndex],
          LOG_MODULES.SERVER_CONFIG_MANAGER
        );
      }

      return true;
    } else {
      // Fallback: try array index directly
      if (numericIndex >= 0 && numericIndex < instances.length) {
        const originalInstance = JSON.parse(JSON.stringify(instances[numericIndex]));
        let updatedInstance = {
          ...instances[numericIndex],
          ...updates,
          // Ensure index field is set to the numericIndex when using array index fallback
          index: numericIndex
        };
        // Sort env and headers keys for consistency
        updatedInstance = sortServerConfigEnvHeaders(updatedInstance);

        // Always recalculate ID based on current content
        const newId = generateInstanceId(name, updatedInstance);
        let finalId = newId;
        let suffix = 2;
        while (instances.some((inst, i) => i !== numericIndex && inst.id === finalId)) {
          finalId = `${newId}-${suffix}`;
          suffix++;
        }
        updatedInstance.id = finalId;

        instances[numericIndex] = updatedInstance;

        // Log instance changes
        const changes = getObjectChanges(originalInstance, instances[numericIndex]);
        if (changes.length > 0) {
          const title = originalInstance.displayName
            ? `Instance [id=${originalInstance.id}, displayName=${originalInstance.displayName}] updated:`
            : `Instance [id=${originalInstance.id}] updated:`;
          logObjectChangesWithTitle(
            title,
            originalInstance,
            instances[numericIndex],
            LOG_MODULES.SERVER_CONFIG_MANAGER
          );
        }

        return true;
      }
    }
  } else {
    logger.debug(`Server ${name} not found or has no instances`, LOG_MODULES.SERVER_CONFIG_MANAGER);
  }
  return false;
}

/**
 * Removes a server configuration and all its instances from the system.
 *
 * @param name - The name of the server to remove
 * @param currentServers - Current servers configuration object (will be modified)
 * @returns True if the server was removed
 */
export function removeServer(name: string, currentServers: Record<string, ServerConfig>): boolean {
  if (currentServers[name]) {
    delete currentServers[name];

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
 * @param index - The index of the instance to remove
 * @param currentServers - Current servers configuration object (will be modified)
 * @returns True if the instance was removed
 */
export function removeServerInstance(
  name: string,
  index: number | string,
  currentServers: Record<string, ServerConfig>
): boolean {
  if (currentServers[name]?.instances) {
    const numericIndex = typeof index === 'string' ? parseInt(index, 10) : index;
    const instanceIndex = currentServers[name].instances.findIndex(
      (inst) => inst.index === numericIndex
    );
    if (instanceIndex !== -1) {
      currentServers[name].instances.splice(instanceIndex, 1);
      if (currentServers[name].instances.length === 0) {
        // Keep the server even if it has no instances
      }
      return true;
    }
  }
  return false;
}
