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

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        logger.info(`Loading configuration from: ${this.configPath}`);
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

  public getConfig(): SystemConfig {
    return { ...this.config };
  }

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

  public getServerByName(name: string): ServerConfig | undefined {
    return this.config.servers?.[name];
  }

  public getServerInstances(): Record<string, ServerInstanceConfig[]> {
    return { ...this.serverInstances };
  }

  public getServerInstanceByName(name: string): ServerInstanceConfig[] {
    return this.serverInstances[name] || [];
  }

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

  public async updateServerInstance(
    name: string,
    index: number,
    updates: Partial<ServerInstanceConfig>
  ): Promise<void> {
    if (this.serverInstances[name]?.[index]) {
      this.serverInstances[name][index] = { ...this.serverInstances[name][index], ...updates };
    }
  }

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

  public async removeServerInstance(name: string, index: number): Promise<void> {
    if (this.serverInstances[name]) {
      this.serverInstances[name].splice(index, 1);
      if (this.serverInstances[name].length === 0) delete this.serverInstances[name];
    }
  }

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
