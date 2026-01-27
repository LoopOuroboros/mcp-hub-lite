import { ConfigManager, configManager, McpServerConfig, ServerInstanceConfig } from '../config/config-manager.js';
import { logger } from '../utils/logger.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';
import { eventBus, EventTypes } from './event-bus.service.js';

export class HubManagerService {
  private configManager: ConfigManager;

  constructor(manager: ConfigManager = configManager) {
    this.configManager = manager;
  }

  getAllServers(): Array<{ name: string; config: McpServerConfig }> {
    return this.configManager.getServers();
  }

  getServerById(id: string): { name: string; config: McpServerConfig; instance: ServerInstanceConfig } | undefined {
    // 遍历所有服务器和实例，查找匹配的 id
    const serverInstances = this.configManager.getServerInstances();
    for (const [serverName, instances] of Object.entries(serverInstances)) {
      const instance = instances.find(inst => inst.id === id);
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

  getServerByName(name: string): McpServerConfig | undefined {
    return this.configManager.getServerByName(name);
  }

  getServerInstances(): Record<string, ServerInstanceConfig[]> {
    return this.configManager.getServerInstances();
  }

  getServerInstanceByName(name: string): ServerInstanceConfig[] {
    return this.configManager.getServerInstanceByName(name);
  }

  async addServer(name: string, config: Partial<McpServerConfig>): Promise<McpServerConfig> {
    const newServer = await this.configManager.addServer(name, config);
    logger.info(`Server added: [${name}]`);

    // 发布服务器添加事件
    eventBus.publish(EventTypes.SERVER_ADDED, { name, config: newServer });

    return newServer;
  }

  async addServerInstance(name: string, instance: Partial<ServerInstanceConfig>): Promise<ServerInstanceConfig> {
    const newInstance = await this.configManager.addServerInstance(name, instance);
    logger.info(`Server instance added for server: [${name}]`);

    // 如果服务器配置启用，则尝试连接
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

  async updateServer(name: string, updates: Partial<McpServerConfig>): Promise<McpServerConfig | null> {
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

  async updateServerInstance(name: string, index: number, updates: Partial<ServerInstanceConfig>): Promise<void> {
    await this.configManager.updateServerInstance(name, index, updates);
    logger.info(`Server instance updated for server: [${name}] at index: ${index}`);

    eventBus.publish(EventTypes.SERVER_INSTANCE_UPDATED, { name, index, updates });
  }

  async removeServer(name: string): Promise<boolean> {
    const existing = this.getServerByName(name);
    if (!existing) {
      return false;
    }

    // 断开该服务器所有实例的连接
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
      // 断开该实例的连接
      await mcpConnectionManager.disconnect(instance.id!).catch(() => {});
    }

    await this.configManager.removeServerInstance(name, index);
    logger.info(`Server instance removed for server: [${name}] at index: ${index}`);

    eventBus.publish(EventTypes.SERVER_INSTANCE_DELETED, { name, index });
  }
}

export const hubManager = new HubManagerService();
