/**
 * Configuration loading utilities.
 * Handles loading and parsing configuration from files with validation.
 */

import * as fs from 'fs';
import { logger } from '@utils/logger.js';
import { SystemConfigSchema } from './config.schema.js';
import type { SystemConfig } from './config.schema.js';
import { convertHttpToStreamableHttp } from './type-converter.js';

/**
 * Loads configuration from the specified file path.
 *
 * This function handles the complete configuration loading process:
 * - Checks if the config file exists at the specified path
 * - Reads and parses the JSON configuration
 * - Performs type conversion for compatibility (e.g., 'http' to 'streamable-http')
 * - Validates the configuration using Zod schema
 * - Handles validation failures gracefully by falling back to default configuration
 *
 * If the config file doesn't exist or fails to load, a default configuration is returned.
 *
 * @param configPath - Path to the configuration file
 * @returns The loaded and validated system configuration
 */
export function loadConfig(configPath: string): SystemConfig {
  try {
    if (fs.existsSync(configPath)) {
      logger.info(`Loading configuration from: ${configPath}`, { subModule: 'ConfigManager' });
      const content = fs.readFileSync(configPath, 'utf-8');
      let config = JSON.parse(content);

      // Unified type conversion: convert http to streamable-http
      config = convertHttpToStreamableHttp(config) as SystemConfig;

      // Ensure defaults without validation errors blocking
      try {
        // Use safeParse to validate configuration
        const parsed = SystemConfigSchema.safeParse(config);
        if (parsed.success) {
          // Ensure server configurations are sorted by name
          const configWithSortedServers = {
            ...parsed.data,
            servers: Object.fromEntries(
              Object.entries(parsed.data.servers).sort(([a], [b]) => a.localeCompare(b))
            )
          };
          return configWithSortedServers;
        } else {
          // On validation failure, log error and use default configuration
          logger.error(`Config validation failed: ${parsed.error}`);
          return SystemConfigSchema.parse({});
        }
      } catch (e) {
        logger.error(`Failed to parse config: ${e}`);
        // On parsing failure, use default configuration
        return SystemConfigSchema.parse({});
      }
    } else {
      // When config file doesn't exist, create default config in memory only
      return SystemConfigSchema.parse({});
    }
  } catch (error) {
    logger.error(`Failed to load config: ${error}`);
    // On config file load failure, use default configuration
    return SystemConfigSchema.parse({});
  }
}
