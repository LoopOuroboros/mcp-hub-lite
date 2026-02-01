import { promises as fsPromises } from 'fs';
import * as fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { SystemConfigSchema, McpServerConfigSchema, ServerInstanceConfigSchema } from './config.schema.js';
import type { McpServerConfig, SystemConfig, ServerInstanceConfig } from './config.schema.js';
import { logger } from '../utils/logger.js';

/**
 * 配置文件备份管理器
 */
class ConfigBackupManager {
  private readonly backupDir: string;
  private readonly maxBackupCount = 5;
  // 添加内存MD5缓存
  private fileHashCache = new Map<string, string>();

  constructor(private configPath: string) {
    // 备份目录应该与配置文件在同一个目录
    this.backupDir = path.dirname(configPath);
    // 确保备份目录存在
    fs.mkdirSync(this.backupDir, { recursive: true });
    // 初始化时加载现有备份的MD5
    this.initializeHashCache();
  }

  private initializeHashCache(): void {
    try {
      const backups = this.listBackups();
      for (const backup of backups) {
        const hash = this.computeFileHash(backup.path);
        if (hash) {
          this.fileHashCache.set(backup.name, hash);
        }
      }
      // 缓存当前配置文件
      if (fs.existsSync(this.configPath)) {
        const currentHash = this.computeFileHash(this.configPath);
        if (currentHash) {
          this.fileHashCache.set(path.basename(this.configPath), currentHash);
        }
      }
    } catch (error) {
      logger.warn(`Failed to initialize hash cache: ${error}`);
    }
  }

  /**
   * 计算文件的 MD5 哈希值
   */
  private computeFileHash(filePath: string): string | null {
    try {
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash('md5');
      hash.update(content);
      return hash.digest('hex');
    } catch (error) {
      logger.error(`Failed to compute file hash for ${filePath}: ${error}`);
      return null;
    }
  }

  /**
   * 创建配置文件备份
   */
  createBackup(): string | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        logger.warn(`Config file ${this.configPath} does not exist, skipping backup`);
        return null;
      }

      // 检查文件是否为空
      const stat = fs.statSync(this.configPath);
      if (stat.size === 0) {
        logger.warn(`Config file ${this.configPath} is empty, skipping backup`);
        return null;
      }

      // 获取当前文件哈希（使用缓存）
      let currentHash = this.fileHashCache.get(path.basename(this.configPath));
      if (!currentHash) {
        const computedHash = this.computeFileHash(this.configPath);
        if (!computedHash) {
          logger.error('Failed to compute current config file hash, skipping backup');
          return null;
        }
        currentHash = computedHash;
        this.fileHashCache.set(path.basename(this.configPath), currentHash);
      }

      // 检查所有备份是否已有相同内容（不使用缓存，每次都重新计算）
      const backups = this.listBackups();
      const currentFileHash = this.computeFileHash(this.configPath);
      if (!currentFileHash) {
        logger.error('Failed to compute current config file hash, skipping backup');
        return null;
      }

      const hasDuplicate = backups.some(backup => {
        const backupHash = this.computeFileHash(backup.path);
        return backupHash === currentFileHash;
      });

      if (hasDuplicate) {
        logger.debug('Config file content already exists in backups, skipping backup');
        return null;
      }

      // 简化备份文件名：使用纯毫秒时间戳
      const timestamp = Date.now();
      let backupFileName = `.mcp-hub.json.${timestamp}.bak`;
      let backupPath = path.join(this.backupDir, backupFileName);

      // 确保唯一性
      let counter = 1;
      while (fs.existsSync(backupPath)) {
        backupFileName = `.mcp-hub.json.${timestamp}_${counter}.bak`;
        backupPath = path.join(this.backupDir, backupFileName);
        counter++;
      }

      fs.copyFileSync(this.configPath, backupPath);
      logger.info(`Config backup created: ${backupPath}`);

      // 更新缓存
      this.fileHashCache.set(backupFileName, currentHash);

      // 清理旧的备份文件
      this.cleanupOldBackups();

      return backupPath;
    } catch (error) {
      logger.error(`Failed to create config backup: ${error}`);
      return null;
    }
  }

  /**
   * 清理旧的备份文件（保留最新的maxBackupCount个）
   */
  private cleanupOldBackups(): void {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backupFiles = files
        .filter(file => file.startsWith('.mcp-hub.json.') && file.endsWith('.bak'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stat = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            timestamp: stat.mtime.getTime()
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp); // 按时间降序排列

      // 删除超过maxBackupCount的旧备份
      if (backupFiles.length > this.maxBackupCount) {
        const filesToDelete = backupFiles.slice(this.maxBackupCount);
        filesToDelete.forEach(file => {
          fs.unlinkSync(file.path);
          logger.debug(`Old backup deleted: ${file.path}`);
          // 同步清理MD5缓存
          this.fileHashCache.delete(file.name);
        });
      }
    } catch (error) {
      logger.error(`Failed to cleanup old backups: ${error}`);
    }
  }

  /**
   * 列出所有备份文件
   */
  listBackups(): Array<{
    name: string;
    path: string;
    timestamp: number;
    size: number;
  }> {
    try {
      const files = fs.readdirSync(this.backupDir);
      return files
        .filter(file => file.startsWith('.mcp-hub.json.') && file.endsWith('.bak'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stat = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            timestamp: stat.mtime.getTime(),
            size: stat.size
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error(`Failed to list backups: ${error}`);
      return [];
    }
  }

  /**
   * 恢复指定的备份文件
   */
  restoreBackup(backupPath: string): boolean {
    try {
      if (!fs.existsSync(backupPath)) {
        logger.error(`Backup file ${backupPath} does not exist`);
        return false;
      }

      // 在恢复前创建当前配置的备份
      this.createBackup();

      fs.copyFileSync(backupPath, this.configPath);
      logger.info(`Config restored from backup: ${backupPath}`);

      // 更新缓存
      const currentHash = this.computeFileHash(this.configPath);
      if (currentHash) {
        this.fileHashCache.set(path.basename(this.configPath), currentHash);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to restore backup: ${error}`);
      return false;
    }
  }

  /**
   * 恢复最新的备份文件
   */
  restoreLatestBackup(): boolean {
    const backups = this.listBackups();
    if (backups.length === 0) {
      logger.warn('No backup files found');
      return false;
    }

    const latestBackup = backups[0];
    return this.restoreBackup(latestBackup.path);
  }
}

// Re-export types for external use
export { McpServerConfig, SystemConfig, ServerInstanceConfig, SystemConfigSchema, McpServerConfigSchema, ServerInstanceConfigSchema };

/**
 * Simplified Configuration Manager for MCP-HUB-LITE Lite version
 * Manages JSON configuration file with basic CRUD operations
 */

export class ConfigManager {
  private configPath: string;
  private config: SystemConfig;
  private backupManager: ConfigBackupManager;
  // 服务器实例存储在内存中，不保存到配置文件
  private serverInstances: Record<string, ServerInstanceConfig[]> = {};
  // 延迟刷盘相关属性
  private pendingChanges = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly debounceDelay = 3 * 60 * 1000; // 3分钟延迟
  // 信号处理器注册状态
  private static signalHandlersRegistered = false;

  constructor(configPath?: string) {
    if (configPath) {
      this.configPath = configPath;
    } else {
      this.configPath = this.getDefaultConfigPath();
    }
    this.backupManager = new ConfigBackupManager(this.configPath);
    this.config = this.loadConfig();
    // 注册信号处理器以确保退出前保存配置
    this.registerSignalHandlers();
  }

  /**
   * 注册信号处理器，确保程序退出前保存未保存的配置变更
   */
  private registerSignalHandlers(): void {
    // 确保信号处理器只注册一次
    if (ConfigManager.signalHandlersRegistered) {
      return;
    }

    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    const handleExit = async () => {
      // 检查所有 ConfigManager 实例是否有待保存的变更
      if (this.pendingChanges) {
        logger.info('Pending config changes detected, saving before exit...');
        await this.flushPendingChanges();
      }
      process.exit(0);
    };

    for (const signal of signals) {
      process.on(signal, () => {
        handleExit().catch((error) => {
          logger.error(`Error during ${signal} handling: ${error}`);
          process.exit(1);
        });
      });
    }

    ConfigManager.signalHandlersRegistered = true;
  }

  private getDefaultConfigPath(): string {
    // Check environment variable first
    const envPath = process.env.MCP_HUB_CONFIG_PATH;
    if (envPath) return envPath;

    // Check current directory
    const currentDirPath = path.join(process.cwd(), '.mcp-hub.json');
    if (this.fileExists(currentDirPath)) return currentDirPath;

    // Default to user's home directory .mcp-hub-lite/config folder
    const userConfigDir = path.join(os.homedir(), '.mcp-hub-lite', 'config');
    const userConfigPath = path.join(userConfigDir, '.mcp-hub.json');

    return userConfigPath;
  }

  private fileExists(filePath: string): boolean {
    try {
      fs.accessSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检测是否处于 TypeScript 编译阶段（不包括明确的测试场景）
   */
  private isCompilationPhase(): boolean {
    // 检测是否是 TypeScript 编译过程
    const isTsc = process.argv.some(arg =>
      arg.includes('tsc') || arg.includes('type-check') || arg.includes('vue-tsc')
    );

    // 检测是否是构建过程
    const isBuild = process.argv.some(arg =>
      arg.includes('build') ||
      process.env.npm_lifecycle_event === 'build'
    );

    return isTsc || isBuild;
  }

  /**
   * 检测是否处于测试阶段
   */
  private isTestPhase(): boolean {
    // 检测是否是测试环境
    const isTest = process.env.NODE_ENV === 'test' ||
                   process.env.VITEST === 'true' ||
                   process.argv.some(arg => arg.includes('vitest')) ||
                   process.env.npm_lifecycle_event === 'test' ||
                   process.env.npm_lifecycle_event === 'test:unit' ||
                   process.env.npm_lifecycle_event === 'test:backend';

    return isTest;
  }

  private loadConfig(): SystemConfig {
    let baseConfig: SystemConfig;

    try {
      if (this.fileExists(this.configPath)) {
        logger.info(`Loading configuration from: ${this.configPath}`);
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const parsedConfig = JSON.parse(content);

        // 迁移旧配置结构到新结构
        const migratedConfig = this.migrateOldConfig(parsedConfig);
        baseConfig = SystemConfigSchema.parse(migratedConfig);
      } else {
        // Config file doesn't exist, use default
        logger.info(`Config file not found, using default configuration`);
        baseConfig = SystemConfigSchema.parse({});

        // 只有在非编译阶段才会自动创建配置文件
        // 在测试阶段，只有明确指定了配置路径时才创建配置文件
        if (!this.isCompilationPhase() && (!this.isTestPhase() || (this.isTestPhase() && this.configPath))) {
          logger.info(`Creating new configuration file at: ${this.configPath}`);
          this.saveConfigSync(baseConfig);
        }
      }
    } catch (error) {
      logger.warn(`Failed to load config from ${this.configPath}: ${error}`);
      // Initialize with default config
      baseConfig = SystemConfigSchema.parse({});

      // 只有在非编译阶段且配置文件不存在时才自动保存配置文件
      // 在测试阶段，只有明确指定了配置路径且配置文件不存在时才保存配置文件
      if (!this.isCompilationPhase() && (!this.isTestPhase() || (this.isTestPhase() && this.configPath && !this.fileExists(this.configPath)))) {
        this.saveConfigSync(baseConfig);
      }
    }

    // 统一类型转换：将 http 转换为 streamable-http，保持内部一致性
    const normalizedConfig = {
      ...baseConfig,
      servers: Object.entries(baseConfig.servers).reduce((acc, [name, config]) => {
        acc[name] = {
          ...config,
          type: config.type === 'http' ? 'streamable-http' : config.type
        };
        return acc;
      }, {} as Record<string, McpServerConfig>)
    };

    // Apply environment variable overrides
    const configWithEnv = { ...normalizedConfig };

    if (process.env.PORT) {
      configWithEnv.system.port = parseInt(process.env.PORT, 10);
    }

    if (process.env.HOST) {
      configWithEnv.system.host = process.env.HOST;
    }

    if (process.env.LOG_LEVEL) {
      configWithEnv.system.logging.level = process.env.LOG_LEVEL as any;
    }

    if (process.env.LOG_ROTATION_ENABLED) {
      configWithEnv.system.logging.rotation.enabled = process.env.LOG_ROTATION_ENABLED === 'true';
    }

    if (process.env.LOG_MAX_AGE) {
      configWithEnv.system.logging.rotation.maxAge = process.env.LOG_MAX_AGE;
    }

    if (process.env.LOG_MAX_SIZE) {
      configWithEnv.system.logging.rotation.maxSize = process.env.LOG_MAX_SIZE;
    }

    if (process.env.LOG_COMPRESS) {
      configWithEnv.system.logging.rotation.compress = process.env.LOG_COMPRESS === 'true';
    }

    // 初始化内存中的服务器实例（从配置文件加载后，如果有服务器但没有实例，则初始化空数组）
    Object.keys(configWithEnv.servers).forEach(serverName => {
      if (!this.serverInstances[serverName]) {
        this.serverInstances[serverName] = [];
      }
    });

    // 清理不再存在于配置文件中的服务器实例条目
    Object.keys(this.serverInstances).forEach(serverName => {
      if (!configWithEnv.servers[serverName]) {
        delete this.serverInstances[serverName];
      }
    });

    // 重要优化：不再自动保存配置
    // 避免每次代码修改后导致配置文件被重置
    // if (configChanged) {
    //     this.saveConfigSync(configWithEnv);
    // }

    return configWithEnv;
  }

  private migrateOldConfig(oldConfig: any): any {
    // 忽略旧配置迁移，当前没有版本发布
    return oldConfig;
  }

  private reorderServerKeys(server: McpServerConfig): McpServerConfig {
    // 统一类型转换：将 http 转换为 streamable-http，保持内部一致性
    const normalizedServer = {
      ...server,
      type: server.type === 'http' ? 'streamable-http' : server.type
    };

    // Dynamically get key order from Zod schema definition
    const keyOrder = Object.keys(McpServerConfigSchema.shape) as (keyof McpServerConfig)[];

    const orderedServer: any = {};

    // Add keys in specific order
    for (const key of keyOrder) {
      if (normalizedServer[key] !== undefined) {
        orderedServer[key] = normalizedServer[key];
      }
    }

    // Add any remaining keys that might not be in the list
    for (const key of Object.keys(normalizedServer)) {
      if (!keyOrder.includes(key as keyof McpServerConfig)) {
        orderedServer[key] = (normalizedServer as any)[key];
      }
    }

    return orderedServer as McpServerConfig;
  }

  private saveConfigSync(config: SystemConfig, skipBackup: boolean = false): void {
    try {
      // Sort servers by name alphabetically and ensure keys are ordered according to schema
      if (config.servers && typeof config.servers === 'object') {
        // 将记录转换为数组，排序后再转换回记录
        const sortedEntries = Object.entries(config.servers)
          .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
          .map(([name, config]) => [name, this.reorderServerKeys(config)]);

        config.servers = Object.fromEntries(sortedEntries);
      }

      // Ensure directory exists
      const dir = path.dirname(this.configPath);
      fs.mkdirSync(dir, { recursive: true });

      // 检查是否需要备份（在保存之前检查）
      // 对于新创建的配置文件，也应该创建备份
      const needsBackup = !skipBackup;

      // 保存配置到文件
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));

      // 在保存之后创建备份
      if (needsBackup) {
        this.backupManager.createBackup();
      }
    } catch (error) {
      logger.error(`Failed to save config synchronously: ${error}`);
    }
  }

  private async saveConfig(config?: SystemConfig, skipBackup: boolean = false): Promise<void> {
    const configToSave = config || this.config;

    // Sort servers by name alphabetically and ensure keys are ordered according to schema
    if (configToSave.servers && typeof configToSave.servers === 'object') {
      // 将记录转换为数组，排序后再转换回记录
      const sortedEntries = Object.entries(configToSave.servers)
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
        .map(([name, config]) => [name, this.reorderServerKeys(config)]);

      configToSave.servers = Object.fromEntries(sortedEntries);
    }

    // Ensure directory exists
    try{
      const dir = path.dirname(this.configPath);
      await fsPromises.mkdir(dir, { recursive: true });

      // 检查是否需要备份（在保存之前检查）
      // 对于新创建的配置文件（config !== undefined），也应该创建备份
      const needsBackup = !skipBackup && (this.fileExists(this.configPath) || config !== undefined);

      logger.info(`Saving config to ${this.configPath}`);
      await fsPromises.writeFile(this.configPath, JSON.stringify(configToSave, null, 2));

      // 在保存之后创建备份
      if (needsBackup) {
        this.backupManager.createBackup();
      }
    } catch (error) {
      logger.error(`Failed to save config: ${error}`);
    }
  }

  public getConfig(): SystemConfig {
    return { ...this.config };
  }

  public getServers(): Array<{ name: string; config: McpServerConfig }> {
    return Object.entries(this.config.servers).map(([name, config]) => ({
      name,
      config
    }));
  }

  public getServerByName(name: string): McpServerConfig | undefined {
    return this.config.servers[name];
  }

  public getServerInstances(): Record<string, ServerInstanceConfig[]> {
    return { ...this.serverInstances };
  }

  public getServerInstanceByName(name: string): ServerInstanceConfig[] {
    return this.serverInstances[name] || [];
  }

  public getServerById(id: string): { name: string; config: McpServerConfig; instance: ServerInstanceConfig } | undefined {
    // 遍历所有服务器和实例，查找匹配的 id
    for (const [serverName, instances] of Object.entries(this.serverInstances)) {
      const instance = instances.find(inst => inst.id === id);
      if (instance) {
        const serverConfig = this.config.servers[serverName];
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

  /**
   * 批量添加服务器（不立即保存，用于优化批量操作）
   */
  public async addServers(servers: Array<{name: string, config: Partial<McpServerConfig>}>): Promise<void> {
    for (const {name, config} of servers) {
      const validatedConfig = McpServerConfigSchema.parse(config);
      this.config.servers[name] = validatedConfig;
      if (!this.serverInstances[name]) {
        this.serverInstances[name] = [];
      }
    }
  }

  public async addServer(name: string, config: Partial<McpServerConfig>): Promise<McpServerConfig> {
    // 使用 McpServerConfigSchema 来确保所有字段都有默认值
    const validatedConfig = McpServerConfigSchema.parse(config);
    this.config.servers[name] = validatedConfig;

    // 初始化服务器实例数组（但不自动创建实例）
    if (!this.serverInstances[name]) {
      this.serverInstances[name] = [];
    }

    // 触发延迟保存而不是立即保存
    this.triggerSaveWithDelay();
    return validatedConfig;
  }

  public async addServerInstance(name: string, instance: Partial<ServerInstanceConfig>): Promise<ServerInstanceConfig> {
    if (!this.serverInstances[name]) {
      this.serverInstances[name] = [];
    }

    // 生成实例的 id、timestamp、hash（如果未提供）
    let instanceWithIdentity: Partial<ServerInstanceConfig> = instance;
    if (!instanceWithIdentity.id || !instanceWithIdentity.timestamp || !instanceWithIdentity.hash) {
      const { id, timestamp, hash } = this.generateServerIdentity(name);
      instanceWithIdentity = {
        ...instance,
        id: instanceWithIdentity.id || id,
        timestamp: instanceWithIdentity.timestamp || timestamp, // 这里的 timestamp 就是启动时间
        hash: instanceWithIdentity.hash || hash,
        pid: instanceWithIdentity.pid, // 新增 pid 属性
        startTime: instanceWithIdentity.startTime || timestamp // 新增 startTime 属性，默认为 timestamp
      };
    }

    // 使用 ServerInstanceConfigSchema 来确保所有字段都有默认值
    const validatedInstance = ServerInstanceConfigSchema.parse(instanceWithIdentity);
    this.serverInstances[name].push(validatedInstance);
    // 不保存到配置文件
    return validatedInstance;
  }

  public async updateServer(name: string, updates: Partial<McpServerConfig>): Promise<void> {
    if (this.config.servers[name]) {
      this.config.servers[name] = { ...this.config.servers[name], ...updates };
      // 触发延迟保存而不是立即保存
      this.triggerSaveWithDelay();
    }
  }

  public async updateServerInstance(name: string, index: number, updates: Partial<ServerInstanceConfig>): Promise<void> {
    if (this.serverInstances[name] && this.serverInstances[name][index]) {
      this.serverInstances[name][index] = { ...this.serverInstances[name][index], ...updates };
      // 不保存到配置文件
    }
  }

  public async removeServer(name: string): Promise<void> {
    if (this.config.servers[name]) {
      // 同时删除服务器和对应的实例
      delete this.config.servers[name];
      delete this.serverInstances[name];
      // 触发延迟保存而不是立即保存
      this.triggerSaveWithDelay();
    }
  }

  public async removeServerInstance(name: string, index: number): Promise<void> {
    if (this.serverInstances[name]) {
      this.serverInstances[name].splice(index, 1);
      // 如果该名称下不再有实例，则删除该键
      if (this.serverInstances[name].length === 0) {
        delete this.serverInstances[name];
      }
      // 不保存到配置文件
    }
  }

  /**
   * Update the entire configuration
   */
  public async updateConfig(newConfig: Partial<SystemConfig>): Promise<void> {
    // 首先检查当前配置和新配置是否都是默认配置
    const currentConfigStr = JSON.stringify(this.config, null, 2);
    const newConfigStr = JSON.stringify(SystemConfigSchema.parse({
      ...this.config,
      ...newConfig
    }), null, 2);

    // 只有当新配置与当前配置不同时，才进行更新和备份
    if (currentConfigStr !== newConfigStr) {
      // 先合并新配置到内存中
      this.config = SystemConfigSchema.parse({
        ...this.config,
        ...newConfig
      });

      // 触发延迟保存而不是立即保存
      this.triggerSaveWithDelay();
    }
  }

  private generateServerIdentity(name?: string): { id: string, timestamp: number, hash: string } {
    let prefix: string;

    if (name) {
      // 将服务器名称转换为安全的slug格式
      prefix = name
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s-]/g, '')  // 移除特殊字符
        .replace(/\s+/g, '-')  // 空格转连字符
        .trim()
        .slice(0, 20);  // 限制长度

      // 如果处理后的名称为空，则使用默认前缀
      if (!prefix) {
        prefix = 'server';
      }
    } else {
      prefix = 'server';
    }

    const timestamp = Date.now();
    const hash = Math.random().toString(36).substr(2, 5);
    const id = `${prefix}-${timestamp}-${hash}`;

    return { id, timestamp, hash };
  }

  /**
   * 备份管理方法
   */

  /**
   * 创建配置备份
   */
  public createBackup(): string | null {
    return this.backupManager.createBackup();
  }

  /**
   * 列出所有备份文件
   */
  public listBackups(): Array<{
    name: string;
    path: string;
    timestamp: number;
    size: number;
  }> {
    return this.backupManager.listBackups();
  }

  /**
   * 恢复指定的备份文件
   */
  public restoreBackup(backupPath: string): boolean {
    const success = this.backupManager.restoreBackup(backupPath);
    if (success) {
      // 重新加载配置
      this.config = this.loadConfig();
    }
    return success;
  }

  /**
   * 恢复最新的备份文件
   */
  public restoreLatestBackup(): boolean {
    const success = this.backupManager.restoreLatestBackup();
    if (success) {
      // 重新加载配置
      this.config = this.loadConfig();
    }
    return success;
  }

  /**
   * 获取备份目录路径
   */
  public getBackupDir(): string {
    return this.backupManager['backupDir']; // 访问私有属性
  }

  /**
   * 检查是否有未保存的配置变更
   */
  public hasPendingChanges(): boolean {
    return this.pendingChanges;
  }

  /**
   * 强制立即保存所有未保存的配置变更
   */
  public async flushPendingChanges(): Promise<void> {
    if (this.pendingChanges) {
      logger.info('Flushing pending config changes immediately');
      await this.saveConfig();
      this.pendingChanges = false;
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    }
  }

  /**
   * 触发配置保存（带延迟）
   */
  private triggerSaveWithDelay(): void {
    // 如果已经有待保存的变更，重置计时器
    if (this.pendingChanges && this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.pendingChanges = true;

    // 设置新的延迟计时器
    this.debounceTimer = setTimeout(async () => {
      try {
        logger.info('Delayed config save triggered after 3 minutes of inactivity');
        await this.saveConfig();
        this.pendingChanges = false;
        this.debounceTimer = null;
      } catch (error) {
        logger.error(`Failed to save config with delay: ${error}`);
        // 即使保存失败，也清除状态以避免无限重试
        this.pendingChanges = false;
        this.debounceTimer = null;
      }
    }, this.debounceDelay);
  }

  /**
   * 同步配置（确保不会自动修改配置文件）
   */
  public async syncConfig(): Promise<void> {
    logger.info('Syncing config - ensuring no automatic modifications');
    // 重新加载配置，但不自动保存
    this.config = this.loadConfig();
  }
}

// Singleton instance - lazily created
let configManagerInstance: ConfigManager | undefined;

export function getConfigManager(configPath?: string): ConfigManager {
  if (configManagerInstance) {
    return configManagerInstance;
  }
  configManagerInstance = new ConfigManager(configPath);
  return configManagerInstance;
}

// 注意：不再在模块顶层自动创建实例，避免不必要的默认配置路径查找
// 保持向后兼容的导出 - 使用 getter 延迟创建
export const configManager = new Proxy({}, {
  get(_, prop) {
    const instance = getConfigManager();
    return (instance as any)[prop];
  }
}) as ConfigManager;