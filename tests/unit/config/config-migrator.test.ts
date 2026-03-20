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
  getEnabledInstances,
  convertToV1ServerConfig,
  getFlatServersMap
} from '@config/config-migrator.js';
import { SystemConfigV1_1Schema, isV1_1Config } from '@config/config.schema.js';
import type { SystemConfigV1, SystemConfigV1_1, ServerConfigV1_1 } from '@config/config.schema.js';

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

  const writeV1Config = () => {
    const config = createV1Config();
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
      writeV1Config();
      const result = checkMigrationStatus(testConfigPath);
      expect(result.exists).toBe(true);
      expect(result.version).toBe('v1');
      expect(result.canMigrate).toBe(true);
    });

    it('should detect v1.1 configuration', () => {
      const v1_1Config: SystemConfigV1_1 = {
        version: '1.1.0',
        system: createV1Config().system,
        security: createV1Config().security,
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
      writeV1Config();
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
      writeV1Config();
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
      // Instance should not have command or description
      expect((server1.instances[0] as Record<string, unknown>).command).toBeUndefined();
      expect((server1.instances[0] as Record<string, unknown>).description).toBeUndefined();
    });

    it('should preserve system and security config', () => {
      writeV1Config();
      const v1Config = createV1Config();
      const result = dryRunMigration(testConfigPath);

      expect(result.success).toBe(true);
      const migrated = result.migratedConfig!;

      expect(migrated.system).toEqual(v1Config.system);
      expect(migrated.security).toEqual(v1Config.security);
    });
  });

  describe('migrateConfig (actual migration)', () => {
    it('should perform actual migration and validate the result', () => {
      writeV1Config();
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
      expect(isV1_1Config(migratedConfig)).toBe(true);
      expect(migratedConfig.version).toBe('1.1.0');
    });

    it('should validate migrated config with v1.1 schema', () => {
      writeV1Config();
      const result = migrateConfig(testConfigPath, {
        createBackup: false,
        validateAfterMigration: true
      });

      expect(result.success).toBe(true);
      expect(result.migratedConfig).toBeDefined();

      // Validate with Zod schema
      const validation = SystemConfigV1_1Schema.safeParse(result.migratedConfig);
      expect(validation.success).toBe(true);
    });
  });

  describe('rollbackMigration', () => {
    it('should rollback to v1.0 using backup', () => {
      writeV1Config();
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
      writeV1Config();
      const nonExistentBackup = path.join(tempDir, 'non-existent-backup.json');

      const result = rollbackMigration(testConfigPath, nonExistentBackup);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('v1.1 Configuration Helpers', () => {
    describe('resolveInstanceConfig', () => {
      it('should resolve instance configuration by merging template and instance', () => {
        writeV1Config();
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
        writeV1Config();
        const migrationResult = dryRunMigration(testConfigPath);
        expect(migrationResult.success).toBe(true);

        const serverConfig = migrationResult.migratedConfig!.servers['test-server-1'];
        const instanceId = serverConfig.instances[0].id;
        const resolved = resolveInstanceConfig(serverConfig, instanceId);

        expect(resolved).not.toBeNull();
        expect(resolved!.command).toBe('npx test-server-1');
      });

      it('should return null for non-existent instance ID', () => {
        writeV1Config();
        const migrationResult = dryRunMigration(testConfigPath);
        expect(migrationResult.success).toBe(true);

        const serverConfig = migrationResult.migratedConfig!.servers['test-server-1'];
        const resolved = resolveInstanceConfig(serverConfig, 'non-existent-id');

        expect(resolved).toBeNull();
      });
    });

    describe('getEnabledInstances', () => {
      it('should return only enabled instances', () => {
        writeV1Config();
        const migrationResult = dryRunMigration(testConfigPath);
        expect(migrationResult.success).toBe(true);

        const serverConfig = migrationResult.migratedConfig!.servers['test-server-1'];
        const enabledInstances = getEnabledInstances(serverConfig);

        expect(enabledInstances).toHaveLength(1);
        expect(enabledInstances[0].instance.enabled).toBe(true);
        expect(enabledInstances[0].resolved).not.toBeNull();
      });
    });

    describe('convertToV1ServerConfig', () => {
      it('should convert v1.1 server back to v1.0 server config', () => {
        writeV1Config();
        const migrationResult = dryRunMigration(testConfigPath);
        expect(migrationResult.success).toBe(true);

        const serverConfig = migrationResult.migratedConfig!.servers['test-server-1'];
        const v1Config = convertToV1ServerConfig(serverConfig);

        expect(v1Config).not.toBeNull();
        expect(v1Config!.command).toBe('npx test-server-1');
        expect(v1Config!.args).toEqual(['--verbose']);
        expect(v1Config!.enabled).toBe(true);
        expect(v1Config!.type).toBe('stdio');
      });
    });

    describe('getFlatServersMap', () => {
      it('should get flat v1.0-style servers map from v1.1 config', () => {
        writeV1Config();
        const migrationResult = dryRunMigration(testConfigPath);
        expect(migrationResult.success).toBe(true);

        const flatMap = getFlatServersMap(migrationResult.migratedConfig!);

        // Only enabled servers are included (test-server-2 is disabled)
        expect(Object.keys(flatMap)).toHaveLength(1);
        expect(flatMap['test-server-1']).toBeDefined();
        expect(flatMap['test-server-1'].command).toBe('npx test-server-1');
      });
    });
  });

  describe('Migration Edge Cases', () => {
    it('should handle empty servers list', () => {
      const emptyV1Config: SystemConfigV1 = {
        ...createV1Config(),
        servers: {}
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(emptyV1Config, null, 2));

      const result = dryRunMigration(testConfigPath);
      expect(result.success).toBe(true);
      expect(result.migratedConfig!.servers).toEqual({});
    });

    it('should handle server with minimal configuration', () => {
      const minimalV1Config: SystemConfigV1 = {
        ...createV1Config(),
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

  describe('v1.1 Optimized Structure Tests', () => {
    describe('Instance ID Generation', () => {
      it('should generate instance IDs with 8-character hash format', () => {
        writeV1Config();
        const result = dryRunMigration(testConfigPath);
        expect(result.success).toBe(true);

        const server1 = result.migratedConfig!.servers['test-server-1'];
        expect(server1.instances[0].id).toMatch(/test-server-1-[0-9a-f]{8}/);
      });

      it('should generate stable hash for identical configurations', () => {
        writeV1Config();
        const result1 = dryRunMigration(testConfigPath);
        const result2 = dryRunMigration(testConfigPath);

        // Same input should produce same hash
        const id1 = result1.migratedConfig!.servers['test-server-1'].instances[0].id;
        const id2 = result2.migratedConfig!.servers['test-server-1'].instances[0].id;
        expect(id1).toBe(id2);
      });

      it('should generate different hashes for different env configurations', () => {
        // Create config 1 with env
        const config1: SystemConfigV1 = {
          ...createV1Config(),
          servers: {
            'test-server': {
              command: 'npx test',
              args: [],
              env: { KEY: 'value1' },
              enabled: true,
              tags: {},
              type: 'stdio',
              timeout: 60000,
              allowedTools: []
            }
          }
        };
        fs.writeFileSync(testConfigPath, JSON.stringify(config1, null, 2));
        const result1 = dryRunMigration(testConfigPath);
        const id1 = result1.migratedConfig!.servers['test-server'].instances[0].id;

        // Create config 2 with different env
        const config2: SystemConfigV1 = {
          ...createV1Config(),
          servers: {
            'test-server': {
              command: 'npx test',
              args: [],
              env: { KEY: 'value2' },
              enabled: true,
              tags: {},
              type: 'stdio',
              timeout: 60000,
              allowedTools: []
            }
          }
        };
        fs.writeFileSync(testConfigPath, JSON.stringify(config2, null, 2));
        const result2 = dryRunMigration(testConfigPath);
        const id2 = result2.migratedConfig!.servers['test-server'].instances[0].id;

        // Different env should produce different hash
        expect(id1).not.toBe(id2);
      });

      it('should generate same hash when only enabled status changes', () => {
        // Create config 1 with enabled=true
        const config1: SystemConfigV1 = {
          ...createV1Config(),
          servers: {
            'test-server': {
              command: 'npx test',
              args: [],
              env: { KEY: 'value' },
              enabled: true,
              tags: {},
              type: 'stdio',
              timeout: 60000,
              allowedTools: []
            }
          }
        };
        fs.writeFileSync(testConfigPath, JSON.stringify(config1, null, 2));
        const result1 = dryRunMigration(testConfigPath);
        const id1 = result1.migratedConfig!.servers['test-server'].instances[0].id;

        // Create config 2 with enabled=false (should have same hash)
        const config2: SystemConfigV1 = {
          ...createV1Config(),
          servers: {
            'test-server': {
              command: 'npx test',
              args: [],
              env: { KEY: 'value' },
              enabled: false,
              tags: {},
              type: 'stdio',
              timeout: 60000,
              allowedTools: []
            }
          }
        };
        fs.writeFileSync(testConfigPath, JSON.stringify(config2, null, 2));
        const result2 = dryRunMigration(testConfigPath);
        const id2 = result2.migratedConfig!.servers['test-server'].instances[0].id;

        // enabled status change should NOT affect hash
        expect(id1).toBe(id2);
      });

      it('should generate same hash when only command/description changes', () => {
        // Create config 1 with command/description A
        const config1: SystemConfigV1 = {
          ...createV1Config(),
          servers: {
            'test-server': {
              command: 'npx command-a',
              args: [],
              env: { KEY: 'value' },
              enabled: true,
              tags: {},
              type: 'stdio',
              timeout: 60000,
              allowedTools: [],
              description: 'Description A'
            }
          }
        };
        fs.writeFileSync(testConfigPath, JSON.stringify(config1, null, 2));
        const result1 = dryRunMigration(testConfigPath);
        const id1 = result1.migratedConfig!.servers['test-server'].instances[0].id;

        // Create config 2 with command/description B (should have same hash)
        const config2: SystemConfigV1 = {
          ...createV1Config(),
          servers: {
            'test-server': {
              command: 'npx command-b',
              args: [],
              env: { KEY: 'value' },
              enabled: true,
              tags: {},
              type: 'stdio',
              timeout: 60000,
              allowedTools: [],
              description: 'Description B'
            }
          }
        };
        fs.writeFileSync(testConfigPath, JSON.stringify(config2, null, 2));
        const result2 = dryRunMigration(testConfigPath);
        const id2 = result2.migratedConfig!.servers['test-server'].instances[0].id;

        // command/description change should NOT affect hash (they are in template, not instance)
        expect(id1).toBe(id2);
      });
    });

    describe('resolveInstanceConfig with optimized structure', () => {
      it('should merge template args with instance args', () => {
        // Create a server config with template and instance args
        const serverConfig: ServerConfigV1_1 = {
          template: {
            command: 'npx',
            args: ['base-command', '--base-option'],
            type: 'stdio',
            timeout: 60000,
            allowedTools: [],
            tags: {},
            description: 'Test server'
          },
          instances: [
            {
              id: 'test-instance',
              enabled: true,
              args: ['--extra-option', '--custom-value'],
              tags: {}
            }
          ],
          tagDefinitions: []
        };

        const resolved = resolveInstanceConfig(serverConfig);
        expect(resolved).not.toBeNull();
        expect(resolved!.command).toBe('npx');
        expect(resolved!.args).toEqual([
          'base-command',
          '--base-option',
          '--extra-option',
          '--custom-value'
        ]);
      });

      it('should use command and description from template only', () => {
        const serverConfig: ServerConfigV1_1 = {
          template: {
            command: 'npx template-command',
            args: ['template-arg'],
            type: 'stdio',
            timeout: 60000,
            allowedTools: [],
            tags: {},
            description: 'Template description'
          },
          instances: [
            {
              id: 'test-instance',
              enabled: true,
              args: [],
              tags: {}
            }
          ],
          tagDefinitions: []
        };

        const resolved = resolveInstanceConfig(serverConfig);
        expect(resolved).not.toBeNull();
        expect(resolved!.command).toBe('npx template-command');
        expect(resolved!.description).toBe('Template description');
      });

      it('should handle empty instance args gracefully', () => {
        const serverConfig: ServerConfigV1_1 = {
          template: {
            command: 'npx',
            args: ['only-template-arg'],
            type: 'stdio',
            timeout: 60000,
            allowedTools: [],
            tags: {}
          },
          instances: [
            {
              id: 'test-instance',
              enabled: true,
              args: [],
              tags: {}
            }
          ],
          tagDefinitions: []
        };

        const resolved = resolveInstanceConfig(serverConfig);
        expect(resolved).not.toBeNull();
        expect(resolved!.args).toEqual(['only-template-arg']);
      });

      it('should handle missing template args gracefully', () => {
        const serverConfig: ServerConfigV1_1 = {
          template: {
            command: 'npx',
            args: [],
            type: 'stdio',
            timeout: 60000,
            allowedTools: [],
            tags: {}
          },
          instances: [
            {
              id: 'test-instance',
              enabled: true,
              args: ['instance-only-arg'],
              tags: {}
            }
          ],
          tagDefinitions: []
        };

        const resolved = resolveInstanceConfig(serverConfig);
        expect(resolved).not.toBeNull();
        expect(resolved!.args).toEqual(['instance-only-arg']);
      });
    });

    describe('Migration from v1.0 to optimized v1.1', () => {
      it('should migrate without command and description in instances', () => {
        writeV1Config();
        const result = dryRunMigration(testConfigPath);
        expect(result.success).toBe(true);

        const server1 = result.migratedConfig!.servers['test-server-1'];
        const instance1 = server1.instances[0];

        // Template should have command and description
        expect(server1.template.command).toBe('npx test-server-1');
        expect(server1.template.description).toBe('Test server 1');

        // Instance should NOT have command and description
        expect((instance1 as Record<string, unknown>).command).toBeUndefined();
        expect((instance1 as Record<string, unknown>).description).toBeUndefined();
      });

      it('should have empty args in instances (template has full args)', () => {
        writeV1Config();
        const result = dryRunMigration(testConfigPath);
        expect(result.success).toBe(true);

        const server1 = result.migratedConfig!.servers['test-server-1'];
        const instance1 = server1.instances[0];

        // Template should have the original args
        expect(server1.template.args).toEqual(['--verbose']);

        // Instance should have empty args (since it's using template args)
        expect(instance1.args).toEqual([]);
      });

      it('should resolve to correct config after migration', () => {
        writeV1Config();
        const result = dryRunMigration(testConfigPath);
        expect(result.success).toBe(true);

        const serverConfig = result.migratedConfig!.servers['test-server-1'];
        const resolved = resolveInstanceConfig(serverConfig);

        expect(resolved).not.toBeNull();
        expect(resolved!.command).toBe('npx test-server-1');
        expect(resolved!.args).toEqual(['--verbose']); // Template args + empty instance args
        expect(resolved!.description).toBe('Test server 1');
      });
    });
  });
});
