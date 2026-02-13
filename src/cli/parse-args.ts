/**
 * CLI参数解析工具
 * 提供参数验证和解析函数
 */

import type { LogLevel } from '@shared-types/common.types.js';

export interface CliOptions {
  port?: number;
  host?: string;
  config?: string;
  foreground?: boolean;
  stdio?: boolean;
}

/**
 * 解析并验证端口号
 */
export function parsePort(value: string): number {
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}. Must be between 1 and 65535.`);
  }
  return port;
}

/**
 * 解析并验证主机名
 */
export function parseHost(value: string): string {
  // 简单验证主机名格式
  if (!value || value.trim().length === 0) {
    throw new Error('Host cannot be empty');
  }
  return value.trim();
}

/**
 * 验证配置文件路径
 */
export function validateConfigPath(path: string): string {
  if (!path.endsWith('.json')) {
    throw new Error('Config file must be a .json file');
  }
  return path;
}

/**
 * 验证日志级别
 */
export function validateLogLevel(level: string): LogLevel {
  const validLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
  const lowerLevel = level.toLowerCase() as LogLevel;
  if (!validLevels.includes(lowerLevel)) {
    throw new Error(`Invalid log level: ${level}. Must be one of: ${validLevels.join(', ')}`);
  }
  return lowerLevel;
}

/**
 * 合并CLI选项与默认值
 */
export function mergeOptions(options: Partial<CliOptions>, defaults: CliOptions): CliOptions {
  return {
    port: options.port ?? defaults.port,
    host: options.host ?? defaults.host,
    config: options.config ?? defaults.config,
    foreground: options.foreground ?? defaults.foreground,
    stdio: options.stdio ?? defaults.stdio
  };
}
