import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

// Use vi.hoisted to avoid hoisting issues with vi.mock
const { MockEventSource, mockFetch } = vi.hoisted(() => {
  class MockEventSource {
    static instances: MockEventSource[] = [];
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;

    url: string;
    options: Record<string, unknown>;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    onopen: (() => void) | null = null;
    private _readyState = 0;
    private eventListeners = new Map<string, ((event: MessageEvent) => void)[]>();

    constructor(url: string, options?: Record<string, unknown>) {
      this.url = url;
      this.options = options || {};
      MockEventSource.instances.push(this);
    }

    get readyState() {
      return this._readyState;
    }

    addEventListener(event: string, handler: (event: MessageEvent) => void) {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
      }
      this.eventListeners.get(event)!.push(handler);
    }

    removeEventListener(event: string, handler: (event: MessageEvent) => void) {
      const handlers = this.eventListeners.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }

    simulateEndpointEvent(endpointUrl: string) {
      const handlers = this.eventListeners.get('endpoint');
      if (handlers) {
        const event = new MessageEvent('endpoint', { data: endpointUrl });
        handlers.forEach((h) => h(event));
      }
    }

    simulateMessageEvent(data: unknown) {
      if (this.onmessage) {
        const event = new MessageEvent('message', { data: JSON.stringify(data) });
        this.onmessage(event);
      }
    }

    simulateError() {
      this.onerror?.();
    }

    close() {
      this._readyState = 2;
    }

    static reset() {
      MockEventSource.instances = [];
    }

    static getLastInstance(): MockEventSource | undefined {
      return MockEventSource.instances[MockEventSource.instances.length - 1];
    }
  }

  const mockFetch = vi.fn();

  return { MockEventSource, mockFetch };
});

vi.mock('eventsource', () => ({
  EventSource: MockEventSource
}));

vi.mock('undici', () => ({
  fetch: (...args: unknown[]) => mockFetch(...args),
  ProxyAgent: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('@utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('@utils/logger/log-modules.js', () => ({
  LOG_MODULES: {
    SSE_TRANSPORT: 'SSE_TRANSPORT'
  }
}));

// Import after mocks
import { SseTransport } from '@utils/transports/sse-transport.js';

describe('SseTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.reset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('constructor', () => {
    it('should create transport with default values', () => {
      const transport = new SseTransport('http://localhost:8000/sse');
      expect(transport).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const transport = new SseTransport(
        'http://localhost:8000/sse',
        { Authorization: 'Bearer token' },
        5000,
        10,
        { url: 'http://proxy:8080' },
        'test-server',
        'test-server-0',
        15000,
        false
      );
      expect(transport).toBeDefined();
    });
  });

  describe('start()', () => {
    it('should create EventSource connection', async () => {
      const transport = new SseTransport('http://localhost:8000/sse');
      await transport.start();

      const instance = MockEventSource.getLastInstance();
      expect(instance).toBeDefined();
      expect(instance?.url).toBe('http://localhost:8000/sse');
    });

    it('should throw if already started', async () => {
      const transport = new SseTransport('http://localhost:8000/sse');
      await transport.start();

      await expect(transport.start()).rejects.toThrow('SSE Transport already started!');
    });

    it('should listen for endpoint event', async () => {
      const transport = new SseTransport('http://localhost:8000/sse');
      await transport.start();

      const instance = MockEventSource.getLastInstance();
      expect(instance).toBeDefined();

      // Simulate endpoint event
      instance?.simulateEndpointEvent('/messages?session_id=abc123');

      // Transport should now have endpoint URL
      // We can verify by attempting to send (which would fail without endpoint)
    });

    it('should call onmessage when receiving JSON-RPC message', async () => {
      const transport = new SseTransport('http://localhost:8000/sse');
      const onmessage = vi.fn();
      transport.onmessage = onmessage;

      await transport.start();

      const instance = MockEventSource.getLastInstance();
      const testMessage: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        result: { tools: [] }
      };

      instance?.simulateMessageEvent(testMessage);

      expect(onmessage).toHaveBeenCalledWith(testMessage);
    });
  });

  describe('send()', () => {
    it('should wait for endpoint and POST message', async () => {
      const transport = new SseTransport(
        'http://localhost:8000/sse',
        {},
        3000,
        5,
        undefined,
        'test-server',
        undefined,
        10000,
        true
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      await transport.start();

      const instance = MockEventSource.getLastInstance();

      // Simulate endpoint event
      instance?.simulateEndpointEvent('/messages?session_id=abc123');

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      await transport.send(message);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/messages?session_id=abc123',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(message)
        })
      );
    });

    it('should timeout if endpoint not received', async () => {
      vi.useFakeTimers();

      const transport = new SseTransport(
        'http://localhost:8000/sse',
        {},
        3000,
        5,
        undefined,
        'test-server',
        undefined,
        100, // Very short timeout for test
        true
      );

      await transport.start();

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      const sendPromise = transport.send(message);

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(150);

      await expect(sendPromise).rejects.toThrow('SSE endpoint not received within timeout');

      vi.useRealTimers();
    });

    it('should throw on POST failure', async () => {
      const transport = new SseTransport('http://localhost:8000/sse');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error')
      });

      await transport.start();

      const instance = MockEventSource.getLastInstance();
      instance?.simulateEndpointEvent('/messages');

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      await expect(transport.send(message)).rejects.toThrow('POST to endpoint failed: 500');
    });

    it('should preserve query parameters from endpoint event', async () => {
      const transport = new SseTransport('http://localhost:8000/sse');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      await transport.start();

      const instance = MockEventSource.getLastInstance();
      instance?.simulateEndpointEvent('/messages?session_id=xyz789&token=abc');

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize'
      };

      await transport.send(message);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/messages?session_id=xyz789&token=abc',
        expect.anything()
      );
    });
  });

  describe('same-origin validation', () => {
    it('should reject endpoint from different origin when strictOriginCheck is true', async () => {
      const transport = new SseTransport(
        'http://localhost:8000/sse',
        {},
        3000,
        5,
        undefined,
        'test-server',
        undefined,
        10000,
        true // strictOriginCheck enabled
      );

      const onerror = vi.fn();
      transport.onerror = onerror;

      await transport.start();

      const instance = MockEventSource.getLastInstance();

      // Simulate endpoint from different origin
      instance?.simulateEndpointEvent('http://evil.com/messages');

      expect(onerror).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Endpoint origin mismatch')
        })
      );
    });

    it('should accept endpoint from different origin when strictOriginCheck is false', async () => {
      const transport = new SseTransport(
        'http://localhost:8000/sse',
        {},
        3000,
        5,
        undefined,
        'test-server',
        undefined,
        10000,
        false // strictOriginCheck disabled
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const onerror = vi.fn();
      transport.onerror = onerror;

      await transport.start();

      const instance = MockEventSource.getLastInstance();

      // Simulate endpoint from different origin
      instance?.simulateEndpointEvent('http://other-server.com/messages');

      expect(onerror).not.toHaveBeenCalled();

      // Should be able to send
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      await transport.send(message);

      expect(mockFetch).toHaveBeenCalledWith('http://other-server.com/messages', expect.anything());
    });

    it('should accept relative endpoint paths', async () => {
      const transport = new SseTransport('http://localhost:8000/sse');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      await transport.start();

      const instance = MockEventSource.getLastInstance();

      // Simulate relative endpoint
      instance?.simulateEndpointEvent('/api/messages');

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      await transport.send(message);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/messages',
        expect.anything()
      );
    });
  });

  describe('close()', () => {
    it('should close EventSource connection', async () => {
      const transport = new SseTransport('http://localhost:8000/sse');
      await transport.start();

      const instance = MockEventSource.getLastInstance();
      const closeSpy = vi.spyOn(instance!, 'close');

      await transport.close();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should reject pending send() calls', async () => {
      vi.useFakeTimers();

      const transport = new SseTransport(
        'http://localhost:8000/sse',
        {},
        3000,
        5,
        undefined,
        'test-server',
        undefined,
        10000,
        true
      );

      await transport.start();

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      // Start send (will wait for endpoint)
      const sendPromise = transport.send(message);

      // Close before endpoint arrives
      await transport.close();

      // Advance timers to let promises settle
      vi.advanceTimersByTime(100);

      await expect(sendPromise).rejects.toThrow('Transport closing');

      vi.useRealTimers();
    });

    it('should call onclose callback', async () => {
      const transport = new SseTransport('http://localhost:8000/sse');
      const onclose = vi.fn();
      transport.onclose = onclose;

      await transport.start();
      await transport.close();

      expect(onclose).toHaveBeenCalled();
    });
  });

  describe('reconnection', () => {
    it('should reset endpoint ready promise on reconnection', async () => {
      vi.useFakeTimers();

      const transport = new SseTransport(
        'http://localhost:8000/sse',
        {},
        100, // Short reconnect interval
        3,
        undefined,
        'test-server'
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      await transport.start();

      const firstInstance = MockEventSource.getLastInstance();

      // Simulate first endpoint
      firstInstance?.simulateEndpointEvent('/messages?session_id=first');

      // Simulate error to trigger reconnection
      firstInstance?.simulateError();

      // Advance timers to trigger reconnection
      vi.advanceTimersByTime(150);

      // Wait for async operations
      await vi.runAllTimersAsync();

      const secondInstance = MockEventSource.getLastInstance();
      expect(secondInstance).not.toBe(firstInstance);

      // Simulate new endpoint after reconnection
      secondInstance?.simulateEndpointEvent('/messages?session_id=second');

      // Send should use new endpoint
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      await transport.send(message);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/messages?session_id=second',
        expect.anything()
      );

      vi.useRealTimers();
    });
  });

  describe('concurrent send() calls', () => {
    it('should handle multiple concurrent send() calls waiting for endpoint', async () => {
      const transport = new SseTransport('http://localhost:8000/sse');

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      await transport.start();

      const instance = MockEventSource.getLastInstance();

      // Start multiple sends before endpoint arrives
      const messages: JSONRPCMessage[] = [
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        { jsonrpc: '2.0', id: 2, method: 'resources/list' },
        { jsonrpc: '2.0', id: 3, method: 'initialize' }
      ];

      const sendPromises = messages.map((m) => transport.send(m));

      // Simulate endpoint event
      instance?.simulateEndpointEvent('/messages');

      // All sends should complete
      await Promise.all(sendPromises);

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
