import { describe, it, expect } from 'vitest';
import { TransportFactory } from '../../../src/utils/transports/transport-factory.js';
import { StreamableHttpLocalTransport } from '../../../src/utils/transports/streamable-http-local-transport.js';

describe('TransportFactory', () => {
  describe('validateAndConvertConfig', () => {
    it('should convert streamable-http-local type correctly', () => {
      const config = TransportFactory['validateAndConvertConfig']({
        type: 'streamable-http-local',
        command: 'uvx',
        args: ['my-server', '--http', '--port', '3333'],
        url: 'http://localhost:3333/mcp',
        env: { NODE_ENV: 'test' },
        headers: { Authorization: 'Bearer test' },
        timeout: 15000,
        proxy: { url: 'http://proxy:8080' },
        name: 'test-server'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      expect(config.type).toBe('streamable-http-local');
      expect(config.command).toBe('uvx');
      expect(config.args).toEqual(['my-server', '--http', '--port', '3333']);
      expect(config.url).toBe('http://localhost:3333/mcp');
      expect(config.env?.NODE_ENV).toBe('test');
      expect(config.headers?.Authorization).toBe('Bearer test');
      expect(config.timeout).toBe(15000);
      expect(config.proxy).toEqual({ url: 'http://proxy:8080' });
    });

    it('should use defaults when fields are missing', () => {
      const config = TransportFactory['validateAndConvertConfig']({
        type: 'streamable-http-local' as const,
        name: 'minimal-server'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      expect(config.type).toBe('streamable-http-local');
      expect(config.command).toBe('');
      expect(config.args).toEqual([]);
      expect(config.url).toBe('');
      expect(config.timeout).toBe(30000);
    });
  });

  describe('createTransport', () => {
    it('should throw when command is missing for streamable-http-local', () => {
      expect(() =>
        TransportFactory.createTransport(
          {
            type: 'streamable-http-local' as const,
            url: 'http://localhost:3333/mcp',
            name: 'test'
          },
          'test-0'
        )
      ).toThrow('Streamable HTTP Local transport requires a command');
    });

    it('should throw when url is missing for streamable-http-local', () => {
      expect(() =>
        TransportFactory.createTransport(
          { type: 'streamable-http-local' as const, command: 'uvx', name: 'test' },
          'test-0'
        )
      ).toThrow('Streamable HTTP Local transport requires a URL');
    });

    it('should create StreamableHttpLocalTransport for streamable-http-local type', () => {
      const transport = TransportFactory.createTransport(
        {
          type: 'streamable-http-local' as const,
          command: 'uvx',
          url: 'http://localhost:3333/mcp',
          name: 'test-server'
        },
        'test-0'
      );

      expect(transport).toBeInstanceOf(StreamableHttpLocalTransport);
    });
  });

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
