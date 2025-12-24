/**
 * 配置管理系统类型定义
 */

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  port?: number;
  tags?: Record<string, string>;
}

export interface SystemConfig {
  // 服务器配置
  servers: MCPServerConfig[];

  // 全局设置
  global: {
    port: number;
    host: string;
    cors: {
      enabled: boolean;
      allowedOrigins: string[];
    };
    rateLimit: {
      enabled: boolean;
      requestsPerMinute: number;
    };
  };

  // 日志配置
  logging: {
    level: "error" | "warn" | "info" | "debug";
    output: "console" | "file" | "both";
    file?: {
      path: string;
      maxSize: number; // MB
    };
  };

  // 备份配置
  backup: {
    enabled: boolean;
    interval: number; // hours
    maxBackups: number;
    path: string;
  };
}

export interface ConfigWithMetadata {
  data: SystemConfig;
  metadata: {
    version: string;
    lastModified: string;
    createdAt: string;
    checksum: string;
    fallback: {
      applied: Record<string, unknown>;
      reason: string[];
    };
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    path: string;
    message: string;
  }>;
  warnings: Array<{
    path: string;
    message: string;
  }>;
}

export interface ConfigBackup {
  timestamp: string;
  version: string;
  config: SystemConfig;
  checksum: string;
  size: number; // bytes
}

export interface FallbackValue<T> {
  default: T;
  required: boolean;
  min?: number;
  max?: number;
  validator?: (value: T) => boolean;
}

export type ConfigPath = string;

export interface HotReloadOptions {
  autoBackup: boolean;
  validationLevel: "strict" | "loose" | "none";
  maxBackups: number;
}