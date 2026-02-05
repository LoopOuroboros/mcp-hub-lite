import * as fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '@utils/logger.js';
import { SystemConfigSchema, McpServerConfigSchema, ServerInstanceConfigSchema, ObservabilityConfigSchema } from './config.schema.js';
import type { McpServerConfig, SystemConfig, ServerInstanceConfig, ObservabilityConfig } from './config.schema.js';

// Re-export types for external use
export { McpServerConfig, SystemConfig, ServerInstanceConfig, ObservabilityConfig, SystemConfigSchema, McpServerConfigSchema, ServerInstanceConfigSchema, ObservabilityConfigSchema };

export class ConfigManager {
  private configPath: string;
  private config!: SystemConfig;
  private serverInstances: Record<string, ServerInstanceConfig[]> = {};

  constructor(configPath?: string) {
    this.configPath = configPath || process.env.MCP_HUB_CONFIG_PATH || path.join(os.homedir(), '.mcp-hub-lite', 'config', '.mcp-hub.json');
    this.loadConfig();
  }

  /**
   * 统一的类型转换方法：将 type: 'http' 转换为 type: 'streamable-http'
   * 确保所有场景（加载、添加、更新）的兼容性
   */
  private convertHttpToStreamableHttp(config: any): any {
    if (!config) return config;

    // 如果是数组，处理每个元素
    if (Array.isArray(config)) {
      return config.map(item => this.convertHttpToStreamableHttp(item));
    }

    // 如果是对象，创建副本以避免直接修改原始对象
    if (typeof config === 'object') {
      const result = { ...config };

      // 处理单个服务器配置
      if (result.type === 'http') {
        result.type = 'streamable-http';
      }

      // 递归处理嵌套对象
      for (const key in result) {
        if (typeof result[key] === 'object') {
          result[key] = this.convertHttpToStreamableHttp(result[key]);
        }
      }

      return result;
    }

    // 基本类型直接返回
    return config;
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        logger.info(`Loading configuration from: ${this.configPath}`);
        const content = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(content);
        // 统一类型转换：将 http 转换为 streamable-http
        this.config = this.convertHttpToStreamableHttp(this.config);
        // Ensure defaults without validation errors blocking
        try {
          // 使用 safeParse 而不是 parse，以便在验证失败时保留原始配置
          const parsed = SystemConfigSchema.safeParse(this.config);
          if (parsed.success) {
            this.config = parsed.data;
          } else {
            // 验证失败时，记录错误但保留原始配置
            logger.error(`Config validation failed: ${parsed.error}`);
          }
        } catch (e) {
          logger.error(`Failed to parse config: ${e}`);
          // 保留原始配置，不回退到默认值
        }
      } else {
        this.config = SystemConfigSchema.parse({});
        this.saveConfig();
      }
    } catch (error) {
      this.config = SystemConfigSchema.parse({});
    }

    // Init server instances
    if (this.config && this.config.servers && typeof this.config.servers === 'object') {
        Object.keys(this.config.servers).forEach(name => {
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
    } catch (error) {
      // Ignore
    }
  }

  public getConfig(): SystemConfig {
    return { ...this.config };
  }

  public getServers(): Array<{ name: string; config: McpServerConfig }> {
    return Object.entries(this.config.servers || {}).map(([name, config]) => ({ name, config }));
  }

  public getServerByName(name: string): McpServerConfig | undefined {
    return this.config.servers?.[name];
  }

  public getServerInstances(): Record<string, ServerInstanceConfig[]> {
    return { ...this.serverInstances };
  }

  public getServerInstanceByName(name: string): ServerInstanceConfig[] {
    return this.serverInstances[name] || [];
  }

  public getServerById(id: string): { name: string; config: McpServerConfig; instance: ServerInstanceConfig } | undefined {
    for (const [serverName, instances] of Object.entries(this.serverInstances)) {
      const instance = instances.find(inst => inst.id === id);
      if (instance) {
        return { name: serverName, config: this.config.servers[serverName], instance };
      }
    }
    return undefined;
  }

  public async addServers(servers: Array<{name: string, config: Partial<McpServerConfig>}>): Promise<void> {
    for (const {name, config} of servers) {
      // 统一类型转换：将 http 转换为 streamable-http
      const convertedConfig = this.convertHttpToStreamableHttp(config);
      this.config.servers[name] = McpServerConfigSchema.parse(convertedConfig);
      if (!this.serverInstances[name]) this.serverInstances[name] = [];
    }
    this.saveConfig();
  }

  public async addServer(name: string, config: Partial<McpServerConfig>): Promise<McpServerConfig> {
    // 统一类型转换：将 http 转换为 streamable-http
    const convertedConfig = this.convertHttpToStreamableHttp(config);
    const validated = McpServerConfigSchema.parse(convertedConfig);
    this.config.servers[name] = validated;
    if (!this.serverInstances[name]) this.serverInstances[name] = [];
    this.saveConfig();
    return validated;
  }

  public async addServerInstance(name: string, instance: Partial<ServerInstanceConfig>): Promise<ServerInstanceConfig> {
    if (!this.serverInstances[name]) this.serverInstances[name] = [];
    
    // Minimal identity generation logic inlined
    if (!instance.id) {
        const ts = Date.now();
        instance.id = `server-${ts}-${Math.random().toString(36).substr(2, 5)}`;
        instance.timestamp = ts;
        instance.hash = Math.random().toString(36);
    }
    
    const validated = ServerInstanceConfigSchema.parse(instance);
    this.serverInstances[name].push(validated);
    return validated;
  }

  public async updateServer(name: string, updates: Partial<McpServerConfig>): Promise<void> {
    if (this.config.servers[name]) {
      // 统一类型转换：将 http 转换为 streamable-http
      const convertedUpdates = this.convertHttpToStreamableHttp(updates);
      this.config.servers[name] = { ...this.config.servers[name], ...convertedUpdates };
      this.saveConfig();
    }
  }

  public async updateServerInstance(name: string, index: number, updates: Partial<ServerInstanceConfig>): Promise<void> {
    if (this.serverInstances[name]?.[index]) {
      this.serverInstances[name][index] = { ...this.serverInstances[name][index], ...updates };
    }
  }

  public async removeServer(name: string): Promise<void> {
    if (this.config.servers[name]) {
      delete this.config.servers[name];
      delete this.serverInstances[name];
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
    // 统一类型转换：将 http 转换为 streamable-http
    const convertedConfig = this.convertHttpToStreamableHttp(newConfig);
    this.config = SystemConfigSchema.parse({ ...this.config, ...convertedConfig });
    this.logConfigChanges(oldConfig, this.config);
    this.saveConfig();
  }

  private logConfigChanges(oldConfig: SystemConfig, newConfig: SystemConfig): void {
    const changes: string[] = [];
    
    const compare = (obj1: any, obj2: any, path: string) => {
      const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
      
      for (const key of allKeys) {
        const currentPath = path ? `${path}.${key}` : key;
        const val1 = obj1?.[key];
        const val2 = obj2?.[key];
        
        if (JSON.stringify(val1) === JSON.stringify(val2)) continue;
        
        if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null && !Array.isArray(val1) && !Array.isArray(val2)) {
          compare(val1, val2, currentPath);
        } else {
          const formatVal = (v: any) => v === undefined ? 'undefined' : JSON.stringify(v);
          changes.push(`${currentPath} = ${formatVal(val1)} -> ${formatVal(val2)}`);
        }
      }
    };

    compare(oldConfig, newConfig, '');

    if (changes.length > 0) {
      logger.info(`[System Config Changes]\n${changes.join('\n')}`);
    }
  }

  public async syncConfig(): Promise<void> { this.loadConfig(); }
}

export const configManager = new ConfigManager();
