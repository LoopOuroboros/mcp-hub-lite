import { describe, it, expect } from 'vitest';
import { TransportFactory } from '../../../src/utils/transports/transport-factory.js';

describe('TransportFactory', () => {
  describe('isPythonCommand', () => {
    it('should detect python commands', () => {
      expect(TransportFactory['isPythonCommand']('python')).toBe(true);
      expect(TransportFactory['isPythonCommand']('python3')).toBe(true);
      expect(TransportFactory['isPythonCommand']('Python')).toBe(true);
      expect(TransportFactory['isPythonCommand']('/usr/bin/python3')).toBe(true);
      expect(TransportFactory['isPythonCommand']('C:\\Python39\\python.exe')).toBe(true);
    });

    it('should detect uv and uvx commands', () => {
      expect(TransportFactory['isPythonCommand']('uv')).toBe(true);
      expect(TransportFactory['isPythonCommand']('uvx')).toBe(true);
      expect(TransportFactory['isPythonCommand']('UV')).toBe(true);
      expect(TransportFactory['isPythonCommand']('/usr/bin/uvx')).toBe(true);
    });

    it('should detect py commands', () => {
      expect(TransportFactory['isPythonCommand']('py')).toBe(true);
      expect(TransportFactory['isPythonCommand']('PY')).toBe(true);
      expect(TransportFactory['isPythonCommand']('py -3')).toBe(true);
    });

    it('should not detect non-python commands', () => {
      expect(TransportFactory['isPythonCommand']('node')).toBe(false);
      expect(TransportFactory['isPythonCommand']('npm')).toBe(false);
      expect(TransportFactory['isPythonCommand']('npx')).toBe(false);
      expect(TransportFactory['isPythonCommand']('java')).toBe(false);
      expect(TransportFactory['isPythonCommand']('go')).toBe(false);
      expect(TransportFactory['isPythonCommand']('rust')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(TransportFactory['isPythonCommand']('')).toBe(false);
      expect(TransportFactory['isPythonCommand']('   ')).toBe(false);
      expect(TransportFactory['isPythonCommand']('my-python-tool')).toBe(true); // contains 'python'
    });
  });

  describe('buildSystemEnv', () => {
    it('should add PYTHONUTF8=1 for python commands', () => {
      const env = TransportFactory['buildSystemEnv']('python');
      expect(env.PYTHONUTF8).toBe('1');
    });

    it('should add PYTHONUTF8=1 for uv commands', () => {
      const env = TransportFactory['buildSystemEnv']('uvx');
      expect(env.PYTHONUTF8).toBe('1');
    });

    it('should not add PYTHONUTF8 for non-python commands', () => {
      const env = TransportFactory['buildSystemEnv']('node');
      expect(env.PYTHONUTF8).toBeUndefined();
    });

    it('should return empty object for undefined command', () => {
      const env = TransportFactory['buildSystemEnv'](undefined);
      expect(Object.keys(env)).toHaveLength(0);
    });
  });
});
