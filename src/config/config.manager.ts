import fs from 'node:fs';
import path from 'node:path';
import { GlobalConfigSchema, type GlobalConfig } from './config.schema.js';
import { logger } from '../utils/logger.js';

export class ConfigManager {
  private configPath: string;
  private config: GlobalConfig;

  constructor(configPath?: string) {
    this.configPath = configPath || process.env.MCP_HUB_CONFIG_PATH || path.join(process.cwd(), 'mcp-hub-config.json');
    this.config = this.loadConfig();
    this.applyEnvironmentVariables();
  }

  private loadConfig(): GlobalConfig {
    if (!fs.existsSync(this.configPath)) {
      logger.info(`Config file not found at ${this.configPath}, creating default.`);
      const defaultConfig: GlobalConfig = GlobalConfigSchema.parse({});
      this.saveConfig(defaultConfig);
      return defaultConfig;
    }

    try {
      const fileContent = fs.readFileSync(this.configPath, 'utf-8');
      const jsonContent = JSON.parse(fileContent);
      return GlobalConfigSchema.parse(jsonContent);
    } catch (error) {
      logger.error(`Failed to load config from ${this.configPath}:`, error);
      return GlobalConfigSchema.parse({});
    }
  }

  private applyEnvironmentVariables(): void {
    if (process.env.PORT) {
      this.config.port = parseInt(process.env.PORT, 10);
    }
    if (process.env.HOST) {
      this.config.host = process.env.HOST;
    }
    if (process.env.LOG_LEVEL) {
      // @ts-expect-error - Validated at runtime by Zod if we were parsing again, but here we trust env or fallback
      this.config.logLevel = process.env.LOG_LEVEL; 
      logger.setLevel(this.config.logLevel);
    }
  }

  public getConfig(): GlobalConfig {
    return this.config;
  }

  public saveConfig(newConfig: GlobalConfig): void {
    try {
      const validatedConfig = GlobalConfigSchema.parse(newConfig);
      fs.writeFileSync(this.configPath, JSON.stringify(validatedConfig, null, 2), 'utf-8');
      this.config = validatedConfig;
      logger.info(`Config saved to ${this.configPath}`);
    } catch (error) {
      logger.error('Failed to save config:', error);
      throw error;
    }
  }

  public getServers() {
    return this.config.servers;
  }

  public addServer(server: GlobalConfig['servers'][0]) {
    const newConfig = { ...this.config, servers: [...this.config.servers, server] };
    this.saveConfig(newConfig);
  }

  public removeServer(serverId: string) {
    const newConfig = {
      ...this.config,
      servers: this.config.servers.filter((s) => s.id !== serverId)
    };
    this.saveConfig(newConfig);
  }
}

export const configManager = new ConfigManager();
