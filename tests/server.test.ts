import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { webServerRoutes } from '@api/web/servers.js';
import { hubManager } from '@services/hub-manager.service.js';

// Mock hubManager
vi.mock('@services/hub-manager.service.js', () => ({
  hubManager: {
    getAllServers: vi.fn(),
    getServerById: vi.fn(),
    getServerByName: vi.fn(),
    addServer: vi.fn(),
    updateServer: vi.fn(),
    removeServer: vi.fn(),
    addServerInstance: vi.fn().mockResolvedValue({}),
    getServerInstancesByName: vi.fn()
  }
}));

describe('Server API Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    app.register(webServerRoutes);
    await app.ready();
    vi.clearAllMocks();
  });

  afterEach(() => {
    app.close();
  });

  it('GET /api/servers should return all servers', async () => {
    const mockServers = [
      {
        name: 'test',
        config: {
          template: {
            type: 'stdio' as const,
            command: 'test',
            args: [],
            env: {},
            headers: {},
            aggregatedTools: [],
            timeout: 30000,
            tags: {}
          },
          instances: [],
          tagDefinitions: []
        }
      }
    ];
    vi.mocked(hubManager.getAllServers).mockReturnValue(mockServers);

    const response = await app.inject({
      method: 'GET',
      url: '/web/servers'
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual(mockServers);
  });

  it('POST /api/servers should add a server', async () => {
    const newServer = {
      name: 'New Server',
      config: {
        command: 'node',
        args: [],
        env: {},
        headers: {},
        aggregatedTools: []
      }
    };
    const createdServer = {
      template: {
        type: 'stdio' as const,
        command: 'node',
        args: [],
        env: {},
        headers: {},
        aggregatedTools: [],
        timeout: 30000,
        tags: {}
      },
      instances: [],
      tagDefinitions: []
    };

    vi.mocked(hubManager.addServer).mockReturnValue(Promise.resolve(createdServer));

    const response = await app.inject({
      method: 'POST',
      url: '/web/servers',
      payload: newServer
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.payload)).toEqual({
      name: newServer.name,
      config: createdServer
    });
  });

  it('POST /api/servers should validate input', async () => {
    const invalidServer = {
      name: '', // Empty name invalid
      command: 'node'
    };

    const response = await app.inject({
      method: 'POST',
      url: '/web/servers',
      payload: invalidServer
    });

    expect(response.statusCode).toBe(400);
  });
});
