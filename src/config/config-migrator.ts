import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { logger, LOG_MODULES } from '@utils/logger.js';
import type { ServerInstance, ServerTemplate, SystemConfig } from './config.schema.js';
import { isLegacyV1Config, SystemConfigSchema } from './config.schema.js';
import type { ServerRuntimeConfig } from '@shared-models/server.model.js';
import { reassignServerInstanceIndexes } from './server-config-manager.js';

/**
 * @deprecated Use ServerRuntimeConfig from @shared-models/server.model instead
 * Resolved server configuration with template + instance merged
 */
export type ResolvedServerConfig = ServerRuntimeConfig;

/**
 * Configuration Migration Result
 */
export interface MigrationResult {
  success: boolean;
  backupPath?: string;
  migratedConfig?: SystemConfig;
  error?: string;
  warnings: string[];
}

/**
 * Configuration Migrator Options
 */
export interface MigrationOptions {
  dryRun?: boolean;
  createBackup?: boolean;
  validateAfterMigration?: boolean;
}

/**
 * Default migration options
 */
const DEFAULT_OPTIONS: MigrationOptions = {
  dryRun: false,
  createBackup: true,
  validateAfterMigration: true
};

/**
 * Legacy v1.0 Server Configuration type for migration
 */
interface LegacyServerConfigV1 {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  enabled?: boolean;
  tags?: Record<string, string>;
  type?: 'stdio' | 'sse' | 'streamable-http' | 'http';
  timeout?: number;
  url?: string;
  allowedTools?: string[];
  description?: string;
}

/**
 * Legacy v1.0 System Configuration type for migration
 */
interface LegacySystemConfigV1 {
  version?: string;
  system?: Record<string, unknown>;
  security?: Record<string, unknown>;
  servers?: Record<string, LegacyServerConfigV1>;
  tagDefinitions?: Array<{ key: string; description?: string }>;
}

/**
 * Generates a timestamp for backup files
 */
function generateTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Generates a stable 8-character hash from an object
 * Uses SHA-256 and returns first 8 hex characters
 */
function generateInstanceHash(obj: Record<string, unknown>): string {
  // Create a stable string representation by recursively sorting all keys
  function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return '[' + value.map(stableStringify).join(',') + ']';
    }
    const sortedObj: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sortedObj[key] = (value as Record<string, unknown>)[key];
    }
    return (
      '{' +
      Object.keys(sortedObj)
        .map((key) => JSON.stringify(key) + ':' + stableStringify(sortedObj[key]))
        .join(',') +
      '}'
    );
  }

  const stableString = stableStringify(obj);
  const hash = createHash('sha256');
  hash.update(stableString);
  return hash.digest('hex').slice(0, 8);
}

/**
 * Creates a backup of the configuration file
 */
function createBackup(configPath: string): string | null {
  try {
    if (!existsSync(configPath)) {
      return null;
    }

    const timestamp = generateTimestamp();
    const backupDir = dirname(configPath);
    const backupPath = join(backupDir, `.mcp-hub.json.backup.${timestamp}`);

    const content = readFileSync(configPath, 'utf8');
    writeFileSync(backupPath, content, 'utf8');

    return backupPath;
  } catch (error) {
    logger.warn('Failed to create backup:', LOG_MODULES.CONFIG_MANAGER, error);
    return null;
  }
}

/**
 * Converts a legacy v1.0 ServerConfig to a v1.1 ServerTemplate
 */
function convertToServerTemplate(v1Config: LegacyServerConfigV1): ServerTemplate {
  return {
    command: v1Config.command,
    args: v1Config.args || [],
    env: v1Config.env || {},
    headers: v1Config.headers || {},
    type: v1Config.type || 'stdio',
    timeout: v1Config.timeout || 60000,
    url: v1Config.url,
    aggregatedTools: v1Config.allowedTools || [],
    description: v1Config.description
  };
}

/**
 * Generates a default instance ID for a server using content hash
 */
function generateInstanceId(serverName: string, instanceConfig: Partial<ServerInstance>): string {
  // Create an object with only the relevant fields for hashing
  const hashableContent: Record<string, unknown> = {};
  if (instanceConfig.args && instanceConfig.args.length > 0) {
    hashableContent.args = instanceConfig.args;
  }
  if (instanceConfig.env) {
    hashableContent.env = instanceConfig.env;
  }
  if (instanceConfig.headers) {
    hashableContent.headers = instanceConfig.headers;
  }
  if (instanceConfig.tags && Object.keys(instanceConfig.tags).length > 0) {
    hashableContent.tags = instanceConfig.tags;
  }

  const hash = generateInstanceHash(hashableContent);
  return `${serverName}-${hash}`;
}

/**
 * Converts a legacy v1.0 ServerConfig to a v1.1 ServerInstance
 */
function convertToServerInstance(
  v1Config: LegacyServerConfigV1,
  serverName: string
): ServerInstance {
  // Only keep the differences from template (args should be empty since template has full args)
  const instanceConfig: Partial<ServerInstance> = {
    args: [],
    env: v1Config.env || {},
    headers: v1Config.headers || {},
    tags: v1Config.tags || {}
  };

  return {
    id: generateInstanceId(serverName, instanceConfig),
    index: 0, // Set initial index for migrated instances
    enabled: v1Config.enabled !== false,
    args: [], // In v1.1, instance args are just the append part
    env: v1Config.env || {},
    headers: v1Config.headers || {},
    tags: v1Config.tags || {}
    // command and description are removed from instance
  };
}

/**
 * Converts a legacy v1.0 SystemConfig to a v1.1 SystemConfig
 */
function migrateV1ToV1_1(v1Config: LegacySystemConfigV1): {
  config: SystemConfig;
  warnings: string[];
} {
  const warnings: string[] = [];
  const servers: Record<string, SystemConfig['servers'][string]> = {};

  // Convert each v1 server to a v1.1 server
  for (const [serverName, serverConfig] of Object.entries(v1Config.servers || {})) {
    const template = convertToServerTemplate(serverConfig);
    const instance = convertToServerInstance(serverConfig, serverName);

    servers[serverName] = {
      template,
      instances: [instance],
      tagDefinitions: []
    };
  }

  // Ensure all server instances have proper indexes
  for (const serverName of Object.keys(servers)) {
    reassignServerInstanceIndexes(serverName, servers);
  }

  const v1_1Config: SystemConfig = {
    version: '1.1.0',
    system: v1Config.system as SystemConfig['system'],
    security: v1Config.security as SystemConfig['security'],
    servers,
    tagDefinitions: []
  };

  return { config: v1_1Config, warnings };
}

/**
 * Validates a configuration against the schema
 */
function validateConfig(config: unknown): {
  valid: boolean;
  errors?: string;
} {
  try {
    SystemConfigSchema.parse(config);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Loads and parses a configuration file
 */
function loadConfigFile(configPath: string): unknown {
  if (!existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const content = readFileSync(configPath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to parse configuration file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Saves a configuration file
 */
function saveConfigFile(configPath: string, config: SystemConfig): void {
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const content = JSON.stringify(config, null, 2);
  writeFileSync(configPath, content, 'utf8');
}

/**
 * Main migration function that migrates a configuration from v1.0 to v1.1
 *
 * @param configPath Path to the configuration file
 * @param options Migration options
 * @returns Migration result with backup path and migrated config
 */
export function migrateConfig(configPath: string, options: MigrationOptions = {}): MigrationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const result: MigrationResult = {
    success: false,
    warnings: []
  };

  try {
    // Load and validate source config
    const sourceConfig = loadConfigFile(configPath);

    // Check if already v1.1
    if (!isLegacyV1Config(sourceConfig)) {
      result.success = true;
      result.warnings.push('Configuration is already in v1.1 format');
      result.migratedConfig = sourceConfig as SystemConfig;
      return result;
    }

    // Create backup if requested
    let backupPath: string | null = null;
    if (opts.createBackup) {
      backupPath = createBackup(configPath);
      if (backupPath) {
        result.backupPath = backupPath;
      } else {
        result.warnings.push('Failed to create backup file');
      }
    }

    // Perform migration
    const v1Config = sourceConfig as LegacySystemConfigV1;
    const { config: migratedConfig, warnings } = migrateV1ToV1_1(v1Config);
    result.warnings.push(...warnings);

    // Validate migrated config
    if (opts.validateAfterMigration) {
      const validation = validateConfig(migratedConfig);
      if (!validation.valid) {
        result.error = `Migrated configuration validation failed: ${validation.errors}`;
        return result;
      }
    }

    // Save if not dry run
    if (!opts.dryRun) {
      saveConfigFile(configPath, migratedConfig);
    }

    result.success = true;
    result.migratedConfig = migratedConfig;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

/**
 * Performs a dry run of the migration without modifying files
 *
 * @param configPath Path to the configuration file
 * @returns Migration result with what would happen
 */
export function dryRunMigration(configPath: string): MigrationResult {
  return migrateConfig(configPath, {
    dryRun: true,
    createBackup: false,
    validateAfterMigration: true
  });
}

/**
 * Rolls back a migration using a backup file
 *
 * @param configPath Path to the current configuration file
 * @param backupPath Path to the backup file
 * @returns Success status and any error message
 */
export function rollbackMigration(
  configPath: string,
  backupPath: string
): {
  success: boolean;
  error?: string;
} {
  try {
    if (!existsSync(backupPath)) {
      return {
        success: false,
        error: `Backup file not found: ${backupPath}`
      };
    }

    const backupContent = readFileSync(backupPath, 'utf8');

    const dir = dirname(configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(configPath, backupContent, 'utf8');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Checks the migration status of a configuration file
 *
 * @param configPath Path to the configuration file
 * @returns Status information
 */
export function checkMigrationStatus(configPath: string): {
  exists: boolean;
  version: 'v1' | 'v1.1' | 'unknown';
  canMigrate: boolean;
  message: string;
} {
  if (!existsSync(configPath)) {
    return {
      exists: false,
      version: 'unknown',
      canMigrate: false,
      message: 'Configuration file does not exist'
    };
  }

  try {
    const config = loadConfigFile(configPath);

    if (!isLegacyV1Config(config)) {
      return {
        exists: true,
        version: 'v1.1',
        canMigrate: false,
        message: 'Configuration is already in v1.1 format'
      };
    }

    return {
      exists: true,
      version: 'v1',
      canMigrate: true,
      message: 'Configuration is in v1.0 format and can be migrated'
    };
  } catch (error) {
    return {
      exists: true,
      version: 'unknown',
      canMigrate: false,
      message: `Error reading configuration: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

// ====== v1.1 Configuration Helpers ======

/**
 * Resolves a server instance configuration by merging template and instance overrides
 *
 * @param serverConfig The server configuration with template and instances
 * @param instanceId Optional instance ID (uses first enabled instance if not provided)
 * @returns The resolved server configuration
 */
export function resolveInstanceConfig(
  serverConfig: SystemConfig['servers'][string],
  instanceId?: string
): ServerRuntimeConfig | null {
  const { template, instances } = serverConfig;

  // Find the target instance
  let targetInstance: ServerInstance | undefined;
  if (instanceId) {
    targetInstance = instances.find((inst) => inst.id === instanceId);
  } else {
    // Use first enabled instance
    targetInstance = instances.find((inst) => inst.enabled !== false);
  }

  if (!targetInstance) {
    return null;
  }

  // Merge template with instance overrides
  return {
    command: template.command,
    args: [...(template.args || []), ...(targetInstance.args || [])],
    env: { ...template.env, ...targetInstance.env },
    headers: { ...template.headers, ...targetInstance.headers },
    proxy: targetInstance.proxy || template.proxy,
    type: template.type,
    timeout: template.timeout,
    url: template.url,
    aggregatedTools: template.aggregatedTools,
    tags: targetInstance.tags,
    enabled: targetInstance.enabled !== false,
    description: template.description
  };
}

/**
 * Gets all enabled instances for a server
 *
 * @param serverConfig The server configuration
 * @returns Array of enabled instances with resolved configs
 */
export function getEnabledInstances(
  serverConfig: SystemConfig['servers'][string]
): Array<{ instance: ServerInstance; resolved: ServerRuntimeConfig }> {
  const result: Array<{ instance: ServerInstance; resolved: ServerRuntimeConfig }> = [];

  for (const instance of serverConfig.instances) {
    if (instance.enabled !== false) {
      const resolved = resolveInstanceConfig(serverConfig, instance.id);
      if (resolved) {
        result.push({ instance, resolved });
      }
    }
  }

  return result;
}
