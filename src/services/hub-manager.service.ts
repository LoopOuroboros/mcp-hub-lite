import {
  ConfigManager,
  configManager,
  ServerConfig,
  ServerInstanceConfig
} from '@config/config-manager.js';
import { logger } from '@utils/logger.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';
import { eventBus, EventTypes } from './event-bus.service.js';

/**
 * Manages MCP server configurations and lifecycle operations through the configuration manager.
 *
 * This service provides a comprehensive interface for CRUD operations on MCP servers,
 * including batch operations for performance optimization, instance management, and
 * event-driven communication with other system components. It serves as the primary
 * entry point for server management operations in the MCP Hub Lite system.
 *
 * The service integrates with the configuration manager for persistence and the
 * MCP connection manager for automatic connection handling, while publishing
 * events to notify other components of state changes.
 *
 * @example
 * ```typescript
 * const hubManager = new HubManagerService();
 * await hubManager.addServer('my-server', { type: 'stdio', command: 'npx my-mcp' });
 * await hubManager.removeServer('my-server');
 * ```
 */
export class HubManagerService {
  private configManager: ConfigManager;

  constructor(manager: ConfigManager = configManager) {
    this.configManager = manager;
  }

  /**
   * Adds multiple server configurations in a single batch operation without auto-starting.
   *
   * This method optimizes performance for bulk server addition by batching configuration
   * updates and saving the configuration only once at the end. It publishes SERVER_ADDED
   * events for each newly added server to notify other system components.
   *
   * @param {Array<{ name: string; config: Partial<ServerConfig> }>} servers - Array of server configurations to add
   * @returns {Promise<void>} Resolves when all servers are added and configuration is saved
   *
   * @example
   * ```typescript
   * await hubManager.addServersWithoutAutoStart([
   *   { name: 'server1', config: { type: 'stdio', command: 'npx server1' } },
   *   { name: 'server2', config: { type: 'http', url: 'http://localhost:8080' } }
   * ]);
   * ```
   */
  async addServersWithoutAutoStart(
    servers: Array<{ name: string; config: Partial<ServerConfig> }>
  ): Promise<void> {
    await this.configManager.addServers(servers);
    // Publish SERVER_ADDED event for all newly added servers
    for (const { name } of servers) {
      const serverConfig = this.getServerByName(name);
      if (serverConfig) {
        eventBus.publish(EventTypes.SERVER_ADDED, { name, config: serverConfig });
      }
    }
  }

  /**
   * Creates server instances for multiple servers without automatically connecting them.
   *
   * This method iterates through the provided server names and creates a new instance
   * for each server using the configuration manager. It publishes SERVER_INSTANCE_ADDED
   * events for each created instance to notify other system components.
   *
   * @param {string[]} serverNames - Array of server names to create instances for
   * @returns {Promise<void>} Resolves when all instances are created
   *
   * @example
   * ```typescript
   * await hubManager.addServerInstancesWithoutConnect(['server1', 'server2']);
   * ```
   */
  async addServerInstancesWithoutConnect(serverNames: string[]): Promise<void> {
    for (const name of serverNames) {
      await this.configManager.addServerInstance(name, {});
      const instances = this.getServerInstanceByName(name);
      const lastInstance = instances[instances.length - 1];
      eventBus.publish(EventTypes.SERVER_INSTANCE_ADDED, { name, instance: lastInstance });
    }
  }

  /**
   * Concurrently connects to multiple server instances using Promise.all for efficiency.
   *
   * This method iterates through the provided server names, retrieves their configurations
   * and instances, and attempts to connect to each instance concurrently. It only attempts
   * to connect to servers that are enabled in their configuration. Errors during connection
   * are logged but don't prevent other connections from proceeding.
   *
   * @param {string[]} serverNames - Array of server names to connect instances for
   * @returns {Promise<void>} Resolves when all connection attempts complete
   *
   * @example
   * ```typescript
   * await hubManager.connectServerInstances(['server1', 'server2']);
   * ```
   */
  async connectServerInstances(serverNames: string[]): Promise<void> {
    const connectPromises = serverNames.map(async (name) => {
      const server = this.getServerByName(name);
      if (server && server.enabled !== false) {
        const instances = this.getServerInstanceByName(name);
        for (const instance of instances) {
          try {
            await mcpConnectionManager.connect({ ...server, ...instance });
          } catch (error) {
            logger.error(`Failed to connect server instance for ${name}:`, error);
          }
        }
      }
    });

    // Execute concurrently using Promise.all
    await Promise.all(connectPromises);
  }

  /**
   * Retrieves all configured servers with their names and configurations.
   *
   * This method delegates to the configuration manager to return a complete list of
   * all servers that have been configured in the system, including their full
   * configuration objects.
   *
   * @returns {Array<{ name: string; config: ServerConfig }>} Array of all configured servers
   *
   * @example
   * ```typescript
   * const servers = hubManager.getAllServers();
   * console.log(`Total servers: ${servers.length}`);
   * ```
   */
  getAllServers(): Array<{ name: string; config: ServerConfig }> {
    return this.configManager.getServers();
  }

  /**
   * Retrieves a server configuration and instance by its unique instance ID.
   *
   * This method performs an O(n) search across all servers and their instances to find
   * the matching instance ID. It returns a composite object containing the server name,
   * full configuration, and specific instance configuration.
   *
   * @param {string} id - Unique instance ID to search for
   * @returns {{ name: string; config: ServerConfig; instance: ServerInstanceConfig } | undefined}
   * Composite server/instance object or undefined if not found
   *
   * @example
   * ```typescript
   * const serverInfo = hubManager.getServerById('instance-123');
   * if (serverInfo) {
   *   console.log(`Found server: ${serverInfo.name}`);
   * }
   * ```
   */
  getServerById(
    id: string
  ): { name: string; config: ServerConfig; instance: ServerInstanceConfig } | undefined {
    // Iterate through all servers and instances to find matching id
    const serverInstances = this.configManager.getServerInstances();
    for (const [serverName, instances] of Object.entries(serverInstances)) {
      const instance = instances.find((inst) => inst.id === id);
      if (instance) {
        const serverConfig = this.configManager.getServerByName(serverName);
        if (serverConfig) {
          return {
            name: serverName,
            config: serverConfig,
            instance
          };
        }
      }
    }
    return undefined;
  }

  /**
   * Retrieves a server configuration by its name.
   *
   * This method delegates to the configuration manager to return the full configuration
   * for a server with the specified name, or undefined if no such server exists.
   *
   * @param {string} name - Server name to look up
   * @returns {ServerConfig | undefined} Full server configuration or undefined if not found
   *
   * @example
   * ```typescript
   * const config = hubManager.getServerByName('my-server');
   * if (config) {
   *   console.log(`Server type: ${config.type}`);
   * }
   * ```
   */
  getServerByName(name: string): ServerConfig | undefined {
    return this.configManager.getServerByName(name);
  }

  /**
   * Retrieves all server instances grouped by server name.
   *
   * This method returns a record mapping server names to arrays of their instance configurations,
   * providing a complete view of all server instances in the system.
   *
   * @returns {Record<string, ServerInstanceConfig[]>} Object mapping server names to instance arrays
   *
   * @example
   * ```typescript
   * const instances = hubManager.getServerInstances();
   * Object.entries(instances).forEach(([name, instances]) => {
   *   console.log(`${name} has ${instances.length} instances`);
   * });
   * ```
   */
  getServerInstances(): Record<string, ServerInstanceConfig[]> {
    return this.configManager.getServerInstances();
  }

  /**
   * Retrieves all instances for a specific server by name.
   *
   * This method returns an array of all instance configurations for the specified server,
   * or an empty array if the server doesn't exist or has no instances.
   *
   * @param {string} name - Server name to get instances for
   * @returns {ServerInstanceConfig[]} Array of instance configurations for the server
   *
   * @example
   * ```typescript
   * const instances = hubManager.getServerInstanceByName('my-server');
   * console.log(`Server has ${instances.length} instances`);
   * ```
   */
  getServerInstanceByName(name: string): ServerInstanceConfig[] {
    return this.configManager.getServerInstanceByName(name);
  }

  /**
   * Adds a new server configuration to the system.
   *
   * This method creates a new server with the specified name and configuration,
   * logs the addition, and publishes a SERVER_ADDED event to notify other system components.
   * The method returns the complete server configuration after validation and normalization.
   *
   * @param {string} name - Unique name for the new server
   * @param {Partial<ServerConfig>} config - Partial server configuration to merge with defaults
   * @returns {Promise<ServerConfig>} Complete server configuration after creation
   *
   * @example
   * ```typescript
   * const config = await hubManager.addServer('my-server', {
   *   type: 'stdio',
   *   command: 'npx my-mcp-server'
   * });
   * console.log('Server added successfully');
   * ```
   */
  async addServer(name: string, config: Partial<ServerConfig>): Promise<ServerConfig> {
    const newServer = await this.configManager.addServer(name, config);
    logger.info(`Server added: [${name}]`);

    // Publish server added event
    eventBus.publish(EventTypes.SERVER_ADDED, { name, config: newServer });

    return newServer;
  }

  /**
   * Adds a new instance to an existing server and optionally connects to it.
   *
   * This method creates a new instance for the specified server, and if the server is enabled,
   * automatically attempts to connect to the new instance. It publishes a SERVER_INSTANCE_ADDED
   * event to notify other system components and returns the complete instance configuration.
   *
   * @param {string} name - Name of the existing server to add an instance to
   * @param {Partial<ServerInstanceConfig>} instance - Partial instance configuration to merge with defaults
   * @returns {Promise<ServerInstanceConfig>} Complete instance configuration after creation
   * @throws {Error} If the server doesn't exist or connection fails (logged but not thrown)
   *
   * @example
   * ```typescript
   * const instance = await hubManager.addServerInstance('my-server', {
   *   cwd: '/path/to/working/directory'
   * });
   * console.log('Server instance added successfully');
   * ```
   */
  async addServerInstance(
    name: string,
    instance: Partial<ServerInstanceConfig>
  ): Promise<ServerInstanceConfig> {
    const newInstance = await this.configManager.addServerInstance(name, instance);
    logger.info(`Server instance added for server: [${name}]`);

    // If server config is enabled, attempt to connect
    const server = this.getServerByName(name);
    if (server && server.enabled !== false) {
      try {
        await mcpConnectionManager.connect({ ...server, ...newInstance });
      } catch (error) {
        logger.error(`Failed to auto-connect server instance for ${name}:`, error);
      }
    }

    eventBus.publish(EventTypes.SERVER_INSTANCE_ADDED, { name, instance: newInstance });
    return newInstance;
  }

  /**
   * Updates an existing server configuration with new values.
   *
   * This method validates that the server exists before applying updates, logs the operation,
   * and publishes a SERVER_UPDATED event to notify other system components. It returns the
   * updated server configuration or null if the server doesn't exist.
   *
   * @param {string} name - Name of the server to update
   * @param {Partial<ServerConfig>} updates - Partial configuration updates to apply
   * @returns {Promise<ServerConfig | null>} Updated server configuration or null if not found
   *
   * @example
   * ```typescript
   * const updated = await hubManager.updateServer('my-server', {
   *   enabled: false
   * });
   * if (updated) {
   *   console.log('Server updated successfully');
   * }
   * ```
   */
  async updateServer(name: string, updates: Partial<ServerConfig>): Promise<ServerConfig | null> {
    const existing = this.getServerByName(name);
    if (!existing) {
      logger.warn(`Attempted to update non-existent server: ${name}`);
      return null;
    }

    await this.configManager.updateServer(name, updates);
    logger.info(`Server updated: ${name}`);

    const updatedServer = this.getServerByName(name) || null;
    if (updatedServer) {
      eventBus.publish(EventTypes.SERVER_UPDATED, { name, config: updatedServer });
    }

    return updatedServer;
  }

  /**
   * Updates a specific server instance at the given index.
   *
   * This method applies updates to the server instance at the specified index within the
   * server's instance array, logs the operation, and publishes a SERVER_INSTANCE_UPDATED
   * event to notify other system components.
   *
   * @param {string} name - Name of the server containing the instance to update
   * @param {number} index - Index of the instance within the server's instance array
   * @param {Partial<ServerInstanceConfig>} updates - Partial instance configuration updates to apply
   * @returns {Promise<void>} Resolves when the update is complete
   * @throws {Error} If the server or instance index doesn't exist
   *
   * @example
   * ```typescript
   * await hubManager.updateServerInstance('my-server', 0, {
   *   cwd: '/new/working/directory'
   * });
   * console.log('Server instance updated successfully');
   * ```
   */
  async updateServerInstance(
    name: string,
    index: number,
    updates: Partial<ServerInstanceConfig>
  ): Promise<void> {
    await this.configManager.updateServerInstance(name, index, updates);
    logger.info(`Server instance updated for server: [${name}] at index: ${index}`);

    eventBus.publish(EventTypes.SERVER_INSTANCE_UPDATED, { name, index, updates });
  }

  /**
   * Removes a server and all its instances from the system.
   *
   * This method performs a graceful shutdown by first disconnecting all instances of the server,
   * then removing the server configuration from the system. It publishes a SERVER_DELETED event
   * to notify other system components and returns true if the server existed and was removed.
   *
   * @param {string} name - Name of the server to remove
   * @returns {Promise<boolean>} True if server existed and was removed, false if not found
   *
   * @example
   * ```typescript
   * const removed = await hubManager.removeServer('my-server');
   * if (removed) {
   *   console.log('Server removed successfully');
   * }
   * ```
   */
  async removeServer(name: string): Promise<boolean> {
    const existing = this.getServerByName(name);
    if (!existing) {
      return false;
    }

    // Disconnect all instances of this server
    const instances = this.getServerInstanceByName(name);
    for (const instance of instances) {
      await mcpConnectionManager.disconnect(instance.id!).catch(() => {});
    }

    await this.configManager.removeServer(name);
    logger.info(`Server removed: ${name}`);

    eventBus.publish(EventTypes.SERVER_DELETED, name);

    return true;
  }

  /**
   * Removes a specific server instance at the given index.
   *
   * This method performs a graceful shutdown by first disconnecting the specified instance,
   * then removing it from the server's instance array. It publishes a SERVER_INSTANCE_DELETED
   * event to notify other system components and logs the operation.
   *
   * @param {string} name - Name of the server containing the instance to remove
   * @param {number} index - Index of the instance within the server's instance array
   * @returns {Promise<void>} Resolves when the instance is removed
   * @throws {Error} If the server doesn't exist or the index is out of bounds
   *
   * @example
   * ```typescript
   * await hubManager.removeServerInstance('my-server', 0);
   * console.log('Server instance removed successfully');
   * ```
   */
  async removeServerInstance(name: string, index: number): Promise<void> {
    const instances = this.getServerInstanceByName(name);
    if (index >= 0 && index < instances.length) {
      const instance = instances[index];
      // Disconnect this instance
      await mcpConnectionManager.disconnect(instance.id!).catch(() => {});
    }

    await this.configManager.removeServerInstance(name, index);
    logger.info(`Server instance removed for server: [${name}] at index: ${index}`);

    eventBus.publish(EventTypes.SERVER_INSTANCE_DELETED, { name, index });
  }
}

export const hubManager = new HubManagerService();
