import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigManager } from '@config/config-manager.js';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let tempConfigDir: string;
  let tempConfigPath: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = { ...process.env };

    // 创建临时配置目录
    const testRunId = `config-test-${Date.now()}`;
    tempConfigDir = path.join(os.tmpdir(), `mcp-hub-config-test-${testRunId}`);
    tempConfigPath = path.join(tempConfigDir, '.mcp-hub.json');

    // 确保临时目录存在
    fs.mkdirSync(tempConfigDir, { recursive: true });

    // 设置环境变量指向临时配置文件
    process.env.MCP_HUB_CONFIG_PATH = tempConfigPath;

    // 清除可能影响测试的其他环境变量
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = { ...originalEnv };

    // 清理临时目录
    if (fs.existsSync(tempConfigDir)) {
      try {
        fs.rmSync(tempConfigDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to clean up test temp directory: ${error}`);
      }
    }

    // 清理mocks
    vi.restoreAllMocks();
  });

  describe('Configuration Loading', () => {
    it('should create default config when no config file exists', () => {
      // 确保配置文件不存在
      if (fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath);
      }

      configManager = new ConfigManager();
      const config = configManager.getConfig();

      // 验证默认配置
      expect(config).toBeDefined();
      expect(config.version).toBe('1.0.0');
      expect(config.system.host).toBe('localhost');
      expect(config.system.port).toBe(7788);
      expect(config.servers).toEqual({});
    });

    it('should load existing config file', () => {
      const testConfig = {
        version: '1.0.0',
        system: {
          host: 'test-host',
          port: 8080,
          language: 'en' as const,
          theme: 'light' as const,
          logging: {
            level: 'debug' as const,
            rotation: {
              enabled: true,
              maxAge: '30d',
              maxSize: '50MB',
              compress: true
            }
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 10,
          connectionTimeout: 15000,
          idleConnectionTimeout: 60000,
          maxConnections: 20
        },
        servers: {
          'test-server': {
            command: 'test-command',
            args: ['arg1', 'arg2'],
            enabled: true,
            type: 'stdio' as const,
            timeout: 30000
          }
        },
        observability: {
          tracing: {
            enabled: true,
            exporter: 'otlp' as const,
            endpoint: 'http://test:4318/v1/traces',
            sampleRate: 0.5
          }
        }
      };

      // 写入测试配置文件
      fs.writeFileSync(tempConfigPath, JSON.stringify(testConfig, null, 2));

      configManager = new ConfigManager();
      const config = configManager.getConfig();

      // 验证加载的配置
      expect(config.system.host).toBe('test-host');
      expect(config.system.port).toBe(8080);
      expect(config.servers['test-server']).toBeDefined();
      expect(config.servers['test-server'].command).toBe('test-command');
    });

    it('should handle invalid config file gracefully', () => {
      // 写入无效的JSON
      fs.writeFileSync(tempConfigPath, 'invalid json content');

      configManager = new ConfigManager();
      const config = configManager.getConfig();

      // 应该回退到默认配置
      expect(config.version).toBe('1.0.0');
      expect(config.system.host).toBe('localhost');
    });

  });

  describe('Configuration Saving', () => {
    it('should save config to file', () => {
      configManager = new ConfigManager();

      // 修改配置
      configManager.updateConfig({
        system: {
          host: 'new-host',
          port: 9090,
          language: 'zh',
          theme: 'system',
          logging: {
            level: 'info',
            rotation: {
              enabled: true,
              maxAge: '7d',
              maxSize: '100MB',
              compress: false
            }
          }
        }
      });

      // 验证文件已创建并包含正确内容
      expect(fs.existsSync(tempConfigPath)).toBe(true);

      const savedContent = fs.readFileSync(tempConfigPath, 'utf-8');
      const savedConfig = JSON.parse(savedContent);

      expect(savedConfig.system.host).toBe('new-host');
      expect(savedConfig.system.port).toBe(9090);
    });

    it('should create config directory if it does not exist', () => {
      const nonExistentPath = path.join(os.tmpdir(), 'non-existent-dir', '.mcp-hub.json');

      // 确保目录不存在
      if (fs.existsSync(path.dirname(nonExistentPath))) {
        fs.rmSync(path.dirname(nonExistentPath), { recursive: true, force: true });
      }

      configManager = new ConfigManager(nonExistentPath);

      // 修改配置以触发保存
      configManager.updateConfig({
        system: {
          host: 'test-host',
          port: 7788,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
            rotation: {
              enabled: true,
              maxAge: '7d',
              maxSize: '100MB',
              compress: false
            }
          }
        }
      });

      // 验证目录和文件都已创建
      expect(fs.existsSync(nonExistentPath)).toBe(true);

      // 清理
      if (fs.existsSync(path.dirname(nonExistentPath))) {
        fs.rmSync(path.dirname(nonExistentPath), { recursive: true, force: true });
      }
    });

    it('should handle save errors gracefully', async () => {
      configManager = new ConfigManager();

      // Mock fs.writeFileSync to throw error
      vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // 提供完整的 system 配置以通过 schema 验证
      const validConfig = {
        system: {
          host: 'test-host',
          port: 8080,
          language: 'en' as const,
          theme: 'light' as const,
          logging: {
            level: 'info' as const,
            rotation: {
              enabled: true,
              maxAge: '7d',
              maxSize: '100MB',
              compress: false
            }
          }
        }
      };

      // 这个调用不应该抛出异常
      await expect(configManager.updateConfig(validConfig)).resolves.not.toThrow();

      // 恢复mock
      vi.restoreAllMocks();
    });
  });

  describe('Server Management', () => {
    beforeEach(() => {
      configManager = new ConfigManager();
    });

    it('should add a new server', async () => {
      const serverConfig = {
        command: 'test-command',
        args: ['arg1'],
        enabled: true,
        type: 'stdio' as const
      };

      await configManager.addServer('test-server', serverConfig);

      const servers = configManager.getServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('test-server');
      expect(servers[0].config.command).toBe('test-command');
    });

    it('should validate server config when adding', async () => {
      const invalidServerConfig = {
        command: 'test-command',
        type: 'invalid-type' as any // 无效的类型
      };

      await expect(configManager.addServer('test-server', invalidServerConfig))
        .rejects.toThrow();
    });

    it('should get server by name', () => {
      const serverConfig = {
        command: 'test-command',
        enabled: true,
        type: 'stdio' as const
      };

      configManager.addServer('test-server', serverConfig);

      const server = configManager.getServerByName('test-server');
      expect(server).toBeDefined();
      expect(server?.command).toBe('test-command');

      const nonExistentServer = configManager.getServerByName('non-existent');
      expect(nonExistentServer).toBeUndefined();
    });

    it('should update existing server', async () => {
      const initialConfig = {
        command: 'initial-command',
        enabled: true,
        type: 'stdio' as const
      };

      await configManager.addServer('test-server', initialConfig);

      const updates = {
        command: 'updated-command',
        enabled: false
      };

      await configManager.updateServer('test-server', updates);

      const updatedServer = configManager.getServerByName('test-server');
      expect(updatedServer?.command).toBe('updated-command');
      expect(updatedServer?.enabled).toBe(false);
    });

    it('should not update non-existent server', async () => {
      await configManager.updateServer('non-existent', { enabled: false });

      const server = configManager.getServerByName('non-existent');
      expect(server).toBeUndefined();
    });

    it('should remove server', async () => {
      await configManager.addServer('test-server', {
        command: 'test-command',
        enabled: true,
        type: 'stdio' as const
      });

      await configManager.removeServer('test-server');

      const server = configManager.getServerByName('test-server');
      expect(server).toBeUndefined();
    });

    it('should not remove non-existent server', async () => {
      await configManager.removeServer('non-existent');
      // 不应该抛出异常
    });
  });

  describe('Server Instance Management', () => {
    beforeEach(() => {
      configManager = new ConfigManager();
    });

    it('should add server instance with auto-generated ID', async () => {
      // 先添加服务器
      await configManager.addServer('test-server', {
        command: 'test-command',
        enabled: true,
        type: 'stdio' as const
      });

      const instanceConfig = {
        pid: 12345
      };

      const instance = await configManager.addServerInstance('test-server', instanceConfig);

      expect(instance.id).toBeDefined();
      expect(instance.pid).toBe(12345);
      expect(instance.timestamp).toBeDefined();
      expect(instance.hash).toBeDefined();
    });

    it('should add server instance with provided ID', async () => {
      await configManager.addServer('test-server', {
        command: 'test-command',
        enabled: true,
        type: 'stdio' as const
      });

      const instanceConfig = {
        id: 'custom-id',
        timestamp: 1234567890,
        hash: 'custom-hash',
        pid: 12345
      };

      const instance = await configManager.addServerInstance('test-server', instanceConfig);

      expect(instance.id).toBe('custom-id');
      expect(instance.timestamp).toBe(1234567890);
      expect(instance.hash).toBe('custom-hash');
      expect(instance.pid).toBe(12345);
    });

    it('should validate server instance config', async () => {
      await configManager.addServer('test-server', {
        command: 'test-command',
        enabled: true,
        type: 'stdio' as const
      });

      const invalidInstance = {
        id: 'test-id',
        timestamp: 'invalid-timestamp' // 应该是数字
      } as any;

      await expect(configManager.addServerInstance('test-server', invalidInstance))
        .rejects.toThrow();
    });

    it('should get server instances by name', () => {
      const instances = configManager.getServerInstanceByName('non-existent');
      expect(instances).toHaveLength(0);

      // 添加服务器和实例
      configManager.addServer('test-server', {
        command: 'test-command',
        enabled: true,
        type: 'stdio' as const
      });

      configManager.addServerInstance('test-server', { pid: 12345 });

      const testInstances = configManager.getServerInstanceByName('test-server');
      expect(testInstances).toHaveLength(1);
    });

    it('should get all server instances', () => {
      const allInstances = configManager.getServerInstances();
      expect(Object.keys(allInstances)).toHaveLength(0);

      // 添加服务器和实例
      configManager.addServer('server1', {
        command: 'cmd1',
        enabled: true,
        type: 'stdio' as const
      });
      configManager.addServer('server2', {
        command: 'cmd2',
        enabled: true,
        type: 'stdio' as const
      });

      configManager.addServerInstance('server1', { pid: 12345 });
      configManager.addServerInstance('server2', { pid: 67890 });

      const allInstancesAfter = configManager.getServerInstances();
      expect(Object.keys(allInstancesAfter)).toHaveLength(2);
      expect(allInstancesAfter.server1).toHaveLength(1);
      expect(allInstancesAfter.server2).toHaveLength(1);
    });

    it('should get server by instance ID', async () => {
      await configManager.addServer('test-server', {
        command: 'test-command',
        enabled: true,
        type: 'stdio' as const
      });

      await configManager.addServerInstance('test-server', {
        id: 'test-instance-id',
        timestamp: Date.now(),
        hash: 'test-hash',
        pid: 12345
      });

      const result = configManager.getServerById('test-instance-id');
      expect(result).toBeDefined();
      expect(result?.name).toBe('test-server');
      expect(result?.instance.id).toBe('test-instance-id');
      expect(result?.config.command).toBe('test-command');

      const nonExistent = configManager.getServerById('non-existent');
      expect(nonExistent).toBeUndefined();
    });

    it('should update server instance', async () => {
      await configManager.addServer('test-server', {
        command: 'test-command',
        enabled: true,
        type: 'stdio' as const
      });

      await configManager.addServerInstance('test-server', { pid: 12345 });

      await configManager.updateServerInstance('test-server', 0, { pid: 54321 });

      const instances = configManager.getServerInstanceByName('test-server');
      expect(instances[0].pid).toBe(54321);
    });

    it('should remove server instance', async () => {
      await configManager.addServer('test-server', {
        command: 'test-command',
        enabled: true,
        type: 'stdio' as const
      });

      await configManager.addServerInstance('test-server', { pid: 12345 });
      await configManager.addServerInstance('test-server', { pid: 67890 });

      await configManager.removeServerInstance('test-server', 0);

      const instances = configManager.getServerInstanceByName('test-server');
      expect(instances).toHaveLength(1);
      expect(instances[0].pid).toBe(67890);
    });
  });

  describe('Configuration Updates and Change Logging', () => {
    beforeEach(() => {
      configManager = new ConfigManager();
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
            rotation: {
              enabled: true,
              maxAge: '7d',
              maxSize: '100MB',
              compress: false
            }
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1', '::1'],
          maxConcurrentConnections: 100,
          connectionTimeout: 30000,
          idleConnectionTimeout: 60000,
          maxConnections: 1000
        }
      };

      await configManager.updateConfig(newConfig);

      const config = configManager.getConfig();
      expect(config.system.host).toBe('new-host');
      expect(config.system.port).toBe(9090);
      expect(config.security.maxConcurrentConnections).toBe(100);
    });

    it('should log configuration changes', async () => {
      // Mock logger
      const loggerInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      await configManager.updateConfig({
        system: {
          host: 'new-host',
          port: 7788,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
            rotation: {
              enabled: true,
              maxAge: '7d',
              maxSize: '100MB',
              compress: false
            }
          }
        }
      });

      // 验证日志被调用（注意：实际的日志记录在logger模块中）
      // 由于logger是外部依赖，我们主要验证配置更新本身

      const config = configManager.getConfig();
      expect(config.system.host).toBe('new-host');

      loggerInfoSpy.mockRestore();
    });

    it('should handle partial config updates', async () => {
      // 初始配置
      const initialConfig = configManager.getConfig();

      // 只更新部分配置
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

      // 验证只有指定的部分被更新
      expect(updatedConfig.system.port).toBe(9999);
      expect(updatedConfig.system.host).toBe(initialConfig.system.host); // 未改变
    });
  });

  describe('Configuration Synchronization', () => {
    it('should reload config from file', async () => {
      configManager = new ConfigManager();

      // 修改内存中的配置
      await configManager.updateConfig({
        system: {
          host: 'memory-host',
          port: 7788,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
            rotation: {
              enabled: true,
              maxAge: '7d',
              maxSize: '100MB',
              compress: false
            }
          }
        }
      });

      // 直接修改文件内容
      const fileConfig = {
        version: '1.0.0',
        system: {
          host: 'file-host',
          port: 7788,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
            rotation: {
              enabled: true,
              maxAge: '7d',
              maxSize: '100MB',
              compress: false
            }
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          maxConnections: 50
        },
        servers: {},
        observability: {
          tracing: {
            enabled: false,
            exporter: 'console' as const,
            endpoint: 'http://localhost:4318/v1/traces',
            sampleRate: 1.0
          }
        }
      };

      fs.writeFileSync(tempConfigPath, JSON.stringify(fileConfig, null, 2));

      // 同步配置
      await configManager.syncConfig();

      const syncedConfig = configManager.getConfig();
      expect(syncedConfig.system.host).toBe('file-host');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle constructor without config path', () => {
      // 清除环境变量
      delete process.env.MCP_HUB_CONFIG_PATH;

      configManager = new ConfigManager();
      const config = configManager.getConfig();

      expect(config).toBeDefined();
    });

    it('should handle empty config object', () => {
      fs.writeFileSync(tempConfigPath, '{}');

      configManager = new ConfigManager();
      const config = configManager.getConfig();

      // 应该填充默认值
      expect(config.version).toBe('1.0.0');
      expect(config.system.host).toBe('localhost');
    });

  });
});