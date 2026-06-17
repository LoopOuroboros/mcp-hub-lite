import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { PassThrough } from 'node:stream';

// Mock ProcessLauncher
const mockProcessStderr = new PassThrough();
// eslint-disable-next-line no-var
var mockLaunchedProcess = {
  pid: 12345,
  stderr: mockProcessStderr,
  stop: vi.fn()
};

vi.mock('@utils/process-launcher.js', () => ({
  ProcessLauncher: {
    launch: vi.fn(() => mockLaunchedProcess),
    waitForReady: vi.fn(() => Promise.resolve()),
    waitForPort: vi.fn(() => Promise.resolve())
  }
}));

// Mock StreamableHTTPClientTransport
// eslint-disable-next-line no-var
var mockHttpTransport = {
  start: vi.fn(),
  close: vi.fn(),
  send: vi.fn(),
  onmessage: undefined as ((msg: unknown) => void) | undefined,
  onerror: undefined as ((err: Error) => void) | undefined,
  onclose: undefined as (() => void) | undefined
};

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StreamableHTTPClientTransport: vi.fn(function (this: any) {
    Object.assign(this, mockHttpTransport);
  })
}));

import { StreamableHttpLocalTransport } from '../../../src/utils/transports/streamable-http-local-transport.js';
import { ProcessLauncher } from '@utils/process-launcher.js';

describe('StreamableHttpLocalTransport', () => {
  let transport: StreamableHttpLocalTransport;
  let origSetTimeout: typeof setTimeout;

  beforeAll(() => {
    origSetTimeout = global.setTimeout;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock setTimeout: if delay >= 4000 (the 5s startup delay), call immediately
    global.setTimeout = ((fn: (...args: unknown[]) => void, ms?: number) => {
      if (ms && ms >= 4000) {
        fn();
        return 0 as unknown as NodeJS.Timeout;
      }
      return origSetTimeout(fn, ms);
    }) as typeof setTimeout;
    transport = new StreamableHttpLocalTransport(
      'uvx',
      ['my-server', '--http', '--port', '3333'],
      { NODE_ENV: 'test' },
      'http://localhost:3333/mcp',
      {},
      30000,
      undefined,
      undefined,
      'test-server',
      'test-0',
      ['listening on'],
      5000
    );
  });

  afterEach(async () => {
    global.setTimeout = origSetTimeout;
    try {
      await transport.close();
    } catch {
      // ignore cleanup errors
    }
  });

  describe('construction', () => {
    it('should not have pid before start', () => {
      expect(transport.pid).toBeUndefined();
    });

    it('should return null stderr before start', () => {
      expect(transport.stderr).toBeNull();
    });
  });

  describe('start()', () => {
    it('should delegate process launch to ProcessLauncher and connect via HTTP', async () => {
      const { StreamableHTTPClientTransport: MockHt } =
        await import('@modelcontextprotocol/sdk/client/streamableHttp.js');

      await transport.start();

      expect(ProcessLauncher.launch).toHaveBeenCalledWith({
        command: 'uvx',
        args: ['my-server', '--http', '--port', '3333'],
        env: { NODE_ENV: 'test' }
      });
      expect(ProcessLauncher.waitForReady).toHaveBeenCalled();
      expect(ProcessLauncher.waitForPort).toHaveBeenCalled();
      expect(MockHt).toHaveBeenCalled();
      expect(mockHttpTransport.start).toHaveBeenCalled();
      expect(transport.pid).toBe(12345);
    });

    it('should throw if already started', async () => {
      await transport.start();
      await expect(transport.start()).rejects.toThrow(
        'Streamable HTTP Local Transport already started'
      );
    });

    it('should stop process if waitForReady fails', async () => {
      (ProcessLauncher.waitForReady as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('ready timeout')
      );

      await expect(transport.start()).rejects.toThrow('ready timeout');
      expect(mockLaunchedProcess.stop).toHaveBeenCalled();
    });

    it('should skip ready detection when no patterns configured', async () => {
      const noPatternTransport = new StreamableHttpLocalTransport(
        'uvx',
        [],
        {},
        'http://localhost:3000',
        {},
        30000,
        undefined,
        undefined,
        'test'
      );

      await noPatternTransport.start();
      expect(ProcessLauncher.waitForReady).not.toHaveBeenCalled();
      expect(ProcessLauncher.waitForPort).toHaveBeenCalled();
      expect(mockHttpTransport.start).toHaveBeenCalled();
    });
  });

  describe('send()', () => {
    it('should delegate to HTTP transport', async () => {
      await transport.start();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message: any = { jsonrpc: '2.0', id: 1, method: 'test' };
      await transport.send(message);

      expect(mockHttpTransport.send).toHaveBeenCalledWith(message);
    });

    it('should throw if not started', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message: any = { jsonrpc: '2.0', id: 1, method: 'test' };
      await expect(transport.send(message)).rejects.toThrow('HTTP transport not started');
    });

    it('should throw if closing', async () => {
      await transport.start();
      await transport.close();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message: any = { jsonrpc: '2.0', id: 1, method: 'test' };
      await expect(transport.send(message)).rejects.toThrow('Transport is closing');
    });
  });

  describe('close()', () => {
    it('should close HTTP transport and stop process', async () => {
      await transport.start();
      await transport.close();

      expect(mockHttpTransport.close).toHaveBeenCalled();
      expect(mockLaunchedProcess.stop).toHaveBeenCalled();
    });

    it('should be idempotent', async () => {
      await transport.start();
      await transport.close();
      const stopCount = mockLaunchedProcess.stop.mock.calls.length;

      await transport.close();
      expect(mockLaunchedProcess.stop.mock.calls.length).toBe(stopCount);
    });

    it('should call onclose when fully closed', async () => {
      const onclose = vi.fn();
      transport.onclose = onclose;

      await transport.start();
      await transport.close();
      expect(onclose).toHaveBeenCalled();
    });
  });

  describe('stderr forwarding', () => {
    it('should call onstderr callback with process stderr data', async () => {
      const onstderr = vi.fn();
      transport.onstderr = onstderr;

      await transport.start();
      mockProcessStderr.write(Buffer.from('some log output\n'));

      // Wait a tick for async event processing
      await new Promise((resolve) => origSetTimeout(resolve, 10));
      expect(onstderr).toHaveBeenCalledWith('some log output');
    });
  });
});
