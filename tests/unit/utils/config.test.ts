import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigManager } from '@config/config-manager.js';

// Reset module cache to ensure each import is fresh
vi.resetModules();

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let tempConfigDir: string;
  let tempConfigPath: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };

    // Create temporary config directory
    const testRunId = `config-test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    tempConfigDir = path.join(os.tmpdir(), `mcp-hub-config-test-${testRunId}`);
    tempConfigPath = path.join(tempConfigDir, '.mcp-hub.json');

    // Ensure temporary directory exists
    fs.mkdirSync(tempConfigDir, { recursive: true });

    // Set environment variable to point to temporary config file
    process.env.MCP_HUB_CONFIG_PATH = tempConfigPath;

    // Clear other environment variables that might affect tests
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.LOG_LEVEL;

    // Create new instance directly, without using singleton pattern
    configManager = new ConfigManager(tempConfigPath);
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = { ...originalEnv };

    // Clean up temporary directory with retry mechanism to prevent permission issues
    if (fs.existsSync(tempConfigDir)) {
      let retries = 3;
      while (retries > 0) {
        try {
          fs.rmSync(tempConfigDir, { recursive: true, force: true });
          break;
        } catch (error) {
          console.warn(
            `Failed to clean up test temp directory (retries left: ${retries - 1}): ${error}`
          );
          retries--;
          if (retries > 0) {
            // Wait for a while before retrying
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
          }
        }
      }
    }

    // Clean up mocks
    vi.restoreAllMocks();
  });

  describe('Configuration Loading', () => {
    it('should create default config when no config file exists', () => {
      // Ensure config file doesn't exist
      if (fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath);
      }

      configManager = new ConfigManager(tempConfigPath);
      const config = configManager.getConfig();

      // Verify default configuration
      expect(config).toBeDefined();
      expect(config.version).toBe('1.1.0');
      expect(config.system.host).toBe('localhost');
      expect(config.system.port).toBe(7788);
      expect(config.servers).toEqual({});
    });

    it('should load existing config file', () => {
      const testConfig = {
        version: '1.1.0',
        system: {
          host: 'test-host',
          port: 8080,
          language: 'en' as const,
          theme: 'light' as const,
          logging: {
            level: 'debug' as const,
            rotationAge: '30d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 10,
          connectionTimeout: 15000,
          idleConnectionTimeout: 60000,
          sessionTimeout: 30 * 60 * 1000,
          sessionFlushInterval: 900000,
          maxConnections: 20
        },
        servers: {
          'test-server': {
            template: {
              command: 'test-command',
              args: ['arg1', 'arg2'],
              type: 'stdio' as const,
              timeout: 30000,
              aggregatedTools: [],
              tags: {}
            },
            instances: [
              {
                id: 'test-server-1',
                enabled: true,
                args: [],
                tags: {}
              }
            ],
            tagDefinitions: []
          }
        }
      };

      // Write test config file
      fs.writeFileSync(tempConfigPath, JSON.stringify(testConfig, null, 2));

      configManager = new ConfigManager(tempConfigPath);
      const config = configManager.getConfig();

      // Verify loaded configuration
      expect(config.system.host).toBe('test-host');
      expect(config.system.port).toBe(8080);
      expect(config.servers['test-server']).toBeDefined();
      expect(config.servers['test-server'].template.command).toBe('test-command');
    });

    it('should handle invalid config file gracefully', () => {
      // Write invalid JSON
      fs.writeFileSync(tempConfigPath, 'invalid json content');

      configManager = new ConfigManager(tempConfigPath);
      const config = configManager.getConfig();

      // Should fall back to default configuration
      expect(config.version).toBe('1.1.0');
      expect(config.system.host).toBe('localhost');
    });
  });

  describe('Configuration Saving', () => {
    it('should save config to file', async () => {
      configManager = new ConfigManager(tempConfigPath);

      // Modify configuration
      await configManager.updateConfig({
        system: {
          host: 'new-host',
          port: 9090,
          language: 'zh',
          theme: 'system',
          logging: {
            level: 'info',
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        }
      });

      // Verify file was created and contains correct content
      expect(fs.existsSync(tempConfigPath)).toBe(true);

      const savedContent = fs.readFileSync(tempConfigPath, 'utf-8');
      const savedConfig = JSON.parse(savedContent);

      expect(savedConfig.system.host).toBe('new-host');
      expect(savedConfig.system.port).toBe(9090);
    });

    it('should create config directory if it does not exist', async () => {
      const testRunId = `non-existent-dir-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const nonExistentPath = path.join(os.tmpdir(), testRunId, '.mcp-hub.json');

      // Ensure directory doesn't exist
      if (fs.existsSync(path.dirname(nonExistentPath))) {
        let retries = 3;
        while (retries > 0) {
          try {
            fs.rmSync(path.dirname(nonExistentPath), { recursive: true, force: true });
            break;
          } catch (error) {
            console.warn(
              `Failed to remove existing directory (retries left: ${retries - 1}): ${error}`
            );
            retries--;
            if (retries > 0) {
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
            }
          }
        }
      }

      configManager = new ConfigManager(nonExistentPath);

      // Modify configuration to trigger save
      await configManager.updateConfig({
        system: {
          host: 'test-host',
          port: 7788,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        }
      });

      // Verify both directory and file were created
      expect(fs.existsSync(nonExistentPath)).toBe(true);

      // Clean up
      if (fs.existsSync(path.dirname(nonExistentPath))) {
        let retries = 3;
        while (retries > 0) {
          try {
            fs.rmSync(path.dirname(nonExistentPath), { recursive: true, force: true });
            break;
          } catch (error) {
            console.warn(
              `Failed to clean up test directory (retries left: ${retries - 1}): ${error}`
            );
            retries--;
            if (retries > 0) {
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
            }
          }
        }
      }
    });

    it('should handle save errors gracefully', async () => {
      configManager = new ConfigManager(tempConfigPath);

      // Mock fs.writeFileSync to throw error
      vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Provide complete system config to pass schema validation
      const validConfig = {
        system: {
          host: 'test-host',
          port: 8080,
          language: 'en' as const,
          theme: 'light' as const,
          logging: {
            level: 'info' as const,
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        }
      };

      // This call should not throw an exception
      await expect(configManager.updateConfig(validConfig)).resolves.not.toThrow();

      // Restore mock
      vi.restoreAllMocks();
    });
  });

  describe('Server Management', () => {
    beforeEach(() => {
      configManager = new ConfigManager(tempConfigPath);
    });

    it('should add a new server', async () => {
      const serverTemplate = {
        command: 'test-command',
        args: ['arg1'],
        type: 'stdio' as const
      };

      await configManager.addServer('test-server', serverTemplate);

      const servers = configManager.getServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('test-server');
      expect(servers[0].config.template.command).toBe('test-command');
      expect(servers[0].config.instances).toHaveLength(1);
    });

    it('should validate server config when adding', async () => {
      const invalidServerConfig = {
        command: 'test-command',
        type: 'invalid-type'
      } as unknown as Parameters<typeof configManager.addServer>[1];

      await expect(configManager.addServer('test-server', invalidServerConfig)).rejects.toThrow();
    });

    it('should get server by name', async () => {
      const serverConfig = {
        command: 'test-command',
        type: 'stdio' as const
      };

      await configManager.addServer('test-server', serverConfig);

      const server = configManager.getServerByName('test-server');
      expect(server).toBeDefined();
      expect(server?.template.command).toBe('test-command');

      const nonExistentServer = configManager.getServerByName('non-existent');
      expect(nonExistentServer).toBeUndefined();
    });

    it('should update existing server', async () => {
      const initialConfig = {
        command: 'initial-command',
        type: 'stdio' as const
      };

      await configManager.addServer('test-server', initialConfig);

      const updates = {
        command: 'updated-command'
      };

      await configManager.updateServer('test-server', updates);

      const updatedServer = configManager.getServerByName('test-server');
      expect(updatedServer?.template.command).toBe('updated-command');
    });

    it('should not update non-existent server', async () => {
      const result = await configManager.updateServer('non-existent', { command: 'test' });
      expect(result).toBeNull();
    });

    it('should remove server', async () => {
      await configManager.addServer('test-server', {
        command: 'test-command',
        type: 'stdio' as const
      });

      const result = await configManager.removeServer('test-server');
      expect(result).toBe(true);

      const server = configManager.getServerByName('test-server');
      expect(server).toBeUndefined();
    });

    it('should not remove non-existent server', async () => {
      const result = await configManager.removeServer('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Server Instance Management', () => {
    beforeEach(() => {
      configManager = new ConfigManager(tempConfigPath);
    });

    it('should add server instance with auto-generated ID', async () => {
      // Add server first
      await configManager.addServer('test-server', {
        command: 'test-command',
        type: 'stdio' as const
      });

      const instanceConfig = {
        enabled: false
      };

      const instance = await configManager.addServerInstance('test-server', instanceConfig);

      expect(instance.id).toBeDefined();
      expect(instance.enabled).toBe(false);
    });

    it('should add server instance with provided ID', async () => {
      await configManager.addServer('test-server', {
        command: 'test-command',
        type: 'stdio' as const
      });

      const instanceConfig = {
        id: 'custom-id',
        enabled: true,
        args: ['--verbose'],
        tags: { env: 'test' }
      };

      const instance = await configManager.addServerInstance('test-server', instanceConfig);

      expect(instance.id).toBe('custom-id');
      expect(instance.enabled).toBe(true);
      expect(instance.args).toEqual(['--verbose']);
      expect(instance.tags).toEqual({ env: 'test' });
    });

    it('should get server instances by name', async () => {
      const instances = configManager.getServerInstancesByName('non-existent');
      expect(instances).toHaveLength(0);

      // Add server and instance
      await configManager.addServer('test-server', {
        command: 'test-command',
        type: 'stdio' as const
      });

      await configManager.addServerInstance('test-server', { enabled: true });

      const testInstances = configManager.getServerInstancesByName('test-server');
      expect(testInstances).toHaveLength(2); // Default instance + new one
    });

    it('should update server instance', async () => {
      await configManager.addServer('test-server', {
        command: 'test-command',
        type: 'stdio' as const
      });

      const instances = configManager.getServerInstancesByName('test-server');
      const index = instances[0].index ?? 0;

      const result = await configManager.updateServerInstance('test-server', index, {
        enabled: false
      });
      expect(result).toBe(true);

      const updatedInstances = configManager.getServerInstancesByName('test-server');
      expect(updatedInstances[0].enabled).toBe(false);
    });

    it('should remove server instance', async () => {
      await configManager.addServer('test-server', {
        command: 'test-command',
        type: 'stdio' as const
      });

      await configManager.addServerInstance('test-server', { id: 'instance-1', enabled: true });
      await configManager.addServerInstance('test-server', { id: 'instance-2', enabled: true });

      let instances = configManager.getServerInstancesByName('test-server');
      expect(instances).toHaveLength(3); // Default + 2 added

      const result = await configManager.removeServerInstance('test-server', 0);
      expect(result).toBe(true);

      instances = configManager.getServerInstancesByName('test-server');
      expect(instances).toHaveLength(2);
    });
  });

  describe('Configuration Updates and Change Logging', () => {
    beforeEach(() => {
      configManager = new ConfigManager(tempConfigPath);
    });

    it('should update system config', async () => {
      const newConfig = {
        system: {
          host: 'new-host',
          port: 9090,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1', '::1'],
          maxConcurrentConnections: 100,
          connectionTimeout: 30000,
          idleConnectionTimeout: 60000,
          sessionTimeout: 30 * 60 * 1000,
          sessionFlushInterval: 15 * 60 * 1000,
          maxConnections: 1000
        }
      };

      await configManager.updateConfig(newConfig);

      const config = configManager.getConfig();
      expect(config.system.host).toBe('new-host');
      expect(config.system.port).toBe(9090);
      expect(config.security.maxConcurrentConnections).toBe(100);
    });

    it('should handle partial config updates', async () => {
      // Initial configuration
      const initialConfig = configManager.getConfig();

      // Update only partial configuration
      await configManager.updateConfig({
        system: {
          port: 9999,
          host: initialConfig.system.host,
          language: initialConfig.system.language,
          theme: initialConfig.system.theme,
          logging: initialConfig.system.logging
        }
      });

      const updatedConfig = configManager.getConfig();

      // Verify only the specified parts are updated
      expect(updatedConfig.system.port).toBe(9999);
      expect(updatedConfig.system.host).toBe(initialConfig.system.host); // Not changed
    });
  });

  describe('Configuration Synchronization', () => {
    it('should reload config from file', async () => {
      configManager = new ConfigManager(tempConfigPath);

      // Modify configuration in memory
      await configManager.updateConfig({
        system: {
          host: 'memory-host',
          port: 7788,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        }
      });

      // Directly modify file content
      const fileConfig = {
        version: '1.1.0',
        system: {
          host: 'file-host',
          port: 7788,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
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
          sessionTimeout: 30 * 60 * 1000,
          sessionFlushInterval: 900000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };

      fs.writeFileSync(tempConfigPath, JSON.stringify(fileConfig, null, 2));

      // Synchronize configuration
      await configManager.syncConfig();

      const syncedConfig = configManager.getConfig();
      expect(syncedConfig.system.host).toBe('file-host');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle constructor with temp config path', () => {
      // Use temporary directory to create config file path
      const tempDir = path.join(
        os.tmpdir(),
        `mcp-hub-test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      );
      fs.mkdirSync(tempDir, { recursive: true });
      const testTempConfigPath = path.join(tempDir, '.mcp-hub.json');

      // Write initial configuration
      fs.writeFileSync(testTempConfigPath, JSON.stringify({ version: '1.1.0' }));

      configManager = new ConfigManager(testTempConfigPath);
      const config = configManager.getConfig();

      expect(config).toBeDefined();
      expect(config.version).toBe('1.1.0');

      // Clean up, add retry mechanism
      let retries = 3;
      while (retries > 0) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
          break;
        } catch (error) {
          console.warn(
            `Failed to clean up temp directory (retries left: ${retries - 1}): ${error}`
          );
          retries--;
          if (retries > 0) {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
          }
        }
      }
    });

    it('should handle empty config object', () => {
      fs.writeFileSync(tempConfigPath, '{}');

      configManager = new ConfigManager(tempConfigPath);
      const config = configManager.getConfig();

      // Should fill in default values
      expect(config.version).toBe('1.1.0');
      expect(config.system.host).toBe('localhost');
    });
  });
});
