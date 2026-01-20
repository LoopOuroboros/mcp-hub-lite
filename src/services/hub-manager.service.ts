import { ConfigManager, configManager, McpServerConfig } from '../config/config-manager.js';
import { logger } from '../utils/logger.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';

export class HubManagerService {
  private configManager: ConfigManager;

  constructor(manager: ConfigManager = configManager) {
    this.configManager = manager;
  }

  getAllServers(): McpServerConfig[] {
    return this.configManager.getServers();
  }

  getServerById(id: string): McpServerConfig | undefined {
    return this.configManager.getServers().find((s: any) => s.id === id);
  }

  async addServer(server: Partial<McpServerConfig> & Omit<McpServerConfig, 'id'>): Promise<McpServerConfig> {
    const newServer = await this.configManager.addServer(server as McpServerConfig);
    logger.info(`Server added: [${newServer.id}]`);
    
    // Auto-connect if enabled
    if (newServer.enabled !== false) {
      try {
        await mcpConnectionManager.connect(newServer);
      } catch (error) {
        logger.error(`Failed to auto-connect server ${newServer.id}:`, error);
      }
    }
    
    return newServer;
  }

  async updateServer(id: string, updates: Partial<McpServerConfig>): Promise<McpServerConfig | null> {
    const existing = this.getServerById(id);
    if (!existing) {
      logger.warn(`Attempted to update non-existent server: ${id}`);
      return null;
    }

    await this.configManager.updateServer(id, updates);
    logger.info(`Server updated: ${id}`);
    return this.getServerById(id) || null;
  }

  async removeServer(id: string): Promise<boolean> {
    const existing = this.getServerById(id);
    if (!existing) {
      return false;
    }

    await this.configManager.removeServer(id);
    logger.info(`Server removed: ${id}`);
    return true;
  }
}

export const hubManager = new HubManagerService();
