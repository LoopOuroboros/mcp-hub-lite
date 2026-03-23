import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveConfig } from '@config/config-saver.js';
import * as fs from 'fs';
import path from 'path';

// Mock fs module
vi.mock('fs');
vi.mock('path');

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
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        testConfigPath,
        JSON.stringify(config, null, 2)
      );
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
  });

  describe('empty value cleaning', () => {
    it('should remove empty string fields', () => {
      const config = {
        version: '1.1.0',
        emptyField: '',
        nonEmptyField: 'value'
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual({
        version: '1.1.0',
        nonEmptyField: 'value'
      });
      expect(writtenContent.emptyField).toBeUndefined();
    });

    it('should remove empty array fields', () => {
      const config = {
        version: '1.1.0',
        emptyArray: [],
        nonEmptyArray: [1, 2, 3]
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual({
        version: '1.1.0',
        nonEmptyArray: [1, 2, 3]
      });
      expect(writtenContent.emptyArray).toBeUndefined();
    });

    it('should remove empty object fields', () => {
      const config = {
        version: '1.1.0',
        emptyObject: {},
        nonEmptyObject: { key: 'value' }
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual({
        version: '1.1.0',
        nonEmptyObject: { key: 'value' }
      });
      expect(writtenContent.emptyObject).toBeUndefined();
    });

    it('should remove null and undefined fields', () => {
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
        validField: 'value'
      });
      expect(writtenContent.nullField).toBeUndefined();
      expect(writtenContent.undefinedField).toBeUndefined();
    });

    it('should always preserve version field even if empty', () => {
      const config = {
        version: '1.1.0',
        emptyVersion: '',
        system: {}
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent.version).toBe('1.1.0');
    });

    it('should recursively clean nested objects', () => {
      const config = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 7788,
          emptyNested: {},
          emptyString: ''
        },
        security: {
          emptyArray: [],
          maxConnections: 50
        }
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual({
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 7788
        },
        security: {
          maxConnections: 50
        }
      });
    });

    it('should handle arrays with empty values', () => {
      const config = {
        version: '1.1.0',
        arrayWithEmpty: [1, '', null, undefined, {}, 'valid']
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual({
        version: '1.1.0',
        arrayWithEmpty: [1, 'valid']
      });
    });

    it('should preserve business fields like type and timeout', () => {
      const config = {
        version: '1.1.0',
        servers: {
          'test-server': {
            type: 'stdio',
            timeout: 60000,
            command: 'npx test',
            args: [],
            env: {},
            tags: {}
          }
        }
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent.servers['test-server'].type).toBe('stdio');
      expect(writtenContent.servers['test-server'].timeout).toBe(60000);
      expect(writtenContent.servers['test-server'].command).toBe('npx test');
      expect(writtenContent.servers['test-server'].args).toBeUndefined();
      expect(writtenContent.servers['test-server'].env).toBeUndefined();
      expect(writtenContent.servers['test-server'].tags).toBeUndefined();
    });

    it('should write empty object if everything is cleaned except version', () => {
      const config = {
        version: '1.1.0',
        emptyField: '',
        anotherEmpty: {}
      };

      saveConfig(testConfigPath, config);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual({
        version: '1.1.0'
      });
    });

    it('should handle complex real-world configuration', () => {
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
            command: 'npx my-server',
            args: [],
            env: {},
            enabled: true,
            type: 'stdio',
            timeout: 60000,
            allowedTools: [],
            tags: {}
          }
        },
        emptySection: {}
      };

      saveConfig(testConfigPath, realConfig);

      const writtenContent = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string);
      expect(writtenContent).toEqual({
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 7788,
          language: 'zh',
          theme: 'system',
          logging: {
            level: 'info',
            rotationAge: '7d'
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000
        },
        servers: {
          'my-server': {
            command: 'npx my-server',
            enabled: true,
            type: 'stdio',
            timeout: 60000
          }
        }
      });
    });
  });
});
