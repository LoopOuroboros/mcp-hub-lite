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
 * // Get all servers
 * const servers = configManager.getServers();
 *
 * // Add a new server
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
import {
  SystemConfigSchema,
  ServerConfigSchema,
  ServerInstanceConfigSchema
} from './config.schema.js';
import type { ServerConfig, SystemConfig, ServerInstanceConfig } from './config.schema.js';
import { loadConfig } from './config-loader.js';
import { saveConfig } from './config-saver.js';
import { convertHttpToStreamableHttp } from './type-converter.js';
import { logConfigChanges } from './config-change-logger.js';
import {
  addServers,
  addServer,
  addServerInstance,
  updateServer,
  updateServerInstance,
  removeServer,
  removeServerInstance
} from './server-config-manager.js';

// Re-export types for external use
export {
  ServerConfig,
  SystemConfig,
  ServerInstanceConfig,
  SystemConfigSchema,
  ServerConfigSchema,
  ServerInstanceConfigSchema
};

export class ConfigManager {
  private configPath: string;
  private config!: SystemConfig;
  private serverInstances: Record<string, ServerInstanceConfig[]> = {};

  constructor(configPath?: string) {
    this.configPath =
      configPath ||
      process.env.MCP_HUB_CONFIG_PATH ||
      path.join(os.homedir(), '.mcp-hub-lite', 'config', '.mcp-hub.json');
    logger.info(`Using config file: ${this.configPath}`, LOG_MODULES.CONFIG_MANAGER);
    this.config = loadConfig(this.configPath);
    this.initServerInstances();
  }

  private initServerInstances(): void {
    // Init server instances
    if (this.config && this.config.servers && typeof this.config.servers === 'object') {
      Object.keys(this.config.servers).forEach((name) => {
        if (!this.serverInstances[name]) this.serverInstances[name] = [];
      });
    } else if (!this.config) {
      this.config = SystemConfigSchema.parse({});
    }
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
   * Retrieves all configured servers with their configurations.
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
   * Retrieves a server configuration by name.
   *
   * @param name - The name of the server to retrieve
   * @returns The server configuration or undefined if not found
   */
  public getServerByName(name: string): ServerConfig | undefined {
    return this.config.servers?.[name];
  }

  /**
   * Retrieves all server instances grouped by server name.
   *
   * @returns Server instances grouped by server name
   */
  public getServerInstances(): Record<string, ServerInstanceConfig[]> {
    return { ...this.serverInstances };
  }

  /**
   * Retrieves all server instances for a specific server by name.
   *
   * @param name - The name of the server to retrieve instances for
   * @returns Array of server instances, or empty array if none exist
   */
  public getServerInstanceByName(name: string): ServerInstanceConfig[] {
    return this.serverInstances[name] || [];
  }

  /**
   * Retrieves server information by its unique instance ID.
   *
   * @param id - The unique instance ID to search for
   * @returns Complete server information including name, configuration, and instance details
   */
  public getServerById(
    id: string
  ): { name: string; config: ServerConfig; instance: ServerInstanceConfig } | undefined {
    for (const [serverName, instances] of Object.entries(this.serverInstances)) {
      const instance = instances.find((inst) => inst.id === id);
      if (instance) {
        return { name: serverName, config: this.config.servers[serverName], instance };
      }
    }
    return undefined;
  }

  /**
   * Adds multiple server configurations to the system in a single operation.
   *
   * @param servers - Array of server objects containing name and partial configuration
   */
  public async addServers(
    servers: Array<{ name: string; config: Partial<ServerConfig> }>
  ): Promise<void> {
    this.config.servers = addServers(servers, this.config.servers, this.serverInstances);
    this.persistConfig();
  }

  /**
   * Adds a new server configuration to the system.
   *
   * @param name - The unique name for the server
   * @param config - The server configuration
   * @returns The validated and complete server configuration
   */
  public async addServer(name: string, config: Partial<ServerConfig>): Promise<ServerConfig> {
    const validated = addServer(name, config, this.config.servers, this.serverInstances);
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
    instance: Partial<ServerInstanceConfig>
  ): Promise<ServerInstanceConfig> {
    return addServerInstance(name, instance, this.serverInstances);
  }

  /**
   * Updates an existing server configuration with the provided changes.
   *
   * @param name - The name of the server to update
   * @param updates - The partial configuration updates to apply
   */
  public async updateServer(name: string, updates: Partial<ServerConfig>): Promise<void> {
    if (updateServer(name, updates, this.config.servers)) {
      this.persistConfig();
    }
  }

  /**
   * Updates an existing server instance configuration with the provided changes.
   *
   * @param name - The name of the server containing the instance to update
   * @param index - The index of the instance to update in the instances array
   * @param updates - The partial instance configuration updates to apply
   */
  public async updateServerInstance(
    name: string,
    index: number,
    updates: Partial<ServerInstanceConfig>
  ): Promise<void> {
    updateServerInstance(name, index, updates, this.serverInstances);
  }

  /**
   * Removes a server configuration and all its instances from the system.
   *
   * @param name - The name of the server to remove
   * @returns True if the server was removed, false if it didn't exist
   */
  public async removeServer(name: string): Promise<void> {
    if (removeServer(name, this.config.servers, this.serverInstances)) {
      this.persistConfig();
    }
  }

  /**
   * Removes a specific server instance from the system.
   *
   * @param name - The name of the server containing the instance to remove
   * @param index - The index of the instance to remove from the instances array
   */
  public async removeServerInstance(name: string, index: number): Promise<void> {
    removeServerInstance(name, index, this.serverInstances);
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
    this.config = loadConfig(this.configPath);
    this.initServerInstances();
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
