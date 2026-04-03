import { describe, it, expect } from 'vitest';
import {
  sortObjectKeys,
  sortObjectKeysCaseInsensitive,
  sortObjectKeysDeep,
  sortServerConfigEnvHeaders
} from '@utils/sort-utils.js';

describe('sort-utils', () => {
  describe('sortObjectKeys', () => {
    it('should sort object keys alphabetically using localeCompare', () => {
      const obj = {
        zebra: 'value3',
        apple: 'value1',
        banana: 'value2'
      };
      const result = sortObjectKeys(obj);
      expect(Object.keys(result)).toEqual(['apple', 'banana', 'zebra']);
      expect(result).toEqual({
        apple: 'value1',
        banana: 'value2',
        zebra: 'value3'
      });
    });

    it('should return the same object if input is null or undefined', () => {
      expect(sortObjectKeys(null as any)).toBe(null);
      expect(sortObjectKeys(undefined as any)).toBe(undefined);
    });

    it('should return the same object if input is an array', () => {
      const arr = [3, 1, 2];
      expect(sortObjectKeys(arr as any)).toBe(arr);
    });

    it('should return the same object if input is not an object', () => {
      expect(sortObjectKeys('string' as any)).toBe('string');
      expect(sortObjectKeys(42 as any)).toBe(42);
      expect(sortObjectKeys(true as any)).toBe(true);
    });

    it('should preserve the original object (return a new object)', () => {
      const obj = {
        zebra: 'value3',
        apple: 'value1'
      };
      const result = sortObjectKeys(obj);
      expect(result).not.toBe(obj);
      expect(obj).toEqual({
        zebra: 'value3',
        apple: 'value1'
      });
    });

    it('should handle empty object', () => {
      expect(sortObjectKeys({})).toEqual({});
    });
  });

  describe('sortObjectKeysCaseInsensitive', () => {
    it('should sort object keys alphabetically, case-insensitive', () => {
      const obj = {
        Zebra: 'value3',
        apple: 'value1',
        Banana: 'value2'
      };
      const result = sortObjectKeysCaseInsensitive(obj);
      expect(Object.keys(result)).toEqual(['apple', 'Banana', 'Zebra']);
      expect(result).toEqual({
        apple: 'value1',
        Banana: 'value2',
        Zebra: 'value3'
      });
    });

    it('should preserve original key case', () => {
      const obj = {
        CONTENT_TYPE: 'application/json',
        Authorization: 'Bearer token',
        accept: 'text/plain'
      };
      const result = sortObjectKeysCaseInsensitive(obj);
      expect(Object.keys(result)).toEqual(['accept', 'Authorization', 'CONTENT_TYPE']);
      expect(result.accept).toBe('text/plain');
      expect(result.Authorization).toBe('Bearer token');
      expect(result.CONTENT_TYPE).toBe('application/json');
    });

    it('should return the same object if input is null or undefined', () => {
      expect(sortObjectKeysCaseInsensitive(null as any)).toBe(null);
      expect(sortObjectKeysCaseInsensitive(undefined as any)).toBe(undefined);
    });
  });

  describe('sortObjectKeysDeep', () => {
    it('should recursively sort all object keys in a nested structure', () => {
      const obj = {
        zebra: {
          delta: 'value4',
          alpha: 'value1'
        },
        apple: {
          charlie: 'value3',
          bravo: 'value2'
        }
      };
      const result = sortObjectKeysDeep(obj);
      expect(Object.keys(result)).toEqual(['apple', 'zebra']);
      expect(Object.keys(result.apple)).toEqual(['bravo', 'charlie']);
      expect(Object.keys(result.zebra)).toEqual(['alpha', 'delta']);
    });

    it('should handle arrays and recursively sort objects within arrays', () => {
      const obj = {
        items: [
          { zebra: 'value3', apple: 'value1' },
          { delta: 'value4', alpha: 'value1' }
        ]
      };
      const result = sortObjectKeysDeep(obj);
      expect(Array.isArray(result.items)).toBe(true);
      expect(Object.keys(result.items[0])).toEqual(['apple', 'zebra']);
      expect(Object.keys(result.items[1])).toEqual(['alpha', 'delta']);
    });

    it('should handle mixed types in nested structure', () => {
      const obj = {
        number: 42,
        string: 'hello',
        boolean: true,
        array: [1, 2, 3],
        object: {
          nested: {
            z: 'last',
            a: 'first'
          }
        }
      };
      const result = sortObjectKeysDeep(obj);
      expect(Object.keys(result)).toEqual(['array', 'boolean', 'number', 'object', 'string']);
      expect(Object.keys(result.object.nested)).toEqual(['a', 'z']);
    });
  });

  describe('sortServerConfigEnvHeaders', () => {
    it('should sort env and headers objects in a server configuration', () => {
      const config = {
        env: {
          NODE_ENV: 'production',
          API_KEY: 'secret',
          DEBUG: 'false'
        },
        headers: {
          'X-Custom-Header': 'value',
          Authorization: 'Bearer token',
          'Content-Type': 'application/json'
        },
        otherField: 'should not be affected'
      };
      const result = sortServerConfigEnvHeaders(config);
      expect(Object.keys(result.env)).toEqual(['API_KEY', 'DEBUG', 'NODE_ENV']);
      expect(Object.keys(result.headers)).toEqual([
        'Authorization',
        'Content-Type',
        'X-Custom-Header'
      ]);
      expect(result.otherField).toBe('should not be affected');
    });

    it('should handle case where env or headers is undefined', () => {
      const config1 = { headers: { Z: '1', A: '2' } } as {
        env?: Record<string, string>;
        headers?: Record<string, string>;
      };
      const result1 = sortServerConfigEnvHeaders(config1);
      expect(Object.keys(result1.headers!)).toEqual(['A', 'Z']);
      expect(result1.env).toBeUndefined();

      const config2 = { env: { Z: '1', A: '2' } } as {
        env?: Record<string, string>;
        headers?: Record<string, string>;
      };
      const result2 = sortServerConfigEnvHeaders(config2);
      expect(Object.keys(result2.env!)).toEqual(['A', 'Z']);
      expect(result2.headers).toBeUndefined();
    });

    it('should handle empty env or headers objects', () => {
      const config = {
        env: {},
        headers: {}
      };
      const result = sortServerConfigEnvHeaders(config);
      expect(result.env).toEqual({});
      expect(result.headers).toEqual({});
    });

    it('should preserve the original object structure', () => {
      const config = {
        env: { B: '2', A: '1' },
        headers: { Y: '2', X: '1' },
        command: 'npm start',
        args: ['--verbose']
      };
      const result = sortServerConfigEnvHeaders(config);
      expect(result.command).toBe('npm start');
      expect(result.args).toEqual(['--verbose']);
      expect(Object.keys(result.env)).toEqual(['A', 'B']);
      expect(Object.keys(result.headers)).toEqual(['X', 'Y']);
    });
  });

  describe('integration tests', () => {
    it('should work with realistic server configuration scenario', () => {
      const serverConfig = {
        type: 'stdio',
        command: 'npx mcp-server',
        args: ['--config', 'config.json'],
        env: {
          NODE_PATH: '/usr/local/lib/node_modules',
          PATH: '/usr/bin:/bin',
          HOME: '/home/user',
          DEBUG: 'mcp:*',
          API_KEY: 'sk-12345'
        },
        headers: {
          'User-Agent': 'MCP-Hub-Lite/1.0',
          Accept: 'application/json',
          Authorization: 'Bearer token123',
          'Content-Type': 'application/json'
        }
      };

      const result = sortServerConfigEnvHeaders(serverConfig);

      // Verify env is sorted case-insensitive
      expect(Object.keys(result.env)).toEqual(['API_KEY', 'DEBUG', 'HOME', 'NODE_PATH', 'PATH']);

      // Verify headers is sorted case-insensitive
      expect(Object.keys(result.headers)).toEqual([
        'Accept',
        'Authorization',
        'Content-Type',
        'User-Agent'
      ]);

      // Verify other fields are preserved
      expect(result.type).toBe('stdio');
      expect(result.command).toBe('npx mcp-server');
      expect(result.args).toEqual(['--config', 'config.json']);
    });
  });
});
