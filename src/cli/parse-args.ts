/**
 * CLI argument parsing utility
 * Provides parameter validation and parsing functions
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
 * Parse and validate port number
 */
export function parsePort(value: string): number {
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}. Must be between 1 and 65535.`);
  }
  return port;
}

/**
 * Parse and validate hostname
 */
export function parseHost(value: string): string {
  // Simple hostname format validation
  if (!value || value.trim().length === 0) {
    throw new Error('Host cannot be empty');
  }
  return value.trim();
}

/**
 * Validate configuration file path
 */
export function validateConfigPath(path: string): string {
  if (!path.endsWith('.json')) {
    throw new Error('Config file must be a .json file');
  }
  return path;
}

/**
 * Validate log level
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
 * Merge CLI options with default values
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
