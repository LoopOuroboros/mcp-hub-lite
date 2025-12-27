import { FastifyInstance } from 'fastify';
import { mcpConnectionManager } from '../../services/mcp-connection.manager.js';
import { simpleSearchService } from '../../services/simple-search.service.js';
import { hubManager } from '../../services/hub-manager.service.js';

export async function mcpRoutes(fastify: FastifyInstance) {
  // GET /api/mcp/status
  // Returns status of all servers
  fastify.get('/api/mcp/status', async (request, reply) => {
    const servers = hubManager.getAllServers();
    const result = servers.map(s => ({
      id: s.id,
      name: s.name,
      status: mcpConnectionManager.getStatus(s.id) || {
        connected: false,
        lastCheck: 0,
        toolsCount: 0
      }
    }));
    return result;
  });

  // POST /api/mcp/servers/:id/connect
  fastify.post<{ Params: { id: string } }>('/api/mcp/servers/:id/connect', async (request, reply) => {
    const server = hubManager.getServerById(request.params.id);
    if (!server) {
      return reply.code(404).send({ error: 'Server not found' });
    }
    const success = await mcpConnectionManager.connect(server);
    if (!success) {
      return reply.code(500).send({ error: 'Failed to connect' });
    }
    return { success: true };
  });

  // POST /api/mcp/servers/:id/disconnect
  fastify.post<{ Params: { id: string } }>('/api/mcp/servers/:id/disconnect', async (request, reply) => {
    await mcpConnectionManager.disconnect(request.params.id);
    return { success: true };
  });

  // POST /api/mcp/servers/:id/refresh
  fastify.post<{ Params: { id: string } }>('/api/mcp/servers/:id/refresh', async (request, reply) => {
    try {
        const tools = await mcpConnectionManager.refreshTools(request.params.id);
        return { success: true, count: tools.length };
    } catch (e) {
        return reply.code(500).send({ error: String(e) });
    }
  });

  // GET /api/tools/search
  fastify.get<{ Querystring: { q: string } }>('/api/tools/search', async (request, reply) => {
    const query = request.query.q || '';
    const results = simpleSearchService.search(query);
    return results;
  });

  // GET /api/servers/:id/tools
  fastify.get<{ Params: { id: string } }>('/api/servers/:id/tools', async (request, reply) => {
      const tools = mcpConnectionManager.getTools(request.params.id);
      return tools;
  });
}
