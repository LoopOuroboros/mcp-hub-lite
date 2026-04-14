/**
 * Configuration Manager for MCP Hub Lite system.
 *
 * This class provides comprehensive configuration management capabilities including:
 * - Loading and parsing configuration from JSON files
 * - Runtime configuration updates with validation
 * - Server and server instance lifecycle management
 * - Automatic configuration persistence to disk
 * - Type conversion and compatibility handling (e.g., 'http' to 'streamable-http')
 * - Configuration change logging and tracking
 *
 * This is a thin wrapper around modular utilities for better maintainability.
 *
 * @example
 * ```typescript
 * // Get the config manager instance
 * const configManager = getConfigManager();
 *
 * // Get all servers (v1.1 format)
 * const servers = configManager.getServers();
 *
 * // Add a new server with template and default instance
 * await configManager.addServer('my-server', {
 *   type: 'stdio',
 *   command: 'npx my-mcp-server',
 *   enabled: true
 * });
 * ```
 */

import path from 'path';
import os from 'os';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { SystemConfigSchema, ServerInstanceSchema, ServerConfigSchema } from './config.schema.js';
import type {
  SystemConfig,
  ServerTemplate,
  ServerInstance,
  ServerConfig
} from './config.schema.js';
import { loadConfig } from './config-loader.js';
import { saveConfig } from './config-saver.js';
import { logConfigChanges } from './config-change-logger.js';
import { convertHttpToStreamableHttp } from './type-converter.js';
import {
  addServers,
  addServer,
  addServerInstance,
  updateServerTemplate,
  updateServerInstance,
  removeServer,
  removeServerInstance,
  reassignServerInstanceIndexes
} from './server-config-manager.js';

// Re-export types for external use
export {
  ServerConfig,
  SystemConfig,
  ServerInstance,
  ServerTemplate,
  SystemConfigSchema,
  ServerConfigSchema,
  ServerInstanceSchema
};

export class ConfigManager {
  private configPath: string;
  private config!: SystemConfig;

  constructor(configPath?: string) {
    this.configPath =
      configPath ||
      process.env.MCP_HUB_CONFIG_PATH ||
      path.join(os.homedir(), '.mcp-hub-lite', 'config', '.mcp-hub.json');
    logger.debug(`Using config file: ${this.configPath}`, LOG_MODULES.CONFIG_MANAGER);
    this.config = loadConfig(this.configPath, true);
  }

  /**
   * Retrieves the current system configuration.
   *
   * @returns A deep copy of the current system configuration
   */
  public getConfig(): SystemConfig {
    return { ...this.config };
  }

  /**
   * Retrieves all configured servers with their configurations (v1.1 format).
   *
   * @param sortByName - Whether to sort servers by name
   * @returns Array of server objects with name and config
   */
  public getServers(sortByName: boolean = false): Array<{ name: string; config: ServerConfig }> {
    let servers = Object.entries(this.config.servers || {}).map(([name, config]) => ({
      name,
      config
    }));
    if (sortByName) {
      servers = [...servers].sort((a, b) => a.name.localeCompare(b.name));
    }
    return servers;
  }

  /**
   * Retrieves a server configuration by name (v1.1 format).
   *
   * @param name - The name of the server to retrieve
   * @returns The server configuration (v1.1) or undefined if not found
   */
  public getServerByName(name: string): ServerConfig | undefined {
    return this.config.servers?.[name];
  }

  /**
   * Retrieves all server instances for a specific server by name.
   *
   * @param name - The name of the server to retrieve instances for
   * @returns Array of server instances, or empty array if none exist
   */
  public getServerInstancesByName(name: string): ServerInstance[] {
    return this.config.servers?.[name]?.instances || [];
  }

  /**
   * Retrieves a specific server instance by index.
   *
   * @param name - The name of the server
   * @param index - The index of the instance
   * @returns The server instance or undefined if not found
   */
  public getServerInstanceByIndex(name: string, index: number): ServerInstance | undefined {
    const instances = this.getServerInstancesByName(name);
    return instances[index];
  }

  /**
   * Adds multiple server configurations to the system in a single operation.
   *
   * @param servers - Array of server objects containing name and partial template configuration
   */
  public async addServers(
    servers: Array<{ name: string; config: Partial<ServerTemplate> }>
  ): Promise<void> {
    this.config.servers = addServers(servers, this.config.servers);
    this.persistConfig();
  }

  /**
   * Adds a new server configuration to the system (v1.1 format).
   * Creates a template and a default instance.
   *
   * @param name - The unique name for the server
   * @param config - The server template configuration
   * @returns The complete server configuration (v1.1)
   */
  public async addServer(name: string, config: Partial<ServerTemplate>): Promise<ServerConfig> {
    const validated = addServer(name, config, this.config.servers);
    this.persistConfig();
    return validated;
  }

  /**
   * Adds a new server instance for the specified server.
   *
   * @param name - The name of the server to add an instance for
   * @param instance - The server instance configuration
   * @returns The validated and complete server instance configuration
   */
  public async addServerInstance(
    name: string,
    instance: Partial<ServerInstance>
  ): Promise<ServerInstance> {
    const newInstance = addServerInstance(name, instance, this.config.servers);
    this.persistConfig();
    return newInstance;
  }

  /**
   * Updates an existing server template configuration.
   *
   * @param name - The name of the server to update
   * @param updates - The partial template updates to apply
   * @returns The updated server configuration or null if not found
   */
  public async updateServer(
    name: string,
    updates: Partial<ServerTemplate>
  ): Promise<ServerConfig | null> {
    if (updateServerTemplate(name, updates, this.config.servers)) {
      this.persistConfig();
      return this.config.servers[name] || null;
    }
    return null;
  }

  /**
   * Updates an existing server configuration.
   *
   * @param name - The name of the server to update
   * @param updates - The partial server template updates to apply
   * @returns The updated server configuration or null if not found
   */
  public async updateServerConfig(
    name: string,
    updates: Partial<ServerTemplate>
  ): Promise<ServerConfig | null> {
    if (updateServerTemplate(name, updates, this.config.servers)) {
      this.persistConfig();
      return this.config.servers[name] || null;
    }
    return null;
  }

  /**
   * Updates an existing server instance configuration.
   *
   * @param name - The name of the server containing the instance to update
   * @param index - The index of the instance to update
   * @param updates - The partial instance updates to apply
   * @returns True if the instance was updated
   */
  public async updateServerInstance(
    name: string,
    index: number,
    updates: Partial<ServerInstance>
  ): Promise<boolean> {
    const result = updateServerInstance(name, index, updates, this.config.servers);
    if (result) {
      this.persistConfig();
    }
    return result;
  }

  /**
   * Removes a server configuration and all its instances from the system.
   *
   * @param name - The name of the server to remove
   * @returns True if the server was removed
   */
  public async removeServer(name: string): Promise<boolean> {
    if (removeServer(name, this.config.servers)) {
      this.persistConfig();
      return true;
    }
    return false;
  }

  /**
   * Removes a specific server instance from the system.
   *
   * @param name - The name of the server containing the instance to remove
   * @param index - The index of the instance to remove
   * @returns True if the instance was removed
   */
  public async removeServerInstance(name: string, index: number): Promise<boolean> {
    if (removeServerInstance(name, index, this.config.servers)) {
      this.persistConfig();
      return true;
    }
    return false;
  }

  /**
   * Reassigns server instance indexes to be consecutive (0, 1, 2, ...).
   *
   * @param name - The name of the server to reassign indexes for
   * @returns True if the server exists and indexes were reassigned
   */
  public async reassignInstanceIndexes(name: string): Promise<boolean> {
    if (reassignServerInstanceIndexes(name, this.config.servers)) {
      this.persistConfig();
      return true;
    }
    return false;
  }

  /**
   * Updates the entire system configuration with the provided partial configuration.
   *
   * @param newConfig - Partial system configuration containing updates
   */
  public async updateConfig(newConfig: Partial<SystemConfig>): Promise<void> {
    const oldConfig = JSON.parse(JSON.stringify(this.config));
    const convertedConfig = convertHttpToStreamableHttp(newConfig) as Partial<SystemConfig>;
    this.config = SystemConfigSchema.parse({ ...this.config, ...convertedConfig });
    logConfigChanges(oldConfig, this.config);
    this.persistConfig();
  }

  private persistConfig(): void {
    saveConfig(this.configPath, this.config);
  }

  /**
   * Synchronizes the in-memory configuration with the on-disk configuration file.
   */
  public async syncConfig(): Promise<void> {
    this.config = loadConfig(this.configPath, true);
  }
}

// Lazy initialization of configManager to avoid creating instance during module import
let _configManager: ConfigManager | null = null;

/**
 * Get the config manager instance
 * In test environment, always creates a new instance to prevent test pollution
 */
export function getConfigManager(): ConfigManager {
  // In test environment, always create a new instance to ensure test isolation
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    const testConfigPath =
      process.env.MCP_HUB_CONFIG_PATH ||
      path.join(os.tmpdir(), `mcp-hub-test-fallback-${Date.now()}`, '.mcp-hub.json');
    return new ConfigManager(testConfigPath);
  }

  // In production, use singleton pattern
  if (!_configManager) {
    _configManager = new ConfigManager();
  }
  return _configManager;
}

// Export the getter function directly
export const configManager = getConfigManager();
