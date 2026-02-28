import * as fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '@utils/logger.js';
import {
  SystemConfigSchema,
  ServerConfigSchema,
  ServerInstanceConfigSchema,
  ObservabilityConfigSchema
} from './config.schema.js';
import type {
  ServerConfig,
  SystemConfig,
  ServerInstanceConfig,
  ObservabilityConfig
} from './config.schema.js';

// Re-export types for external use
export {
  ServerConfig,
  SystemConfig,
  ServerInstanceConfig,
  ObservabilityConfig,
  SystemConfigSchema,
  ServerConfigSchema,
  ServerInstanceConfigSchema,
  ObservabilityConfigSchema
};

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
 * The ConfigManager supports multiple configuration sources with the following priority:
 * 1. Environment variable `MCP_HUB_CONFIG_PATH`
 * 2. Current directory `.mcp-hub.json`
 * 3. `config/.mcp-hub.json`
 * 4. `~/.mcp-hub.json`
 *
 * It implements a singleton pattern for production use but creates new instances
 * for testing to ensure test isolation.
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
 *
 * // Update system configuration
 * await configManager.updateConfig({
 *   system: { port: 8080, host: '0.0.0.0' }
 * });
 * ```
 */
export class ConfigManager {
  private configPath: string;
  private config!: SystemConfig;
  private serverInstances: Record<string, ServerInstanceConfig[]> = {};

  constructor(configPath?: string) {
    this.configPath =
      configPath ||
      process.env.MCP_HUB_CONFIG_PATH ||
      path.join(os.homedir(), '.mcp-hub-lite', 'config', '.mcp-hub.json');
    logger.info(`Using config file: ${this.configPath}`, { subModule: 'ConfigManager' });
    this.loadConfig();
  }

  /**
   * Unified type conversion method: convert type: 'http' to type: 'streamable-http'
   * Ensure compatibility across all scenarios (loading, adding, updating)
   */
  private convertHttpToStreamableHttp(config: unknown): unknown {
    if (!config) return config;

    // If it's an array, process each element
    if (Array.isArray(config)) {
      return config.map((item) => this.convertHttpToStreamableHttp(item));
    }

    // If it's an object, create a copy to avoid directly modifying the original object
    if (typeof config === 'object' && config !== null) {
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(config)) {
        if (key === 'type' && value === 'http') {
          result[key] = 'streamable-http';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = this.convertHttpToStreamableHttp(value);
        } else {
          result[key] = value;
        }
      }

      return result;
    }

    // Return primitive types directly
    return config;
  }

  /**
   * Loads configuration from the configured file path.
   *
   * This private method handles the complete configuration loading process:
   * - Checks if the config file exists at the specified path
   * - Reads and parses the JSON configuration
   * - Performs type conversion for compatibility (e.g., 'http' to 'streamable-http')
   * - Validates the configuration using Zod schema
   * - Handles validation failures gracefully by falling back to default configuration
   * - Initializes server instances array for each configured server
   *
   * If the config file doesn't exist or fails to load, a default configuration is used.
   *
   * @private
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        logger.info(`Loading configuration from: ${this.configPath}`, { subModule: 'ConfigManager' });
        const content = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(content);
        // Unified type conversion: convert http to streamable-http
        this.config = this.convertHttpToStreamableHttp(this.config) as SystemConfig;
        // Ensure defaults without validation errors blocking
        try {
          // Use safeParse to validate configuration
          const parsed = SystemConfigSchema.safeParse(this.config);
          if (parsed.success) {
            // Ensure server configurations are sorted by name
            const configWithSortedServers = {
              ...parsed.data,
              servers: Object.fromEntries(
                Object.entries(parsed.data.servers).sort(([a], [b]) => a.localeCompare(b))
              )
            };
            this.config = configWithSortedServers;
          } else {
            // On validation failure, log error and use default configuration
            logger.error(`Config validation failed: ${parsed.error}`);
            this.config = SystemConfigSchema.parse({});
          }
        } catch (e) {
          logger.error(`Failed to parse config: ${e}`);
          // On parsing failure, use default configuration
          this.config = SystemConfigSchema.parse({});
        }
      } else {
        // When config file doesn't exist, create default config in memory only, don't auto-save to file
        // Prevent npm build or npm test operations from automatically creating config files
        this.config = SystemConfigSchema.parse({});
      }
    } catch (error) {
      logger.error(`Failed to load config: ${error}`);
      // On config file load failure, use default configuration
      this.config = SystemConfigSchema.parse({});
    }

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
   * Saves the current configuration to disk.
   *
   * This private method writes the current configuration to the configured file path,
   * creating the directory structure if it doesn't exist. Errors during the save
   * operation are silently ignored to prevent crashes during normal operation.
   *
   * @private
   */
  // The ONE function logic - direct write
  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch {
      // Ignore
    }
  }

  /**
   * Retrieves the current system configuration.
   *
   * Returns a deep copy of the current configuration to prevent external modification
   * of the internal configuration state.
   *
   * @returns {SystemConfig} A deep copy of the current system configuration
   *
   * @example
   * ```typescript
   * const config = configManager.getConfig();
   * console.log(`Server running on ${config.system.host}:${config.system.port}`);
   * ```
   */
  public getConfig(): SystemConfig {
    return { ...this.config };
  }

  /**
   * Retrieves all configured servers with their configurations.
   *
   * Returns an array of server objects containing the server name and configuration.
   * Optionally sorts the servers by name in alphabetical order.
   *
   * @param {boolean} sortByName - Whether to sort servers by name (default: false)
   * @returns {Array<{ name: string; config: ServerConfig }>} Array of server objects with name and config
   *
   * @example
   * ```typescript
   * // Get all servers unsorted
   * const servers = configManager.getServers();
   *
   * // Get all servers sorted by name
   * const sortedServers = configManager.getServers(true);
   * ```
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
   * Returns the server configuration if it exists, or undefined if no server
   * with the given name is configured.
   *
   * @param {string} name - The name of the server to retrieve
   * @returns {ServerConfig | undefined} The server configuration or undefined if not found
   *
   * @example
   * ```typescript
   * const server = configManager.getServerByName('my-mcp-server');
   * if (server) {
   *   console.log(`Server type: ${server.type}`);
   * }
   * ```
   */
  public getServerByName(name: string): ServerConfig | undefined {
    return this.config.servers?.[name];
  }

  /**
   * Retrieves all server instances grouped by server name.
   *
   * Returns a record where keys are server names and values are arrays of server instances
   * for that server. Each server can have multiple instances running simultaneously.
   *
   * @returns {Record<string, ServerInstanceConfig[]>} Server instances grouped by server name
   *
   * @example
   * ```typescript
   * const instances = configManager.getServerInstances();
   * const myServerInstances = instances['my-mcp-server'] || [];
   * console.log(`Running ${myServerInstances.length} instances of my-mcp-server`);
   * ```
   */
  public getServerInstances(): Record<string, ServerInstanceConfig[]> {
    return { ...this.serverInstances };
  }

  /**
   * Retrieves all server instances for a specific server by name.
   *
   * Returns an array of server instances for the given server name. If no instances
   * exist for the server, returns an empty array.
   *
   * @param {string} name - The name of the server to retrieve instances for
   * @returns {ServerInstanceConfig[]} Array of server instances, or empty array if none exist
   *
   * @example
   * ```typescript
   * const instances = configManager.getServerInstanceByName('my-mcp-server');
   * console.log(`Found ${instances.length} instances`);
   * ```
   */
  public getServerInstanceByName(name: string): ServerInstanceConfig[] {
    return this.serverInstances[name] || [];
  }

  /**
   * Retrieves server information by its unique instance ID.
   *
   * This method searches through all configured servers and their instances to find
   * a server instance that matches the provided ID. It returns complete information
   * including the server name, configuration, and instance details.
   *
   * The method iterates through all server instances across all configured servers,
   * making it useful for scenarios where you have an instance ID but need to determine
   * which server it belongs to and retrieve its full configuration.
   *
   * @param {string} id - The unique instance ID to search for
   * @returns {{ name: string; config: ServerConfig; instance: ServerInstanceConfig } | undefined}
   *          Complete server information including name, configuration, and instance details,
   *          or undefined if no matching instance is found
   *
   * @example
   * ```typescript
   * const serverInfo = configManager.getServerById('my-server-12345-abcde');
   * if (serverInfo) {
   *   console.log(`Found server: ${serverInfo.name}`);
   *   console.log(`Instance ID: ${serverInfo.instance.id}`);
   * }
   * ```
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
   * This method validates and adds an array of server configurations, performing type conversion
   * for compatibility (e.g., 'http' to 'streamable-http'), validating each configuration using
   * Zod schema validation, and persisting all changes to disk. Server names must be unique,
   * and existing servers with the same name will be overwritten.
   *
   * The method ensures that server configurations are sorted alphabetically by name after
   * the addition is complete.
   *
   * @param {Array<{ name: string; config: Partial<ServerConfig> }>} servers - Array of server objects containing name and partial configuration
   * @returns {Promise<void>} Resolves when all servers have been added and configuration is persisted
   * @throws {ZodError} If any server configuration fails validation
   *
   * @example
   * ```typescript
   * try {
   *   await configManager.addServers([
   *     {
   *       name: 'file-server',
   *       config: { type: 'stdio', command: 'npx file-mcp-server', enabled: true }
   *     },
   *     {
   *       name: 'git-server',
   *       config: { type: 'stdio', command: 'npx git-mcp-server', enabled: true }
   *     }
   *   ]);
   *   console.log('Multiple servers added successfully');
   * } catch (error) {
   *   console.error('Failed to add servers:', error);
   * }
   * ```
   */
  public async addServers(
    servers: Array<{ name: string; config: Partial<ServerConfig> }>
  ): Promise<void> {
    for (const { name, config } of servers) {
      // Unified type conversion: convert http to streamable-http
      const convertedConfig = this.convertHttpToStreamableHttp(config) as Partial<ServerConfig>;
      this.config.servers[name] = ServerConfigSchema.parse(convertedConfig);
      if (!this.serverInstances[name]) this.serverInstances[name] = [];
    }
    // Ensure server configurations are sorted by name
    this.config.servers = Object.fromEntries(
      Object.entries(this.config.servers).sort(([a], [b]) => a.localeCompare(b))
    );
    this.saveConfig();
  }

  /**
   * Adds a new server configuration to the system.
   *
   * This method validates the provided server configuration using Zod schema validation,
   * performs type conversion (e.g., 'http' to 'streamable-http' for compatibility),
   * persists the configuration to disk, and initializes server instances array.
   *
   * The server name must be unique. If a server with the same name already exists,
   * it will be overwritten.
   *
   * @param {string} name - The unique name for the server
   * @param {Partial<ServerConfig>} config - The server configuration (partial, will be validated and completed with defaults)
   * @returns {Promise<ServerConfig>} The validated and complete server configuration
   * @throws {ZodError} If the configuration fails validation
   *
   * @example
   * ```typescript
   * try {
   *   const serverConfig = await configManager.addServer('my-mcp-server', {
   *     type: 'stdio',
   *     command: 'npx my-mcp-server',
   *     enabled: true,
   *     timeout: 30000
   *   });
   *   console.log(`Server added successfully: ${serverConfig.type}`);
   * } catch (error) {
   *   console.error('Failed to add server:', error);
   * }
   * ```
   */
  public async addServer(name: string, config: Partial<ServerConfig>): Promise<ServerConfig> {
    // Unified type conversion: convert http to streamable-http
    const convertedConfig = this.convertHttpToStreamableHttp(config);
    const validated = ServerConfigSchema.parse(convertedConfig);
    this.config.servers[name] = validated;
    if (!this.serverInstances[name]) this.serverInstances[name] = [];
    // Ensure server configurations are sorted by name
    this.config.servers = Object.fromEntries(
      Object.entries(this.config.servers).sort(([a], [b]) => a.localeCompare(b))
    );
    this.saveConfig();
    return validated;
  }

  /**
   * Adds a new server instance for the specified server.
   *
   * This method creates a new server instance with a unique ID and timestamp,
   * validates the configuration using Zod schema validation, and adds it to
   * the server instances array for the given server name.
   *
   * If no instance ID is provided, one will be automatically generated using
   * the format: `{serverName}-{timestamp}-{randomString}`.
   *
   * @param {string} name - The name of the server to add an instance for
   * @param {Partial<ServerInstanceConfig>} instance - The server instance configuration (partial, will be validated)
   * @returns {Promise<ServerInstanceConfig>} The validated and complete server instance configuration
   * @throws {ZodError} If the instance configuration fails validation
   *
   * @example
   * ```typescript
   * try {
   *   const instance = await configManager.addServerInstance('my-mcp-server', {
   *     cwd: '/path/to/project',
   *     env: { NODE_ENV: 'production' }
   *   });
   *   console.log(`Instance created with ID: ${instance.id}`);
   * } catch (error) {
   *   console.error('Failed to add server instance:', error);
   * }
   * ```
   */
  public async addServerInstance(
    name: string,
    instance: Partial<ServerInstanceConfig>
  ): Promise<ServerInstanceConfig> {
    if (!this.serverInstances[name]) this.serverInstances[name] = [];

    // Minimal identity generation logic inlined
    if (!instance.id) {
      const ts = Date.now();
      instance.id = `${name}-${ts}-${Math.random().toString(36).substr(2, 5)}`;
      instance.timestamp = ts;
      instance.hash = Math.random().toString(36);
    }

    const validated = ServerInstanceConfigSchema.parse(instance);
    this.serverInstances[name].push(validated);
    return validated;
  }

  /**
   * Updates an existing server configuration with the provided changes.
   *
   * This method performs a partial update of the server configuration, merging the
   * provided updates with the existing configuration. It includes type conversion
   * for compatibility (e.g., 'http' to 'streamable-http') and automatically
   * persists the changes to disk.
   *
   * If the server with the given name does not exist, this method does nothing.
   *
   * @param {string} name - The name of the server to update
   * @param {Partial<ServerConfig>} updates - The partial configuration updates to apply
   * @returns {Promise<void>} Resolves when the update is complete
   *
   * @example
   * ```typescript
   * await configManager.updateServer('my-mcp-server', {
   *   enabled: false,
   *   timeout: 60000
   * });
   * console.log('Server configuration updated');
   * ```
   */
  public async updateServer(name: string, updates: Partial<ServerConfig>): Promise<void> {
    if (this.config.servers[name]) {
      // Unified type conversion: convert http to streamable-http
      const convertedUpdates = this.convertHttpToStreamableHttp(updates) as Partial<ServerConfig>;
      this.config.servers[name] = { ...this.config.servers[name], ...convertedUpdates };
      // Ensure server configurations are sorted by name
      this.config.servers = Object.fromEntries(
        Object.entries(this.config.servers).sort(([a], [b]) => a.localeCompare(b))
      );
      this.saveConfig();
    }
  }

  /**
   * Updates an existing server instance configuration with the provided changes.
   *
   * This method performs a partial update of the server instance configuration at the
   * specified index, merging the provided updates with the existing configuration.
   *
   * If the server or instance at the given index does not exist, this method does nothing.
   *
   * @param {string} name - The name of the server containing the instance to update
   * @param {number} index - The index of the instance to update in the instances array
   * @param {Partial<ServerInstanceConfig>} updates - The partial configuration updates to apply
   * @returns {Promise<void>} Resolves when the update is complete
   *
   * @example
   * ```typescript
   * await configManager.updateServerInstance('my-mcp-server', 0, {
   *   cwd: '/new/project/path',
   *   env: { NODE_ENV: 'development' }
   * });
   * console.log('Server instance updated');
   * ```
   */
  public async updateServerInstance(
    name: string,
    index: number,
    updates: Partial<ServerInstanceConfig>
  ): Promise<void> {
    if (this.serverInstances[name]?.[index]) {
      this.serverInstances[name][index] = { ...this.serverInstances[name][index], ...updates };
    }
  }

  /**
   * Removes a server configuration and all its instances from the system.
   *
   * This method deletes both the server configuration and all associated server instances
   * from memory and persists the changes to disk. If the server does not exist,
   * this method does nothing.
   *
   * @param {string} name - The name of the server to remove
   * @returns {Promise<void>} Resolves when the removal is complete
   *
   * @example
   * ```typescript
   * await configManager.removeServer('my-mcp-server');
   * console.log('Server removed successfully');
   * ```
   */
  public async removeServer(name: string): Promise<void> {
    if (this.config.servers[name]) {
      delete this.config.servers[name];
      delete this.serverInstances[name];
      // Ensure server configurations are sorted by name
      this.config.servers = Object.fromEntries(
        Object.entries(this.config.servers).sort(([a], [b]) => a.localeCompare(b))
      );
      this.saveConfig();
    }
  }

  /**
   * Removes a specific server instance from the system.
   *
   * This method removes the server instance at the specified index from the instances array.
   * If the instances array becomes empty after removal, the entire server instance entry
   * is deleted from the server instances record.
   *
   * If the server or instance at the given index does not exist, this method does nothing.
   *
   * @param {string} name - The name of the server containing the instance to remove
   * @param {number} index - The index of the instance to remove from the instances array
   * @returns {Promise<void>} Resolves when the removal is complete
   *
   * @example
   * ```typescript
   * await configManager.removeServerInstance('my-mcp-server', 0);
   * console.log('Server instance removed');
   * ```
   */
  public async removeServerInstance(name: string, index: number): Promise<void> {
    if (this.serverInstances[name]) {
      this.serverInstances[name].splice(index, 1);
      if (this.serverInstances[name].length === 0) delete this.serverInstances[name];
    }
  }

  /**
   * Updates the entire system configuration with the provided partial configuration.
   *
   * This method performs a deep merge of the provided partial configuration with the
   * existing system configuration, validates the result using Zod schema validation,
   * logs all configuration changes for audit purposes, and persists the updated
   * configuration to disk.
   *
   * The method includes comprehensive change logging that tracks all modifications
   * at the field level, making it easy to understand what configuration values
   * have changed during the update operation.
   *
   * @param {Partial<SystemConfig>} newConfig - Partial system configuration containing updates
   * @returns {Promise<void>} Resolves when the configuration has been updated and persisted
   * @throws {ZodError} If the merged configuration fails validation
   *
   * @example
   * ```typescript
   * try {
   *   await configManager.updateConfig({
   *     system: { port: 8080, host: '0.0.0.0' },
   *     security: { sessionTimeout: 3600000 }
   *   });
   *   console.log('System configuration updated successfully');
   * } catch (error) {
   *   console.error('Failed to update configuration:', error);
   * }
   * ```
   */
  public async updateConfig(newConfig: Partial<SystemConfig>): Promise<void> {
    const oldConfig = JSON.parse(JSON.stringify(this.config));
    // Unified type conversion: convert http to streamable-http
    const convertedConfig = this.convertHttpToStreamableHttp(newConfig) as Partial<SystemConfig>;
    this.config = SystemConfigSchema.parse({ ...this.config, ...convertedConfig });
    this.logConfigChanges(oldConfig, this.config);
    this.saveConfig();
  }

  private logConfigChanges(oldConfig: SystemConfig, newConfig: SystemConfig): void {
    const changes: string[] = [];

    const compare = (obj1: unknown, obj2: unknown, path: string) => {
      const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

      for (const key of allKeys) {
        const currentPath = path ? `${path}.${key}` : key;
        const val1 =
          obj1 && typeof obj1 === 'object' ? (obj1 as Record<string, unknown>)[key] : undefined;
        const val2 =
          obj2 && typeof obj2 === 'object' ? (obj2 as Record<string, unknown>)[key] : undefined;

        if (JSON.stringify(val1) === JSON.stringify(val2)) continue;

        if (
          typeof val1 === 'object' &&
          val1 !== null &&
          typeof val2 === 'object' &&
          val2 !== null &&
          !Array.isArray(val1) &&
          !Array.isArray(val2)
        ) {
          compare(val1, val2, currentPath);
        } else {
          const formatVal = (v: unknown) => (v === undefined ? 'undefined' : JSON.stringify(v));
          changes.push(`${currentPath} = ${formatVal(val1)} -> ${formatVal(val2)}`);
        }
      }
    };

    compare(oldConfig, newConfig, '');

    if (changes.length > 0) {
      logger.info(`${changes.join('\n')}`, { subModule: 'System Config Changes' });
    }
  }

  /**
   * Synchronizes the in-memory configuration with the on-disk configuration file.
   *
   * This method reloads the configuration from the configured file path, effectively
   * discarding any in-memory changes and reverting to the persisted state. It is
   * useful for scenarios where external processes may have modified the configuration
   * file and those changes need to be reflected in the running application.
   *
   * The method calls the private `loadConfig()` method which handles the complete
   * configuration loading and validation process.
   *
   * @returns {Promise<void>} Resolves when the configuration has been successfully synchronized
   *
   * @example
   * ```typescript
   * // External process modified the config file, sync to get latest changes
   * await configManager.syncConfig();
   * console.log('Configuration synchronized with disk');
   * ```
   */
  public async syncConfig(): Promise<void> {
    this.loadConfig();
  }
}

// Lazy initialization of configManager to avoid creating instance during module import
// In test environment, always create a new instance to prevent test pollution
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

// Export the getter function directly - users should call getConfigManager() instead of using a global instance
// This ensures proper initialization and avoids test pollution
export const configManager = getConfigManager();
