/**
 * Configuration loading utilities (v1.1 only).
 * Handles loading and parsing configuration from files with validation.
 * Supports automatic migration from v1.0 to v1.1.
 */

import * as fs from 'fs';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { SystemConfigSchema, isLegacyV1Config } from './config.schema.js';
import type { SystemConfig } from './config.schema.js';
import { migrateConfig } from './config-migrator.js';
import { convertHttpToStreamableHttp } from './type-converter.js';

/**
 * Loads configuration from the specified file path.
 *
 * This function handles the complete configuration loading process:
 * - Checks if the config file exists at the specified path
 * - Reads and parses the JSON configuration
 * - Detects legacy v1.0 configuration and auto-migrates to v1.1
 * - Performs type conversion for compatibility (e.g., 'http' to 'streamable-http')
 * - Validates the configuration using Zod schema
 * - Handles validation failures gracefully by falling back to default configuration
 *
 * @param configPath - Path to the configuration file
 * @param autoMigrate - Whether to automatically migrate v1.0 to v1.1 (default: true)
 * @returns The loaded and validated system configuration (v1.1 format)
 */
export function loadConfig(configPath: string, autoMigrate: boolean = true): SystemConfig {
  try {
    if (fs.existsSync(configPath)) {
      logger.info(`Loading configuration from: ${configPath}`, LOG_MODULES.CONFIG_MANAGER);
      const content = fs.readFileSync(configPath, 'utf-8');
      let config = JSON.parse(content);

      // Check if automatic migration is enabled and config is legacy v1.0
      if (autoMigrate && isLegacyV1Config(config)) {
        logger.info(
          'Detected legacy v1.0 configuration, starting automatic migration to v1.1',
          LOG_MODULES.CONFIG_MANAGER
        );
        const migrationResult = migrateConfig(configPath, {
          dryRun: false,
          createBackup: true,
          validateAfterMigration: true
        });

        if (migrationResult.success && migrationResult.migratedConfig) {
          logger.info('Configuration successfully migrated to v1.1', LOG_MODULES.CONFIG_MANAGER);
          if (migrationResult.backupPath) {
            logger.info(
              `Backup created at: ${migrationResult.backupPath}`,
              LOG_MODULES.CONFIG_MANAGER
            );
          }
          config = migrationResult.migratedConfig;
        } else {
          logger.warn(
            `Migration failed, continuing with default config: ${migrationResult.error}`,
            LOG_MODULES.CONFIG_MANAGER
          );
          return SystemConfigSchema.parse({});
        }
      }

      // Unified type conversion: convert http to streamable-http
      config = convertHttpToStreamableHttp(config) as SystemConfig;

      // Validate and return configuration
      try {
        const parsed = SystemConfigSchema.safeParse(config);
        if (parsed.success) {
          const configWithSortedServers = {
            ...parsed.data,
            servers: Object.fromEntries(
              Object.entries(parsed.data.servers).sort(([a], [b]) => a.localeCompare(b))
            )
          };
          return configWithSortedServers;
        } else {
          logger.error(`Config validation failed: ${parsed.error}`);
          return SystemConfigSchema.parse({});
        }
      } catch (e) {
        logger.error(`Failed to parse config: ${e}`);
        return SystemConfigSchema.parse({});
      }
    } else {
      return SystemConfigSchema.parse({});
    }
  } catch (error) {
    logger.error(`Failed to load config: ${error}`);
    return SystemConfigSchema.parse({});
  }
}
