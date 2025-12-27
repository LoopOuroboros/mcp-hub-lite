import { ConfigManager, configManager } from '../config/config.manager.js';
import { McpServerConfig } from '../config/config.schema.js';
import { logger } from '../utils/logger.js';

export class HubManagerService {
  private configManager: ConfigManager;

  constructor(manager: ConfigManager = configManager) {
    this.configManager = manager;
  }

  getAllServers(): McpServerConfig[] {
    return this.configManager.getServers();
  }

  getServerById(id: string): McpServerConfig | undefined {
    return this.configManager.getServers().find(s => s.id === id);
  }

  addServer(server: McpServerConfig): McpServerConfig {
    this.configManager.addServer(server);
    logger.info(`Server added: ${server.name} (${server.id})`);
    return server;
  }

  updateServer(id: string, updates: Partial<McpServerConfig>): McpServerConfig | null {
    const existing = this.getServerById(id);
    if (!existing) {
      logger.warn(`Attempted to update non-existent server: ${id}`);
      return null;
    }

    this.configManager.updateServer(id, updates);
    logger.info(`Server updated: ${id}`);
    return this.getServerById(id) || null;
  }

  removeServer(id: string): boolean {
    const existing = this.getServerById(id);
    if (!existing) {
      return false;
    }
    
    this.configManager.removeServer(id);
    logger.info(`Server removed: ${id}`);
    return true;
  }
}

export const hubManager = new HubManagerService();
