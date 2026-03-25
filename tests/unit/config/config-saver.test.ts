import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveConfig } from '@config/config-saver.js';
import * as fs from 'fs';
import path from 'path';

// Mock fs module
vi.mock('fs');
vi.mock('path');
vi.mock('@utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn()
  }
}));

describe('ConfigSaver', () => {
  const mockFs = vi.mocked(fs);
  const mockPath = vi.mocked(path);
  const testConfigPath = '/test/path/.mcp-hub.json';
  const testDir = '/test/path';

  beforeEach(() => {
    vi.clearAllMocks();
    mockPath.dirname.mockReturnValue(testDir);
    mockFs.existsSync.mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('saveConfig', () => {
    it('should save configuration to disk', () => {
      const config = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 7788
        }
      };

      saveConfig(testConfigPath, config);

      expect(mockPath.dirname).toHaveBeenCalledWith(testConfigPath);
      expect(mockFs.existsSync).toHaveBeenCalledWith(testDir);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(testConfigPath, JSON.stringify(config));
    });

    it('should create directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      const config = { version: '1.1.0' };

      saveConfig(testConfigPath, config);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(testDir, { recursive: true });
    });

    it('should ignore errors during save', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });
      const config = { version: '1.1.0' };

      expect(() => saveConfig(testConfigPath, config)).not.toThrow();
    });

    it('should preserve empty string fields', () => {
      const config = {
        version: '1.1.0',
        emptyField: '',
        nonEmptyField: 'value'
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual(config);
    });

    it('should preserve empty array fields', () => {
      const config = {
        version: '1.1.0',
        emptyArray: [],
        nonEmptyArray: [1, 2, 3]
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual(config);
    });

    it('should preserve empty object fields', () => {
      const config = {
        version: '1.1.0',
        emptyObject: {},
        nonEmptyObject: { key: 'value' }
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual(config);
    });

    it('should preserve null and undefined fields', () => {
      const config = {
        version: '1.1.0',
        nullField: null,
        undefinedField: undefined,
        validField: 'value'
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual({
        version: '1.1.0',
        nullField: null,
        validField: 'value'
      });
    });

    it('should preserve nested empty objects and arrays', () => {
      const config = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 7788,
          emptyNested: {},
          emptyString: '',
          emptyArray: []
        },
        security: {
          emptyArray: [],
          maxConnections: 50
        }
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual(config);
    });

    it('should preserve server configuration with empty collections', () => {
      const config = {
        version: '1.1.0',
        servers: {
          'test-server': {
            template: {
              type: 'stdio',
              timeout: 60000,
              command: 'npx test',
              args: [],
              env: {},
              headers: {},
              aggregatedTools: []
            },
            instances: [
              {
                id: 'instance-1',
                enabled: true,
                args: [],
                env: {},
                headers: {},
                tags: {}
              }
            ]
          }
        }
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual(config);
    });

    it('should handle complex real-world configuration with empty values', () => {
      const realConfig = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 7788,
          language: 'zh',
          theme: 'system',
          logging: {
            level: 'info',
            rotationAge: '7d',
            extraField: '',
            debugOptions: {}
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          emptyConfig: []
        },
        servers: {
          'my-server': {
            template: {
              command: 'npx my-server',
              args: [],
              env: {},
              headers: {},
              timeout: 60000,
              aggregatedTools: [],
              type: 'stdio'
            },
            instances: [
              {
                id: 'default',
                enabled: true,
                args: [],
                env: {},
                headers: {},
                tags: {}
              }
            ]
          }
        },
        emptySection: {}
      };

      saveConfig(testConfigPath, realConfig);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual(realConfig);
    });
  });
});
