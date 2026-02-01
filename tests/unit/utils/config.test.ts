import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// Removed static import of ConfigManager and logger to allow dynamic mocking
// import { ConfigManager } from '../src/config/config.manager.js';
// import { GlobalConfigSchema } from '../src/config/config.schema.js';

describe('ConfigManager', () => {
  let ConfigManager: any;
  let tempConfigPath: string;
  let tempDir: string;

  beforeEach(async () => {
    // 创建临时目录用于测试配置文件（确保使用Windows %Temp% 目录）
    tempDir = path.join(os.tmpdir(), `mcp-hub-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    tempConfigPath = path.join(tempDir, '.mcp-hub.json');

    // 设置环境变量确保在测试阶段
    process.env.NODE_ENV = 'test';
    process.env.VITEST = 'true';
    process.env.MCP_HUB_CONFIG_PATH = tempConfigPath;

    // Reset other env vars
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.LOG_LEVEL;

    // Ensure completely clean module state
    vi.resetModules();
    vi.clearAllMocks();

    // Clear any existing singleton instance
    // configManagerInstance is not exported, so we can't access it directly
    // Instead, we'll rely on the test environment isolation

    // Mock logger module
    vi.doMock('../src/utils/logger.js', () => ({
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        setLevel: vi.fn()
      }
    }));

    // Dynamically import ConfigManager
    const module = await import('../../../src/config/config-manager.js');
    ConfigManager = module.ConfigManager;
  });

  afterEach(() => {
    vi.clearAllMocks();
    // 清理临时文件和目录
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should create default config if file does not exist', () => {
    const manager = new ConfigManager(tempConfigPath);
    const config = manager.getConfig();

    expect(config.system.port).toBe(7788);
    expect(config.servers).toEqual({});
    // serverInstances 现在是内存中的属性，不在 config 对象中
    expect(manager.getServerInstances()).toEqual({});
    expect(fs.existsSync(tempConfigPath)).toBe(true);
  });

  it('should load existing config', () => {
    const initialConfig = {
      system: {
        port: 4000,
        host: '0.0.0.0',
        logging: {
          level: 'debug'
        }
      },
      servers: {},
      serverInstances: {}
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(initialConfig));

    const manager = new ConfigManager(tempConfigPath);
    const config = manager.getConfig();

    expect(config.system.port).toBe(4000);
    expect(config.system.host).toBe('0.0.0.0');
    expect(config.system.logging.level).toBe('debug');
  });

  it('should validate config with Zod schema', () => {
    const invalidConfig = {
      system: {
        port: 'invalid-port', // Should be number
        host: 'localhost',
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
      },
      servers: {},
      serverInstances: {}
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(invalidConfig));

    // Should catch error and return default or log error
    const manager = new ConfigManager(tempConfigPath);
    const config = manager.getConfig();

    expect(config.system.port).toBe(7788); // Default
  });

  it('should override with environment variables', () => {
    process.env.PORT = '5000';
    process.env.HOST = '127.0.0.1';

    const manager = new ConfigManager(tempConfigPath);
    const config = manager.getConfig();

    expect(config.system.port).toBe(5000);
    expect(config.system.host).toBe('127.0.0.1');
  });

  it('should save config updates', async () => {
    const manager = new ConfigManager(tempConfigPath);
    const serverName = 'Test Server';
    const newServer = {
      command: 'node',
      args: ['server.js'],
      enabled: true,
      type: 'stdio'
    };

    await manager.addServer(serverName, newServer);

    const updatedConfig = manager.getConfig();
    expect(Object.keys(updatedConfig.servers)).toEqual([serverName]);
    expect(updatedConfig.servers[serverName].command).toBe('node');

    // Verify file written
    const fileContent = JSON.parse(fs.readFileSync(tempConfigPath, 'utf-8'));
    expect(Object.keys(fileContent.servers)).toEqual([serverName]);
  });

  it('should manage server instances', async () => {
    const manager = new ConfigManager(tempConfigPath);
    const serverName = 'Test Server';

    // 添加服务器基础配置
    const newServer = {
      command: 'node',
      args: ['server.js'],
      enabled: true,
      type: 'stdio'
    };
    await manager.addServer(serverName, newServer);

    // 验证服务器实例数组已初始化但为空
    const serverInstances = manager.getServerInstances();
    expect(serverInstances[serverName]).toBeDefined();
    expect(serverInstances[serverName].length).toBe(0);

    // 显式添加服务器实例
    await manager.addServerInstance(serverName, {});

    // 验证服务器实例已创建
    const serverInstancesAfterAdd = manager.getServerInstances();
    expect(serverInstancesAfterAdd[serverName].length).toBe(1);
    expect(serverInstancesAfterAdd[serverName][0].id).toBeDefined();

    // 验证 serverInstances 没有保存到配置文件
    const fileContent = JSON.parse(fs.readFileSync(tempConfigPath, 'utf-8'));
    expect(fileContent.serverInstances).toBeUndefined();

    // 更新服务器实例配置
    const updatedInstance = {
      id: serverInstancesAfterAdd[serverName][0].id,
      timestamp: serverInstancesAfterAdd[serverName][0].timestamp,
      hash: serverInstancesAfterAdd[serverName][0].hash
    };
    await manager.updateServerInstance(serverName, 0, updatedInstance);

    const serverInstancesAfterUpdate = manager.getServerInstances();
    expect(serverInstancesAfterUpdate[serverName][0].id).toEqual(updatedInstance.id);

    // 删除服务器实例配置
    await manager.removeServerInstance(serverName, 0);

    const serverInstancesAfterDelete = manager.getServerInstances();
    expect(serverInstancesAfterDelete[serverName]).toBeUndefined();
  });

  it('should create backup for default config', async () => {
    const manager = new ConfigManager(tempConfigPath);
    // 配置文件会在构造函数中自动创建
    const backups = manager.listBackups();
    expect(backups.length).toBe(1);
    expect(fs.existsSync(backups[0].path)).toBe(true);
  });

  it('should create backup when config is modified with actual changes', async () => {
    const manager = new ConfigManager(tempConfigPath);

    const initialBackups = manager.listBackups();
    expect(initialBackups.length).toBe(1);

    // 获取原始端口
    const originalPort = manager.getConfig().system.port;
    const originalHost = manager.getConfig().system.host;

    // 修改配置 - 使用不同的端口和主机确保实际变化
    await manager.updateConfig({
      system: {
        port: originalPort + 1000, // 确保与原始端口不同
        host: originalHost === 'localhost' ? '127.0.0.1' : 'localhost'
      }
    });

    // 验证配置确实已更新
    const updatedConfig = manager.getConfig();
    expect(updatedConfig.system.port).toBe(originalPort + 1000);
    expect(updatedConfig.system.host).not.toBe(originalHost);

    const afterUpdateBackups = manager.listBackups();
    // 由于我们的智能重复检测，只有当内容实际变化时才会创建新备份
    expect(afterUpdateBackups.length).toBeGreaterThan(1);
    expect(fs.existsSync(afterUpdateBackups[0].path)).toBe(true);
  });

  it('should not create duplicate backup for identical config', async () => {
    const manager = new ConfigManager(tempConfigPath);

    const initialBackups = manager.listBackups();
    expect(initialBackups.length).toBe(1);

    // 手动尝试创建备份（内容相同）
    const secondBackup = manager.createBackup();
    expect(secondBackup).toBeNull(); // 应该返回 null，表示没有创建新备份

    const afterSecondBackup = manager.listBackups();
    expect(afterSecondBackup.length).toBe(1); // 备份数量应该保持不变
  });

  it('should limit number of backup files', async () => {
    const manager = new ConfigManager(tempConfigPath);

    // 创建多个备份（6次修改，加上初始备份共7个，应该保留最新的5个）
    for (let i = 0; i < 6; i++) {
      // 修改配置以确保创建新备份
      await manager.updateConfig({
        system: {
          port: 7788 + i + 100 // 使用不同的端口确保内容变化
        }
      });
    }

    const backups = manager.listBackups();
    // 最大备份数量是 5（包括最新的）
    expect(backups.length).toBe(5);
  });

});
