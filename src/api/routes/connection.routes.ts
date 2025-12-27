import { FastifyInstance } from 'fastify';
import { mcpConnectionManager } from '../../services/mcp-connection.manager.js';
import { hubManager } from '../../services/hub-manager.service.js';

export async function connectionRoutes(fastify: FastifyInstance) {
  // GET /api/connections
  fastify.get('/api/connections', async (request, reply) => {
    const servers = hubManager.getAllServers();
    const statuses = servers.map(s => {
      const status = mcpConnectionManager.getStatus(s.id);
      return {
        id: s.id,
        name: s.name,
        connected: status?.connected || false,
        error: status?.error,
        toolsCount: status?.toolsCount || 0,
        lastCheck: status?.lastCheck
      };
    });
    return statuses;
  });

  // POST /api/connections/:id/connect
  fastify.post<{ Params: { id: string } }>('/api/connections/:id/connect', async (request, reply) => {
    const server = hubManager.getServerById(request.params.id);
    if (!server) return reply.code(404).send({ error: 'Server not found' });
    
    const success = await mcpConnectionManager.connect(server);
    if (success) {
      return { success: true };
    } else {
      const status = mcpConnectionManager.getStatus(server.id);
      return reply.code(500).send({ error: 'Connection failed', details: status?.error });
    }
  });

  // POST /api/connections/:id/disconnect
  fastify.post<{ Params: { id: string } }>('/api/connections/:id/disconnect', async (request, reply) => {
    await mcpConnectionManager.disconnect(request.params.id);
    return { success: true };
  });
}
