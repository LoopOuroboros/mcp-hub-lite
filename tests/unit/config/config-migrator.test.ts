import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  dryRunMigration,
  checkMigrationStatus,
  migrateConfig,
  rollbackMigration,
  resolveInstanceConfig,
  getEnabledInstances
} from '@config/config-migrator.js';
import { SystemConfigSchema, isLegacyV1Config } from '@config/config.schema.js';
import type { SystemConfig } from '@config/config.schema.js';

describe('Config Migrator', () => {
  let tempDir: string;
  let testConfigPath: string;

  beforeEach(() => {
    // Create temporary directory
    const testId = `migration-test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    tempDir = path.join(os.tmpdir(), testId);
    fs.mkdirSync(tempDir, { recursive: true });
    testConfigPath = path.join(tempDir, '.mcp-hub.json');
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      let retries = 3;
      while (retries > 0) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
          break;
        } catch {
          retries--;
          if (retries > 0) {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
          }
        }
      }
    }

    vi.restoreAllMocks();
  });

  const createLegacyV1Config = (): Record<string, unknown> => ({
    version: '1.0.0',
    system: {
      host: 'localhost',
      port: 7788,
      language: 'zh',
      theme: 'system',
      logging: {
        level: 'info',
        rotationAge: '7d',
        jsonPretty: true,
        mcpCommDebug: false,
        sessionDebug: false
      }
    },
    security: {
      allowedNetworks: ['127.0.0.1'],
      maxConcurrentConnections: 50,
      connectionTimeout: 30000,
      idleConnectionTimeout: 300000,
      sessionTimeout: 1800000,
      sessionFlushInterval: 900000,
      maxConnections: 50
    },
    servers: {
      'test-server-1': {
        command: 'npx test-server-1',
        args: ['--verbose'],
        env: { NODE_ENV: 'development' },
        enabled: true,
        tags: { environment: 'dev' },
        type: 'stdio',
        timeout: 60000,
        allowedTools: ['tool1', 'tool2'],
        description: 'Test server 1'
      },
      'test-server-2': {
        command: 'npx test-server-2',
        args: [],
        enabled: false,
        type: 'sse',
        url: 'http://localhost:8080',
        timeout: 60000,
        allowedTools: [],
        description: 'Test server 2'
      }
    },
    tagDefinitions: []
  });

  const writeLegacyV1Config = () => {
    const config = createLegacyV1Config();
    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2));
  };

  describe('checkMigrationStatus', () => {
    it('should return "not found" for non-existent file', () => {
      const result = checkMigrationStatus(testConfigPath);
      expect(result.exists).toBe(false);
      expect(result.version).toBe('unknown');
      expect(result.canMigrate).toBe(false);
    });

    it('should detect v1.0 configuration', () => {
      writeLegacyV1Config();
      const result = checkMigrationStatus(testConfigPath);
      expect(result.exists).toBe(true);
      expect(result.version).toBe('v1');
      expect(result.canMigrate).toBe(true);
    });

    it('should detect v1.1 configuration', () => {
      const v1_1Config: SystemConfig = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 7788,
          language: 'zh',
          theme: 'system',
          logging: {
            level: 'info',
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          sessionTimeout: 1800000,
          sessionFlushInterval: 900000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(v1_1Config, null, 2));

      const result = checkMigrationStatus(testConfigPath);
      expect(result.exists).toBe(true);
      expect(result.version).toBe('v1.1');
      expect(result.canMigrate).toBe(false);
    });
  });

  describe('dryRunMigration', () => {
    it('should perform migration without modifying files', () => {
      writeLegacyV1Config();
      const originalContent = fs.readFileSync(testConfigPath, 'utf8');

      const result = dryRunMigration(testConfigPath);

      expect(result.success).toBe(true);
      expect(result.migratedConfig).toBeDefined();
      expect(result.backupPath).toBeUndefined();

      // Verify file wasn't modified
      const currentContent = fs.readFileSync(testConfigPath, 'utf8');
      expect(currentContent).toBe(originalContent);
    });

    it('should convert servers to servers correctly', () => {
      writeLegacyV1Config();
      const result = dryRunMigration(testConfigPath);

      expect(result.success).toBe(true);
      expect(result.migratedConfig).toBeDefined();

      const migrated = result.migratedConfig!;
      expect(migrated.version).toBe('1.1.0');
      expect(migrated.servers).toBeDefined();
      expect(Object.keys(migrated.servers)).toHaveLength(2);
      expect(migrated.servers['test-server-1']).toBeDefined();
      expect(migrated.servers['test-server-2']).toBeDefined();

      // Check server 1
      const server1 = migrated.servers['test-server-1'];
      expect(server1.template.command).toBe('npx test-server-1');
      expect(server1.template.args).toEqual(['--verbose']);
      expect(server1.template.env).toEqual({ NODE_ENV: 'development' });
      expect(server1.template.type).toBe('stdio');
      expect(server1.template.tags).toEqual({ environment: 'dev' });
      expect(server1.instances).toHaveLength(1);
      expect(server1.instances[0].id).toMatch(/test-server-1-[0-9a-f]{8}/);
      expect(server1.instances[0].enabled).toBe(true);
    });

    it('should preserve system and security config', () => {
      writeLegacyV1Config();
      const v1Config = createLegacyV1Config();
      const result = dryRunMigration(testConfigPath);

      expect(result.success).toBe(true);
      const migrated = result.migratedConfig!;

      expect(migrated.system).toEqual(v1Config.system);
      expect(migrated.security).toEqual(v1Config.security);
    });
  });

  describe('migrateConfig (actual migration)', () => {
    it('should perform actual migration and validate the result', () => {
      writeLegacyV1Config();
      const originalContent = fs.readFileSync(testConfigPath, 'utf8');

      const result = migrateConfig(testConfigPath, {
        createBackup: true,
        validateAfterMigration: true
      });

      expect(result.success).toBe(true);
      expect(result.migratedConfig).toBeDefined();
      expect(result.backupPath).toBeDefined();

      // Verify file was modified to v1.1
      const newContent = fs.readFileSync(testConfigPath, 'utf8');
      expect(newContent).not.toBe(originalContent);

      const migratedConfig = JSON.parse(newContent);
      expect(isLegacyV1Config(migratedConfig)).toBe(false);
      expect(migratedConfig.version).toBe('1.1.0');
    });

    it('should validate migrated config with v1.1 schema', () => {
      writeLegacyV1Config();
      const result = migrateConfig(testConfigPath, {
        createBackup: false,
        validateAfterMigration: true
      });

      expect(result.success).toBe(true);
      expect(result.migratedConfig).toBeDefined();

      // Validate with Zod schema
      const validation = SystemConfigSchema.safeParse(result.migratedConfig);
      expect(validation.success).toBe(true);
    });
  });

  describe('rollbackMigration', () => {
    it('should rollback to v1.0 using backup', () => {
      writeLegacyV1Config();
      const originalContent = fs.readFileSync(testConfigPath, 'utf8');

      // Perform migration first
      const migrationResult = migrateConfig(testConfigPath, {
        createBackup: true,
        validateAfterMigration: true
      });
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.backupPath).toBeDefined();

      // Verify file is v1.1
      const migratedContent = fs.readFileSync(testConfigPath, 'utf8');
      expect(migratedContent).not.toBe(originalContent);

      // Rollback
      const rollbackResult = rollbackMigration(testConfigPath, migrationResult.backupPath!);
      expect(rollbackResult.success).toBe(true);

      // Verify file is back to original
      const rolledBackContent = fs.readFileSync(testConfigPath, 'utf8');
      expect(rolledBackContent).toBe(originalContent);
    });

    it('should fail rollback for non-existent backup', () => {
      writeLegacyV1Config();
      const nonExistentBackup = path.join(tempDir, 'non-existent-backup.json');

      const result = rollbackMigration(testConfigPath, nonExistentBackup);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('v1.1 Configuration Helpers', () => {
    describe('resolveInstanceConfig', () => {
      it('should resolve instance configuration by merging template and instance', () => {
        writeLegacyV1Config();
        const migrationResult = dryRunMigration(testConfigPath);
        expect(migrationResult.success).toBe(true);

        const serverConfig = migrationResult.migratedConfig!.servers['test-server-1'];
        const resolved = resolveInstanceConfig(serverConfig);

        expect(resolved).not.toBeNull();
        expect(resolved!.command).toBe('npx test-server-1');
        expect(resolved!.args).toEqual(['--verbose']);
        expect(resolved!.env).toEqual({ NODE_ENV: 'development' });
        expect(resolved!.type).toBe('stdio');
        expect(resolved!.tags).toEqual({ environment: 'dev' });
        expect(resolved!.enabled).toBe(true);
      });

      it('should resolve specific instance by ID', () => {
        writeLegacyV1Config();
        const migrationResult = dryRunMigration(testConfigPath);
        expect(migrationResult.success).toBe(true);

        const serverConfig = migrationResult.migratedConfig!.servers['test-server-1'];
        const instanceId = serverConfig.instances[0].id;
        const resolved = resolveInstanceConfig(serverConfig, instanceId);

        expect(resolved).not.toBeNull();
        expect(resolved!.command).toBe('npx test-server-1');
      });

      it('should return null for non-existent instance ID', () => {
        writeLegacyV1Config();
        const migrationResult = dryRunMigration(testConfigPath);
        expect(migrationResult.success).toBe(true);

        const serverConfig = migrationResult.migratedConfig!.servers['test-server-1'];
        const resolved = resolveInstanceConfig(serverConfig, 'non-existent-id');

        expect(resolved).toBeNull();
      });
    });

    describe('getEnabledInstances', () => {
      it('should return only enabled instances', () => {
        writeLegacyV1Config();
        const migrationResult = dryRunMigration(testConfigPath);
        expect(migrationResult.success).toBe(true);

        const serverConfig = migrationResult.migratedConfig!.servers['test-server-1'];
        const enabledInstances = getEnabledInstances(serverConfig);

        expect(enabledInstances).toHaveLength(1);
        expect(enabledInstances[0].instance.enabled).toBe(true);
        expect(enabledInstances[0].resolved).not.toBeNull();
      });
    });
  });

  describe('Migration Edge Cases', () => {
    it('should handle empty servers list', () => {
      const emptyV1Config: Record<string, unknown> = {
        ...createLegacyV1Config(),
        servers: {}
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(emptyV1Config, null, 2));

      const result = dryRunMigration(testConfigPath);
      expect(result.success).toBe(true);
      expect(result.migratedConfig!.servers).toEqual({});
    });

    it('should handle server with minimal configuration', () => {
      const minimalV1Config: Record<string, unknown> = {
        ...createLegacyV1Config(),
        servers: {
          'minimal-server': {
            enabled: true,
            type: 'stdio',
            args: [],
            timeout: 30000,
            allowedTools: []
          }
        }
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(minimalV1Config, null, 2));

      const result = dryRunMigration(testConfigPath);
      expect(result.success).toBe(true);
      expect(result.migratedConfig!.servers['minimal-server']).toBeDefined();
    });
  });
});
