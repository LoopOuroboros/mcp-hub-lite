import {
  ConfigManager,
  configManager,
  ServerConfig,
  ServerInstanceConfig
} from '@config/config-manager.js';
import { logger } from '@utils/logger.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';
import { eventBus, EventTypes } from './event-bus.service.js';

export class HubManagerService {
  private configManager: ConfigManager;

  constructor(manager: ConfigManager = configManager) {
    this.configManager = manager;
  }

  /**
   * Batch add server configurations (without auto-start, for optimizing batch operation performance)
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
    // Save configuration (only once)
    await this.configManager['saveConfig'](); // Call private method
  }

  /**
   * Batch create server instances (without auto-connect)
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
   * Concurrently start multiple server instances (using Promise.all for efficiency)
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

  getAllServers(): Array<{ name: string; config: ServerConfig }> {
    return this.configManager.getServers();
  }

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

  getServerByName(name: string): ServerConfig | undefined {
    return this.configManager.getServerByName(name);
  }

  getServerInstances(): Record<string, ServerInstanceConfig[]> {
    return this.configManager.getServerInstances();
  }

  getServerInstanceByName(name: string): ServerInstanceConfig[] {
    return this.configManager.getServerInstanceByName(name);
  }

  async addServer(name: string, config: Partial<ServerConfig>): Promise<ServerConfig> {
    const newServer = await this.configManager.addServer(name, config);
    logger.info(`Server added: [${name}]`);

    // Publish server added event
    eventBus.publish(EventTypes.SERVER_ADDED, { name, config: newServer });

    return newServer;
  }

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

  async updateServerInstance(
    name: string,
    index: number,
    updates: Partial<ServerInstanceConfig>
  ): Promise<void> {
    await this.configManager.updateServerInstance(name, index, updates);
    logger.info(`Server instance updated for server: [${name}] at index: ${index}`);

    eventBus.publish(EventTypes.SERVER_INSTANCE_UPDATED, { name, index, updates });
  }

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
