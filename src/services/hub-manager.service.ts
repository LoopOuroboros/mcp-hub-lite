import {
  ConfigManager,
  configManager,
  ServerConfig,
  ServerInstance,
  ServerTemplate
} from '@config/config-manager.js';
import { resolveInstanceConfig } from '@config/config-migrator.js';
import type {
  ServerRuntimeConfig,
  InstanceSelectionStrategy
} from '@shared-models/server.model.js';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';
import { eventBus, EventTypes } from './event-bus.service.js';

/**
 * Manages MCP server configurations and lifecycle operations through the configuration manager.
 *
 * This service provides a comprehensive interface for CRUD operations on MCP servers,
 * including batch operations for performance optimization, instance management, and
 * event-driven communication with other system components.
 */
export class HubManagerService {
  private configManager: ConfigManager;

  constructor(manager: ConfigManager = configManager) {
    this.configManager = manager;
  }

  /**
   * Adds multiple server configurations in a single batch operation without auto-starting.
   */
  async addServersWithoutAutoStart(
    servers: Array<{ name: string; config: Partial<ServerTemplate> }>
  ): Promise<void> {
    await this.configManager.addServers(servers);
    for (const { name } of servers) {
      const serverConfig = this.getServerByName(name);
      if (serverConfig) {
        eventBus.publish(EventTypes.SERVER_ADDED, { name, config: serverConfig });
      }
    }
  }

  /**
   * Creates server instances for multiple servers without automatically connecting them.
   */
  async addServerInstancesWithoutConnect(serverNames: string[]): Promise<void> {
    for (const name of serverNames) {
      await this.configManager.addServerInstance(name, {});
      const instances = this.getServerInstancesByName(name);
      const lastInstance = instances[instances.length - 1];
      eventBus.publish(EventTypes.SERVER_INSTANCE_ADDED, { name, instance: lastInstance });
    }
  }

  /**
   * Concurrently connects to multiple server instances.
   */
  async connectServerInstances(serverNames: string[]): Promise<void> {
    const connectPromises = serverNames.map(async (name) => {
      const server = this.getServerByName(name);
      if (server) {
        const instances = this.getServerInstancesByName(name);
        for (const instance of instances) {
          if (instance.enabled !== false) {
            const resolvedConfig = this.getResolvedServerConfig(name, instance.id);
            if (resolvedConfig) {
              try {
                await mcpConnectionManager.connect({ ...resolvedConfig, id: instance.id });
              } catch (error) {
                logger.error(
                  `Failed to connect server instance for ${name}:`,
                  error,
                  LOG_MODULES.HUB_MANAGER
                );
              }
            }
          }
        }
      }
    });

    await Promise.all(connectPromises);
  }

  /**
   * Retrieves all configured servers.
   */
  getAllServers(): Array<{ name: string; config: ServerConfig }> {
    return this.configManager.getServers();
  }

  /**
   * Retrieves a server configuration and instance by its unique instance ID.
   */
  getServerById(
    id: string
  ): { name: string; config: ServerConfig; instance: ServerInstance } | undefined {
    const servers = this.configManager.getServers();
    for (const server of servers) {
      const instance = server.config.instances.find((inst) => inst.id === id);
      if (instance) {
        return {
          name: server.name,
          config: server.config,
          instance
        };
      }
    }
    return undefined;
  }

  /**
   * Retrieves a server configuration by name.
   */
  getServerByName(name: string): ServerConfig | undefined {
    return this.configManager.getServerByName(name);
  }

  /**
   * Retrieves all instances for a specific server by name.
   */
  getServerInstancesByName(name: string): ServerInstance[] {
    return this.configManager.getServerInstancesByName(name);
  }

  /**
   * Retrieves all server instances grouped by server name.
   */
  getServerInstances(): Record<string, ServerInstance[]> {
    const servers = this.getAllServers();
    const instances: Record<string, ServerInstance[]> = {};
    for (const server of servers) {
      instances[server.name] = server.config.instances || [];
    }
    return instances;
  }

  /**
   * Gets the resolved server configuration by merging template and instance.
   */
  getResolvedServerConfig(name: string, instanceId?: string): ServerRuntimeConfig | null {
    const serverConfig = this.getServerByName(name);
    if (!serverConfig) {
      return null;
    }
    return resolveInstanceConfig(serverConfig, instanceId);
  }

  /**
   * Adds a new server configuration to the system.
   */
  async addServer(name: string, config: Partial<ServerTemplate>): Promise<ServerConfig> {
    const newServer = await this.configManager.addServer(name, config);
    logger.info(`Server added: [${name}]`, LOG_MODULES.HUB_MANAGER);
    eventBus.publish(EventTypes.SERVER_ADDED, { name, config: newServer });
    return newServer;
  }

  /**
   * Adds a new instance to an existing server.
   */
  async addServerInstance(
    name: string,
    instance: Partial<ServerInstance>
  ): Promise<ServerInstance> {
    const newInstance = await this.configManager.addServerInstance(name, instance);
    logger.info(`Server instance added for server: [${name}]`, LOG_MODULES.HUB_MANAGER);

    const resolvedConfig = this.getResolvedServerConfig(name, newInstance.id);
    if (resolvedConfig && resolvedConfig.enabled !== false) {
      try {
        await mcpConnectionManager.connect({ ...resolvedConfig, id: newInstance.id });
      } catch (error) {
        logger.error(
          `Failed to auto-connect server instance for ${name}:`,
          error,
          LOG_MODULES.HUB_MANAGER
        );
      }
    }

    eventBus.publish(EventTypes.SERVER_INSTANCE_ADDED, { name, instance: newInstance });
    return newInstance;
  }

  /**
   * Updates an existing server template configuration.
   */
  async updateServer(name: string, updates: Partial<ServerTemplate>): Promise<ServerConfig | null> {
    const existing = this.getServerByName(name);
    if (!existing) {
      logger.warn(`Attempted to update non-existent server: ${name}`, LOG_MODULES.HUB_MANAGER);
      return null;
    }

    await this.configManager.updateServer(name, updates);
    logger.info(`Server updated: ${name}`, LOG_MODULES.HUB_MANAGER);

    const updatedServer = this.getServerByName(name) || null;
    if (updatedServer) {
      eventBus.publish(EventTypes.SERVER_UPDATED, { name, config: updatedServer });
    }

    return updatedServer;
  }

  /**
   * Updates a specific server instance.
   */
  async updateServerInstance(
    name: string,
    index: number,
    updates: Partial<ServerInstance>
  ): Promise<void> {
    await this.configManager.updateServerInstance(name, index, updates);
    logger.info(
      `Server instance updated for server: [${name}] at index: ${index}`,
      LOG_MODULES.HUB_MANAGER
    );
    eventBus.publish(EventTypes.SERVER_INSTANCE_UPDATED, { name, index, updates });
  }

  /**
   * Removes a server and all its instances.
   */
  async removeServer(name: string): Promise<boolean> {
    const existing = this.getServerByName(name);
    if (!existing) {
      return false;
    }

    const instances = this.getServerInstancesByName(name);
    for (const instance of instances) {
      await mcpConnectionManager.disconnect(instance.id!).catch(() => {});
    }

    await this.configManager.removeServer(name);
    logger.info(`Server removed: ${name}`, LOG_MODULES.HUB_MANAGER);
    eventBus.publish(EventTypes.SERVER_DELETED, name);
    return true;
  }

  /**
   * Removes a specific server instance.
   */
  async removeServerInstance(name: string, index: number): Promise<void> {
    const instances = this.getServerInstancesByName(name);
    const instance = instances.find((inst) => inst.index === index);
    if (instance) {
      await mcpConnectionManager.disconnect(instance.id!).catch(() => {});
    }

    await this.configManager.removeServerInstance(name, index);
    logger.info(
      `Server instance removed for server: [${name}] at index: ${index}`,
      LOG_MODULES.HUB_MANAGER
    );
    eventBus.publish(EventTypes.SERVER_INSTANCE_DELETED, { name, index });
  }

  /**
   * Reassigns server instance indexes.
   */
  async reassignInstanceIndexes(name: string): Promise<boolean> {
    return this.configManager.reassignInstanceIndexes(name);
  }

  /**
   * Updates the instance selection strategy for a server.
   */
  async updateServerInstanceSelectionStrategy(
    name: string,
    strategy: InstanceSelectionStrategy
  ): Promise<ServerConfig | null> {
    const existing = this.getServerByName(name);
    if (!existing) {
      logger.warn(
        `Attempted to update instance selection strategy for non-existent server: ${name}`,
        LOG_MODULES.HUB_MANAGER
      );
      return null;
    }

    // Update strategy in template instead of server-level configuration
    await this.configManager.updateServer(name, { instanceSelectionStrategy: strategy });
    logger.info(
      `Server instance selection strategy updated: ${name} -> ${strategy}`,
      LOG_MODULES.HUB_MANAGER
    );

    const updatedServer = this.getServerByName(name) || null;
    if (updatedServer) {
      eventBus.publish(EventTypes.SERVER_UPDATED, { name, config: updatedServer });
    }

    return updatedServer;
  }
}

export const hubManager = new HubManagerService();
