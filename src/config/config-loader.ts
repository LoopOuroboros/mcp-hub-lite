/**
 * Configuration loading utilities.
 * Handles loading and parsing configuration from files with validation.
 */

import * as fs from 'fs';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { SystemConfigSchema, isV1Config, isV1_1Config } from './config.schema.js';
import type {
  SystemConfig,
  SystemConfigV1,
  SystemConfigV1_1,
  ServerConfigV1_1,
  ServerInstance
} from './config.schema.js';
import { convertHttpToStreamableHttp } from './type-converter.js';
import { migrateConfig } from './config-migrator.js';

/**
 * Loads configuration from the specified file path.
 *
 * This function handles the complete configuration loading process:
 * - Checks if the config file exists at the specified path
 * - Reads and parses the JSON configuration
 * - Detects configuration version and auto-migrates v1.0 to v1.1 if needed
 * - Performs type conversion for compatibility (e.g., 'http' to 'streamable-http')
 * - Validates the configuration using Zod schema
 * - Handles validation failures gracefully by falling back to default configuration
 *
 * If the config file doesn't exist or fails to load, a default configuration is returned.
 *
 * @param configPath - Path to the configuration file
 * @param autoMigrate - Whether to automatically migrate v1.0 to v1.1 (default: false for backward compatibility)
 * @returns The loaded and validated system configuration
 */
export function loadConfig(configPath: string, autoMigrate: boolean = false): SystemConfig {
  try {
    if (fs.existsSync(configPath)) {
      logger.info(`Loading configuration from: ${configPath}`, LOG_MODULES.CONFIG_MANAGER);
      const content = fs.readFileSync(configPath, 'utf-8');
      let config = JSON.parse(content);

      // Check if automatic migration is enabled and config is v1.0
      if (autoMigrate && isV1Config(config)) {
        logger.info(
          'Detected v1.0 configuration, starting automatic migration to v1.1',
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
          // Convert back to v1.0 compatible format for backward compatibility
          config = convertToV1Compatible(migrationResult.migratedConfig);
        } else {
          logger.warn(
            `Migration failed, continuing with v1.0 config: ${migrationResult.error}`,
            LOG_MODULES.CONFIG_MANAGER
          );
        }
      } else if (isV1_1Config(config)) {
        // Convert v1.1 config to v1.0 compatible format
        config = convertToV1Compatible(config);
      }

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

/**
 * Converts a v1.1 config to v1.0 compatible format for backward compatibility.
 * Uses the first enabled instance of each server.
 *
 * @param config - v1.1 configuration
 * @returns v1.0 compatible configuration
 */
function convertToV1Compatible(config: unknown): SystemConfigV1 {
  if (!config || typeof config !== 'object' || !('servers' in config)) {
    return config as SystemConfigV1;
  }

  const v1_1Config = config as SystemConfigV1_1;
  const servers: Record<string, unknown> = {};

  for (const [serverName, serverConfig] of Object.entries(v1_1Config.servers || {})) {
    const server = serverConfig as ServerConfigV1_1;
    const template = server.template || {};
    const instances = server.instances || [];

    // Find first enabled instance
    const instance =
      instances.find((inst: ServerInstance) => inst.enabled !== false) || instances[0];

    if (instance) {
      servers[serverName] = {
        command: (instance as Record<string, unknown>).command ?? template.command,
        args: instance.args?.length > 0 ? instance.args : template.args || [],
        env: { ...template.env, ...instance.env },
        headers: { ...template.headers, ...instance.headers },
        enabled: instance.enabled !== false,
        tags: { ...template.tags, ...instance.tags },
        type: template.type || 'stdio',
        timeout: template.timeout || 60000,
        url: template.url,
        allowedTools: template.allowedTools || [],
        description: (instance as Record<string, unknown>).description ?? template.description
      };
    }
  }

  return {
    ...v1_1Config,
    version: '1.0.0',
    servers,
    tagDefinitions: v1_1Config.tagDefinitions || []
  } as SystemConfigV1;
}
