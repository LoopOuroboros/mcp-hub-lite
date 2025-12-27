import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { serverRoutes } from '../src/api/routes/server.routes.js';
import { hubManager } from '../src/services/hub-manager.service.js';

// Mock hubManager
vi.mock('../src/services/hub-manager.service.js', () => ({
  hubManager: {
    getAllServers: vi.fn(),
    getServerById: vi.fn(),
    addServer: vi.fn(),
    updateServer: vi.fn(),
    removeServer: vi.fn(),
  }
}));

describe('Server API Routes', () => {
  let app: any;

  beforeEach(async () => {
    app = Fastify();
    app.register(serverRoutes);
    await app.ready();
    vi.clearAllMocks();
  });

  afterEach(() => {
    app.close();
  });

  it('GET /api/servers should return all servers', async () => {
    const mockServers = [{ id: '1', name: 'test' }];
    vi.mocked(hubManager.getAllServers).mockReturnValue(mockServers as any);

    const response = await app.inject({
      method: 'GET',
      url: '/api/servers'
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual(mockServers);
  });

  it('POST /api/servers should add a server', async () => {
    const newServer = { 
        name: 'New Server', 
        command: 'node', 
        args: [], 
        env: {},
        enabled: true
    };
    const createdServer = { ...newServer, id: 'uuid' };
    
    vi.mocked(hubManager.addServer).mockReturnValue(createdServer as any);

    const response = await app.inject({
      method: 'POST',
      url: '/api/servers',
      payload: newServer
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.payload)).toEqual(createdServer);
  });

  it('POST /api/servers should validate input', async () => {
    const invalidServer = { 
        name: '', // Empty name invalid
        command: 'node'
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/servers',
      payload: invalidServer
    });

    expect(response.statusCode).toBe(400);
  });
});
