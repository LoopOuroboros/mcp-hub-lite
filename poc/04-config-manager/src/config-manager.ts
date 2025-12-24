/**
 * 统一配置管理器
 * 实现配置加载、保存、热重载、导出处动、导入、备份和降级
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import chalk from "chalk";
import { validateConfig } from "./validator.js";
import type {
  SystemConfig,
  ConfigWithMetadata,
  ConfigBackup,
  HotReloadOptions,
  ValidationResult
} from "./types.js";

export class ConfigManager {
  private configPath: string;
  private backupDir: string;
  private backups: Map<string, ConfigBackup> = new Map();
  private fallbackConfig: SystemConfig;
  private listeners: Set<(config: ConfigWithMetadata) => void> = new Set();

  constructor(
    configPath: string = "./mcp-hub-config.json",
    backupDir: string = "./backups"
  ) {
    this.configPath = path.resolve(configPath);
    this.backupDir = path.resolve(backupDir);
    this.fallbackConfig = this.createFallbackConfig();
  }

  /**
   * 初始化配置管理器
   */
  async init(): Promise<ConfigWithMetadata> {
    console.log(chalk.blue("\n🔧 初始化配置管理器..."));
    console.log(`  配置路径: ${this.configPath}`);
    console.log(`  备份目录: ${this.backupDir}`);

    await fs.mkdir(this.backupDir, { recursive: true });

    let config = await this.loadConfig();
    if (!config) {
      console.log(chalk.yellow("  未找到配置文件，创建默认配置..."));
      config = await this.createDefaultConfig();
    }

    console.log(chalk.green("✅ 配置管理器初始化完成"));
    return config;
  }

  /**
   * 加载配置文件
   */
  async loadConfig(configPath?: string): Promise<ConfigWithMetadata | null> {
    const targetPath = configPath ? path.resolve(configPath) : this.configPath;

    try {
      await fs.access(targetPath);
      const content = await fs.readFile(targetPath, "utf-8");
      const data = JSON.parse(content) as SystemConfig;

      // 验证配置
      const validation = validateConfig(data);

      if (!validation.isValid) {
        console.error(chalk.red("\n❌ 配置文件验证失败:"));
        validation.errors.forEach(err => {
          console.error(chalk.red(`  - ${err.path}: ${err.message}`));
        });

        if (validation.warnings.length > 0) {
          console.log(chalk.yellow("\n⚠️  警告信息:"));
          validation.warnings.forEach(warn => {
            console.log(chalk.yellow(`  - ${warn.path}: ${warn.message}`));
          });
        }

        return null;
      }

      // 创建配置元数据
      const configWithMetadata: ConfigWithMetadata = {
        data,
        metadata: {
          version: this.generateVersion(),
          lastModified: new Date().toISOString(),
          createdAt: await this.getFileCreationTime(targetPath),
          checksum: this.generateChecksum(data),
          fallback: {
            applied: {},
            reason: []
          }
        }
      };

      return configWithMetadata;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      console.error(chalk.red(`加载配置失败: ${error}`));
      return null;
    }
  }

  /**
   * 保存配置文件
   */
  async saveConfig(
    config: SystemConfig,
    options: {
      createBackup?: boolean;
      validate?: boolean;
    } = {}
  ): Promise<void> {
    const { createBackup = true, validate = true } = options;

    // 验证配置
    if (validate) {
      const validation = validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`配置验证失败: ${validation.errors.map(e => `${e.path}: ${e.message}`).join(", ")}`);
      }
    }

    // 创建备份
    if (createBackup) {
      await this.createBackup();
    }

    // 写入新配置
    const configWithMetadata: ConfigWithMetadata = {
      data: config,
      metadata: {
        version: this.generateVersion(),
        lastModified: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        checksum: this.generateChecksum(config),
        fallback: {
          applied: {},
          reason: []
        }
      }
    };

    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(this.configPath, content, "utf-8");

    console.log(chalk.green("✅ 配置保存成功"));

    // 通知监听器
    this.listeners.forEach(listener => {
      listener(configWithMetadata);
    });
  }

  /**
   * 创建默认配置
   */
  async createDefaultConfig(): Promise<ConfigWithMetadata> {
    const defaultConfig = this.createFallbackConfig();
    return {
      data: defaultConfig,
      metadata: {
        version: this.generateVersion(),
        lastModified: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        checksum: this.generateChecksum(defaultConfig),
        fallback: {
          applied: {},
          reason: ["默认配置"]
        }
      }
    };
  }

  /**
   * 应用降级配置
   */
  async loadConfigWithFallback(fallbackConfig?: SystemConfig): Promise<ConfigWithMetadata> {
    const fallback = fallbackConfig || this.fallbackConfig;
    const validation = validateConfig(fallback);

    if (!validation.isValid) {
      validation.errors.forEach(err => {
        console.error(chalk.red(`降级配置验证失败: ${err.message}`));
      });
      throw new Error("降级配置无效");
    }

    const configWithMetadata: ConfigWithMetadata = {
      data: fallback,
      metadata: {
        version: this.generateVersion(),
        lastModified: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        checksum: this.generateChecksum(fallback),
        fallback: {
          applied: fallback as unknown as Record<string, unknown>,
          reason: ["降级到默认配置"]
        }
      }
    };

    console.log(chalk.yellow("⚠️ 已应用降级配置"));
    return configWithMetadata;
  }

  /**
   * 验证配置文件
   */
  validateConfig(config: SystemConfig): ValidationResult {
    return validateConfig(config);
  }

  /**
   * 导出配置
   */
  async exportConfig(path: string, config?: SystemConfig): Promise<void> {
    const targetPath = path.endsWith(".json") ? path : `${path}.json`;
    const exportConfig = config || this.fallbackConfig;

    const exportData = {
      version: this.generateVersion(),
      exportedAt: new Date().toISOString(),
      config: exportConfig
    };

    const content = JSON.stringify(exportData, null, 2);
    await fs.writeFile(targetPath, content, "utf-8");

    console.log(chalk.green(`✅ 配置已导出到: ${targetPath}`));
  }

  /**
   * 导入配置
   */
  async importConfig(path: string): Promise<SystemConfig> {
    const sourcePath = path.endsWith(".json") ? path : `${path}.json`;

    const content = await fs.readFile(sourcePath, "utf-8");
    const importData = JSON.parse(content);

    let config: SystemConfig;

    // 兼容多种导入格式
    if (importData.config) {
      // { config: {...}, version: "...", exportedAt: "..." }
      config = importData.config;
    } else if (importData.servers || importData.global) {
      // 直接是配置对象
      config = importData;
    } else {
      throw new Error("无效的配置文件格式");
    }

    // 验证导入的配置
    const validation = validateConfig(config);
    if (!validation.isValid) {
      throw new Error(`导入配置验证失败: ${validation.errors.map(e => `${e.path}: ${e.message}`).join(", ")}`);
    }

    console.log(chalk.green(`✅ 配置导入成功: ${sourcePath}`));
    return config;
  }

  /**
   * 创建备份
   */
  async createBackup(): Promise<void> {
    try {
      await this.loadConfig();
      // 读取当前配置
      const content = await fs.readFile(this.configPath, "utf-8");
      const data = JSON.parse(content) as SystemConfig;

      const backup: ConfigBackup = {
        timestamp: new Date().toISOString(),
        version: this.generateVersion(),
        config: data,
        checksum: this.generateChecksum(data),
        size: Buffer.byteLength(content, "utf-8")
      };

      const safeTimestamp = backup.timestamp.replace(/:/g, "-");
      const backupFile = path.join(this.backupDir, `config-${safeTimestamp}.json`);
      await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));

      // 清理旧备份
      await this.cleanupOldBackups();

      console.log(chalk.green(`✅ 新备份已创建: ${backupFile}`));
    } catch (error) {
      console.error(chalk.red(`创建备份失败: ${error}`));
    }
  }

  /**
   * 列出所有备份
   */
  async listBackups(): Promise<ConfigBackup[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups: ConfigBackup[] = [];

      for (const file of files) {
        if (!file.startsWith("config-") || !file.endsWith(".json")) continue;

        const filePath = path.join(this.backupDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        const backup = JSON.parse(content) as ConfigBackup;
        backups.push(backup);
      }

      // 按时间排序（最新的在前）
      return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (error) {
      return [];
    }
  }

  /**
   * 清理旧备份
   */
  private async cleanupOldBackups(): Promise<void> {
    const backups = await this.listBackups();
    const maxBackups = 10;

    if (backups.length > maxBackups) {
      const toDelete = backups.slice(maxBackups);
      for (const backup of toDelete) {
        const safeTimestamp = backup.timestamp.replace(/:/g, "-");
        const backupFile = path.join(this.backupDir, `config-${safeTimestamp}.json`);
        await fs.unlink(backupFile);
      }
    }
  }

  /**
   * 获取文件创建时间（模拟）
   */
  private async getFileCreationTime(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      return stats.ctime.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * 生成版本号
   */
  private generateVersion(): string {
    return `v0.1.0-${Date.now()}`;
  }

  /**
   * 生成配置校验和
   */
  private generateChecksum(config: SystemConfig): string {
    const content = JSON.stringify(config);
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * 创建降级配置
   */
  private createFallbackConfig(): SystemConfig {
    return {
      servers: [],
      global: {
        port: 3000,
        host: "localhost",
        cors: {
          enabled: true,
          allowedOrigins: ["*"]
        },
        rateLimit: {
          enabled: true,
          requestsPerMinute: 100
        }
      },
      logging: {
        level: "info",
        output: "console"
      },
      backup: {
        enabled: false,
        interval: 24,
        maxBackups: 10,
        path: "./backups"
      }
    };
  }
}