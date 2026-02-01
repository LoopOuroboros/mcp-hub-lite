import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Import from global test setup
import { getTestConfigPath } from '../../setup.js';

describe('ConfigManager', () => {
  let ConfigManager: any;
  let tempConfigPath: string;

  beforeEach(async () => {
    // 使用全局 setup 文件创建的临时配置路径
    // 这确保所有测试都使用隔离的临时目录
    const globalConfigPath = getTestConfigPath();
    tempConfigPath = path.join(path.dirname(globalConfigPath), `test-${Date.now()}.mcp-hub.json`);

    // 确保使用全局配置路径
    process.env.MCP_HUB_CONFIG_PATH = tempConfigPath;

    // Ensure completely clean module state
    vi.resetModules();
    vi.clearAllMocks();

    // Mock logger module
    vi.doMock('@utils/logger.js', () => ({
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        setLevel: vi.fn()
      }
    }));

    // Dynamically import ConfigManager
    const module = await import('@config/config-manager.js');
    ConfigManager = module.ConfigManager;
  });

  afterEach(() => {
    vi.clearAllMocks();
    // 清理测试特定的临时文件（全局临时目录由全局 setup 清理）
    if (tempConfigPath && fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
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

  it('should manage backup creation, deduplication and limits', async () => {
    const manager = new ConfigManager(tempConfigPath);

    // 验证初始备份（创建配置文件时会自动创建备份）
    let backups = manager.listBackups();
    expect(backups.length).toBeGreaterThan(0);
    expect(fs.existsSync(backups[0].path)).toBe(true);

    // 验证去重（内容相同时不创建新备份）
    const duplicateBackup = manager.createBackup();
    expect(duplicateBackup).toBeNull();
    backups = manager.listBackups();
    // 备份数量应该保持不变
    const backupCountAfterDedup = backups.length;

    // 验证修改时创建新备份
    const originalPort = manager.getConfig().system.port;
    await manager.updateConfig({
      system: { port: originalPort + 1000 }
    });
    backups = manager.listBackups();
    expect(backups.length).toBeGreaterThan(backupCountAfterDedup);

    // 验证备份数量限制（最多保留5个）
    for (let i = 0; i < 6; i++) {
      await manager.updateConfig({
        system: { port: 7788 + i + 100 }
      });
    }
    backups = manager.listBackups();
    expect(backups.length).toBe(5);
  });

});
