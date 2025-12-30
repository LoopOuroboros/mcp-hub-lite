import fs from 'node:fs';
import path from 'node:path';
import { GlobalConfigSchema, type GlobalConfig } from './config.schema.js';
import { logger } from '../utils/logger.js';

// 端口范围验证常量
const MIN_PORT = 1;
const MAX_PORT = 65535;

/**
 * 验证端口号是否有效
 */
function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT;
}

/**
 * 解析并验证环境变量端口
 */
function parsePortFromEnv(): { port: number | null; error: string | null } {
  const portStr = process.env.PORT;
  if (!portStr) {
    return { port: null, error: null };
  }

  const port = parseInt(portStr, 10);

  if (isNaN(port)) {
    return { port: null, error: `Invalid PORT value: '${portStr}' is not a valid integer` };
  }

  if (!isValidPort(port)) {
    return { port: null, error: `Port ${port} is out of valid range (${MIN_PORT}-${MAX_PORT})` };
  }

  return { port, error: null };
}

/**
 * 验证主机地址
 */
function isValidHost(host: string): boolean {
  // 允许 localhost、127.0.0.1、0.0.0.0 或有效IP地址
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
    return true;
  }
  // 简单验证IPv4地址格式
  const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  if (!ipv4Regex.test(host)) {
    return false;
  }
  // 验证每个段在0-255范围内
  const parts = host.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

export class ConfigManager {
  private configPath: string;
  private config: GlobalConfig;
  private reloadCallbacks: Set<(config: GlobalConfig) => void> = new Set();

  constructor(configPath?: string) {
    this.configPath = configPath ||
      process.env.MCP_HUB_CONFIG_PATH ||
      path.join(process.cwd(), 'config', '.mcp-hub.json');
    this.config = this.loadConfig();
    this.applyEnvironmentVariables();
    this.watchConfigFile();
  }

  private loadConfig(): GlobalConfig {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (!fs.existsSync(this.configPath)) {
      logger.info(`Config file not found at ${this.configPath}, creating default.`);
      const defaultConfig: GlobalConfig = GlobalConfigSchema.parse({});
      this.saveConfig(defaultConfig, false);
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
    // 解析并验证PORT
    const { port, error: portError } = parsePortFromEnv();
    if (portError) {
      logger.warn(`Environment variable PORT is invalid: ${portError}. Using config file value.`);
    } else if (port !== null) {
      this.config.port = port;
      logger.info(`Port overridden by environment: ${port}`);
    }

    // 解析HOST
    if (process.env.HOST) {
      if (!isValidHost(process.env.HOST)) {
        logger.warn(`Environment variable HOST is invalid: '${process.env.HOST}'. Using config file value.`);
      } else {
        this.config.host = process.env.HOST;
        logger.info(`Host overridden by environment: ${this.config.host}`);
      }
    }

    // LOG_LEVEL处理
    if (process.env.LOG_LEVEL) {
      // @ts-expect-error - Validated at runtime by Zod if we were parsing again, but here we trust env or fallback
      this.config.logLevel = process.env.LOG_LEVEL;
      logger.setLevel(this.config.logLevel);
    }
  }

  private watchConfigFile(): void {
    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      return;
    }

    try {
      fs.watchFile(this.configPath, { interval: 1000 }, (curr, prev) => {
        if (curr.mtime > prev.mtime) {
          logger.info('Config file changed, reloading...');
          try {
            const newConfig = this.loadConfig();
            // 重新应用环境变量覆盖
            this.applyEnvironmentVariablesToConfig(newConfig);
            this.config = newConfig;
            logger.info('Config reloaded successfully');
            // 通知所有回调
            this.reloadCallbacks.forEach(cb => cb(newConfig));
          } catch (error) {
            logger.error('Failed to reload config:', error);
          }
        }
      });
    } catch (error) {
      logger.warn('Failed to watch config file:', error);
    }
  }

  private applyEnvironmentVariablesToConfig(config: GlobalConfig): void {
    const { port } = parsePortFromEnv();
    if (port !== null) {
      config.port = port;
    }
    if (process.env.HOST && isValidHost(process.env.HOST)) {
      config.host = process.env.HOST;
    }
  }

  /**
   * 注册配置变更回调
   */
  public onReload(callback: (config: GlobalConfig) => void): () => void {
    this.reloadCallbacks.add(callback);
    return () => this.reloadCallbacks.delete(callback);
  }

  /**
   * 获取当前配置路径
   */
  public getConfigPath(): string {
    return this.configPath;
  }

  public getConfig(): GlobalConfig {
    return this.config;
  }

  public saveConfig(newConfig: GlobalConfig, validate: boolean = true): void {
    try {
      const validatedConfig = validate
        ? GlobalConfigSchema.parse(newConfig)
        : GlobalConfigSchema.parse(newConfig);
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

  public updateServer(serverId: string, updates: Partial<GlobalConfig['servers'][0]>) {
    const newConfig = {
      ...this.config,
      servers: this.config.servers.map((s) => (s.id === serverId ? { ...s, ...updates } : s))
    };
    this.saveConfig(newConfig);
  }
}

export const configManager = new ConfigManager();
