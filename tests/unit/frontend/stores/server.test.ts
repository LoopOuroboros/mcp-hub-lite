import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useServerStore } from '@frontend/stores/server';

// Mock the http module at the top level
vi.mock('@frontend/utils/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('Server Store', () => {
  beforeEach(() => {
    // Create a new pinia instance for each test
    const pinia = createPinia();
    setActivePinia(pinia);

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up
  });

  it('should initialize with empty servers array', () => {
    const store = useServerStore();
    expect(store.servers).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('should have correct stats when no servers', () => {
    const store = useServerStore();
    expect(store.stats.total).toBe(0);
    expect(store.stats.online).toBe(0);
    expect(store.stats.errors).toBe(0);
  });

  it('should select server correctly', () => {
    const store = useServerStore();
    store.selectServer('test-id');
    expect(store.selectedServerId).toBe('test-id');
  });

  it('should fetch servers successfully', async () => {
    const store = useServerStore();

    // Mock the HTTP responses with v1.1 config format
    const mockServers = [
      {
        name: 'test-server',
        config: {
          template: { type: 'stdio' as const },
          instances: [{ id: 'instance-1', timestamp: 1234567890, hash: 'abc123' }]
        }
      }
    ];
    const mockStatuses = [
      { id: 'instance-1', status: { connected: true, toolsCount: 2, resourcesCount: 1 } }
    ];

    // Import the actual http module to access its methods
    const { http } = await import('@frontend/utils/http');

    // Mock the implementations
    vi.mocked(http.get).mockImplementation((url: string) => {
      if (url === '/web/servers') return Promise.resolve(mockServers);
      if (url === '/web/mcp/status') return Promise.resolve(mockStatuses);
      return Promise.reject(new Error('Unknown URL'));
    });

    await store.fetchServers();

    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.servers.length).toBe(1);
    const firstServer = store.servers[0]!;
    expect(firstServer.name).toBe('test-server');
    expect(firstServer.status).toBe('online');
    expect(firstServer.rawV11Config).toBeDefined();
  });

  it('should handle fetch servers error', async () => {
    const store = useServerStore();

    const { http } = await import('@frontend/utils/http');
    vi.mocked(http.get).mockImplementation(() => Promise.reject(new Error('Network error')));

    await store.fetchServers();

    expect(store.loading).toBe(false);
    expect(store.error).toBe('Network error');
  });

  it('should add server successfully', async () => {
    const store = useServerStore();

    const { http } = await import('@frontend/utils/http');

    // Mock the HTTP responses with v1.1 config format
    vi.mocked(http.post).mockImplementation((url: string) => {
      if (url === '/web/servers') {
        return Promise.resolve({
          name: 'new-server',
          config: { template: { type: 'stdio' as const }, instances: [] }
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    vi.mocked(http.get).mockImplementation((url: string) => {
      if (url === '/web/servers')
        return Promise.resolve([
          {
            name: 'new-server',
            config: { template: { type: 'stdio' as const }, instances: [] }
          }
        ]);
      if (url === '/web/mcp/status') return Promise.resolve([]);
      return Promise.reject(new Error('Unknown URL'));
    });

    await store.addServer({ name: 'new-server', config: { type: 'stdio' } });

    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(http.post).toHaveBeenCalledWith('/web/servers', {
      name: 'new-server',
      config: { type: 'stdio' }
    });
  });

  it('should handle add server error', async () => {
    const store = useServerStore();

    const { http } = await import('@frontend/utils/http');
    vi.mocked(http.post).mockImplementation(() => Promise.reject(new Error('Server error')));

    await expect(store.addServer({ name: 'test', config: { type: 'stdio' } })).rejects.toThrow(
      'Server error'
    );

    expect(store.loading).toBe(false);
    expect(store.error).toBe('Server error');
  });

  it('should update server status correctly', () => {
    const store = useServerStore();

    // Add a mock server
    store.servers = [
      {
        id: 'test-id',
        name: 'test-server',
        status: 'offline',
        type: 'local',
        config: { type: 'stdio' },
        instance: { id: 'test-id', timestamp: 1234567890 },
        logs: []
      }
    ];

    store.updateServerStatus('test-id', 'online');

    expect(store.servers[0]!.status).toBe('online');
  });

  it('should compute stats correctly with mixed server statuses', () => {
    const store = useServerStore();

    store.servers = [
      {
        id: 'server-1',
        name: 'Running Server',
        status: 'online',
        type: 'local',
        config: { type: 'stdio' },
        instance: { id: 'server-1', timestamp: 1234567890 },
        logs: []
      },
      {
        id: 'server-2',
        name: 'Stopped Server',
        status: 'offline',
        type: 'local',
        config: { type: 'stdio' },
        instance: { id: 'server-2', timestamp: 1234567890 },
        logs: []
      },
      {
        id: 'server-3',
        name: 'Error Server',
        status: 'error',
        type: 'local',
        config: { type: 'stdio' },
        instance: { id: 'server-3', timestamp: 1234567890 },
        logs: []
      }
    ];

    expect(store.stats.total).toBe(3);
    expect(store.stats.online).toBe(1);
    expect(store.stats.errors).toBe(1);
  });
});
