import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
// Removed static import of ConfigManager and logger to allow dynamic mocking
// import { ConfigManager } from '../src/config/config.manager.js';
// import { GlobalConfigSchema } from '../src/config/config.schema.js';

const TEST_CONFIG_PATH = path.join(process.cwd(), 'test-config.json');

describe('ConfigManager', () => {
  let ConfigManager: any;

  beforeEach(async () => {
    // Reset env vars
    delete process.env.MCP_HUB_CONFIG_PATH;
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.LOG_LEVEL;

    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }

    // Reset modules to ensure clean mock injection
    vi.resetModules();

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
    const module = await import('../src/config/config.manager.js');
    ConfigManager = module.ConfigManager;
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
  });

  it('should create default config if file does not exist', () => {
    const manager = new ConfigManager(TEST_CONFIG_PATH);
    const config = manager.getConfig();
    
    expect(config.port).toBe(3000);
    expect(config.servers).toEqual([]);
    expect(fs.existsSync(TEST_CONFIG_PATH)).toBe(true);
  });

  it('should load existing config', () => {
    const initialConfig = {
      port: 4000,
      host: '0.0.0.0',
      logLevel: 'debug',
      servers: []
    };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));

    const manager = new ConfigManager(TEST_CONFIG_PATH);
    const config = manager.getConfig();

    expect(config.port).toBe(4000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.logLevel).toBe('debug');
  });

  it('should validate config with Zod schema', () => {
    const invalidConfig = {
      port: 'invalid-port', // Should be number
      servers: []
    };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(invalidConfig));

    // Should catch error and return default or log error
    const manager = new ConfigManager(TEST_CONFIG_PATH);
    const config = manager.getConfig();

    expect(config.port).toBe(3000); // Default
  });

  it('should override with environment variables', () => {
    process.env.PORT = '5000';
    process.env.HOST = '127.0.0.1';
    
    const manager = new ConfigManager(TEST_CONFIG_PATH);
    const config = manager.getConfig();

    expect(config.port).toBe(5000);
    expect(config.host).toBe('127.0.0.1');
  });

  it('should save config updates', () => {
    const manager = new ConfigManager(TEST_CONFIG_PATH);
    const newServer = {
      id: crypto.randomUUID(),
      name: 'Test Server',
      command: 'node',
      args: ['server.js'],
      enabled: true
    };

    manager.addServer(newServer);
    
    const updatedConfig = manager.getConfig();
    expect(updatedConfig.servers).toHaveLength(1);
    expect(updatedConfig.servers[0].name).toBe('Test Server');

    // Verify file written
    const fileContent = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf-8'));
    expect(fileContent.servers).toHaveLength(1);
  });
});
