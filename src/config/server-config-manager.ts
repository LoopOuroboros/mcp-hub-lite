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

  // Minimal identity generation logic
  if (!instance.id) {
    instance.id = generateInstanceId(serverName);
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
    const template = ServerTemplateSchema.parse(convertedConfig);

    // Create default instance
    const defaultInstance = createDefaultInstance(name, []);

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
  const template = ServerTemplateSchema.parse(convertedConfig);

  // Create default instance
  const defaultInstance = createDefaultInstance(name, []);

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
  const newInstance = createDefaultInstance(name, existingInstances, instance);

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
    `updateServerInstance called for server: ${name}, index: ${numericIndex} (type: ${typeof numericIndex})`,
    LOG_MODULES.SERVER_CONFIG_MANAGER
  );
  logger.debug(`Updates received:`, LOG_MODULES.SERVER_CONFIG_MANAGER, updates);

  if (currentServers[name]?.instances) {
    const instances = currentServers[name].instances;
    logger.debug(`All instances for server ${name}:`, LOG_MODULES.SERVER_CONFIG_MANAGER, instances);
    logger.debug(
      `Instance indexes:`,
      LOG_MODULES.SERVER_CONFIG_MANAGER,
      instances.map((inst, i) => ({
        arrayIndex: i,
        instanceIndex: inst.index,
        type: typeof inst.index
      }))
    );

    const instanceIndex = instances.findIndex((inst) => {
      const match = inst.index === numericIndex;
      logger.debug(
        `Comparing: inst.index=${inst.index} (${typeof inst.index}) === index=${numericIndex} (${typeof numericIndex}) => ${match}`,
        LOG_MODULES.SERVER_CONFIG_MANAGER
      );
      return match;
    });

    if (instanceIndex !== -1) {
      const originalInstance = JSON.parse(JSON.stringify(instances[instanceIndex]));
      logger.debug(
        `Original instance before update:`,
        LOG_MODULES.SERVER_CONFIG_MANAGER,
        originalInstance
      );

      instances[instanceIndex] = {
        ...instances[instanceIndex],
        ...updates,
        // Explicitly preserve the original index field
        index: originalInstance.index
      };

      logger.debug(
        `Updated instance after merge:`,
        LOG_MODULES.SERVER_CONFIG_MANAGER,
        instances[instanceIndex]
      );

      // Log instance changes
      const changes = getObjectChanges(originalInstance, instances[instanceIndex]);
      if (changes.length > 0) {
        const title = `Instance updated: ${name}, instanceId=${originalInstance.id}, displayName=${originalInstance.displayName || 'N/A'}`;
        logObjectChangesWithTitle(
          title,
          originalInstance,
          instances[instanceIndex],
          LOG_MODULES.SERVER_CONFIG_MANAGER
        );
      }

      return true;
    } else {
      logger.debug(
        `Instance with index ${numericIndex} not found`,
        LOG_MODULES.SERVER_CONFIG_MANAGER
      );
      // Try fallback to array index
      if (numericIndex >= 0 && numericIndex < instances.length) {
        logger.debug(
          `Falling back to array index ${numericIndex} (since index field match failed)`,
          LOG_MODULES.SERVER_CONFIG_MANAGER
        );
        const originalInstance = JSON.parse(JSON.stringify(instances[numericIndex]));
        instances[numericIndex] = {
          ...instances[numericIndex],
          ...updates,
          // Ensure index field is set to the numericIndex when using array index fallback
          index: numericIndex
        };
        logger.debug(
          `Updated instance via array index:`,
          LOG_MODULES.SERVER_CONFIG_MANAGER,
          instances[numericIndex]
        );

        // Log instance changes
        const changes = getObjectChanges(originalInstance, instances[numericIndex]);
        if (changes.length > 0) {
          const title = `Instance updated: ${name}, instanceId=${originalInstance.id}, displayName=${originalInstance.displayName || 'N/A'}`;
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
    logger.debug(
      `Current servers keys:`,
      LOG_MODULES.SERVER_CONFIG_MANAGER,
      Object.keys(currentServers)
    );
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
