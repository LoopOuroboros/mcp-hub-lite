import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig } from '@config/config-loader.js';
import { SystemConfigSchema, isV1Config, isV1_1Config } from '@config/config.schema.js';
import type { SystemConfigV1 } from '@config/config.schema.js';
import { migrateConfig, checkMigrationStatus } from '@config/config-migrator.js';

describe('Config Loader Automatic Migration (Backward Compatible)', () => {
  let tempDir: string;
  let testConfigPath: string;

  beforeEach(() => {
    // Create temporary directory
    const testId = `auto-migration-test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
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

  const createV1Config = (): SystemConfigV1 => ({
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
      }
    },
    tagDefinitions: []
  });

  const writeV1Config = () => {
    const config = createV1Config();
    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2));
  };

  describe('Backward Compatible Loading (Default Behavior)', () => {
    it('should load v1.0 config without migration by default', () => {
      writeV1Config();
      const originalContent = fs.readFileSync(testConfigPath, 'utf-8');

      // Load config with default settings (no auto-migration)
      const loadedConfig = loadConfig(testConfigPath);

      // Verify loaded config is still v1.0 format
      expect(loadedConfig.version).toBe('1.0.0');
      expect(isV1Config(loadedConfig)).toBe(true);
      expect(loadedConfig.servers).toBeDefined();
      expect(loadedConfig.servers['test-server-1']).toBeDefined();

      // Verify file was not modified
      const currentContent = fs.readFileSync(testConfigPath, 'utf-8');
      expect(currentContent).toBe(originalContent);
    });

    it('should validate loaded config with v1.0 schema', () => {
      writeV1Config();

      const loadedConfig = loadConfig(testConfigPath);

      // Validate with Zod schema
      const validation = SystemConfigSchema.safeParse(loadedConfig);
      expect(validation.success).toBe(true);
    });

    it('should sort servers by name when loading', () => {
      const v1Config = createV1Config();
      v1Config.servers = {
        'zebra-server': {
          enabled: true,
          type: 'stdio',
          args: [],
          timeout: 60000,
          allowedTools: []
        },
        'alpha-server': {
          enabled: true,
          type: 'stdio',
          args: [],
          timeout: 60000,
          allowedTools: []
        },
        'mike-server': {
          enabled: true,
          type: 'stdio',
          args: [],
          timeout: 60000,
          allowedTools: []
        }
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(v1Config, null, 2));

      const loadedConfig = loadConfig(testConfigPath);

      // Check that servers are sorted
      const serverNames = Object.keys(loadedConfig.servers);
      expect(serverNames).toEqual(['alpha-server', 'mike-server', 'zebra-server']);
    });
  });

  describe('Optional Auto-Migration', () => {
    it('should migrate v1.0 to v1.1 when autoMigrate=true', () => {
      writeV1Config();
      const originalContent = fs.readFileSync(testConfigPath, 'utf-8');

      // Load config with auto-migration enabled
      const loadedConfig = loadConfig(testConfigPath, true);

      // Even though migration happened, the returned config should be v1.0 compatible
      expect(loadedConfig.version).toBe('1.0.0');
      expect(isV1Config(loadedConfig)).toBe(true);

      // But the file on disk should be migrated to v1.1
      const newContent = fs.readFileSync(testConfigPath, 'utf-8');
      expect(newContent).not.toBe(originalContent);

      const newParsed = JSON.parse(newContent);
      expect(isV1_1Config(newParsed)).toBe(true);
      expect(newParsed.version).toBe('1.1.0');
    });

    it('should create backup when migrating with autoMigrate=true', () => {
      writeV1Config();

      // Load config with auto-migration enabled
      loadConfig(testConfigPath, true);

      // Check for backup files in the same directory
      const files = fs.readdirSync(tempDir);
      const backupFiles = files.filter((f) => f.includes('.backup.'));
      expect(backupFiles.length).toBeGreaterThan(0);

      // Verify backup file contains original v1.0 config
      const backupPath = path.join(tempDir, backupFiles[0]);
      const backupContent = fs.readFileSync(backupPath, 'utf-8');
      const backupParsed = JSON.parse(backupContent);
      expect(isV1Config(backupParsed)).toBe(true);
      expect(backupParsed.version).toBe('1.0.0');
    });

    it('should return v1.0 compatible config even when file is v1.1', () => {
      // First, create a v1.1 file by migrating
      writeV1Config();
      loadConfig(testConfigPath, true);

      // Now load again - file is already v1.1 but should return v1.0 compatible
      const loadedConfig = loadConfig(testConfigPath);

      expect(loadedConfig.version).toBe('1.0.0');
      expect(isV1Config(loadedConfig)).toBe(true);
      expect(loadedConfig.servers).toBeDefined();
    });
  });

  describe('Direct Migration Functions', () => {
    it('should check migration status correctly', () => {
      writeV1Config();

      const status = checkMigrationStatus(testConfigPath);

      expect(status.exists).toBe(true);
      expect(status.version).toBe('v1');
      expect(status.canMigrate).toBe(true);
    });

    it('should perform dry run migration without modifying files', () => {
      writeV1Config();
      const originalContent = fs.readFileSync(testConfigPath, 'utf-8');

      const result = migrateConfig(testConfigPath, {
        dryRun: true,
        createBackup: false,
        validateAfterMigration: true
      });

      expect(result.success).toBe(true);
      expect(result.migratedConfig).toBeDefined();

      // Verify file wasn't modified
      const currentContent = fs.readFileSync(testConfigPath, 'utf-8');
      expect(currentContent).toBe(originalContent);
    });
  });
});
