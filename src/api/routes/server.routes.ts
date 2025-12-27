import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hubManager } from '../../services/hub-manager.service.js';
import { McpServerConfigSchema } from '../../config/config.schema.js';

export async function serverRoutes(fastify: FastifyInstance) {
  // GET /api/servers
  fastify.get('/api/servers', async (request, reply) => {
    return hubManager.getAllServers();
  });

  // GET /api/servers/:id
  fastify.get<{ Params: { id: string } }>('/api/servers/:id', async (request, reply) => {
    const server = hubManager.getServerById(request.params.id);
    if (!server) {
      return reply.code(404).send({ error: 'Server not found' });
    }
    return server;
  });

  // POST /api/servers
  fastify.post('/api/servers', async (request, reply) => {
    try {
      const body = McpServerConfigSchema.parse(request.body);
      const newServer = hubManager.addServer(body);
      return reply.code(201).send(newServer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.issues });
      }
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // PUT /api/servers/:id
  fastify.put<{ Params: { id: string } }>('/api/servers/:id', async (request, reply) => {
    try {
      // Allow partial updates, but strip ID from body or ensure it matches
      const partialSchema = McpServerConfigSchema.partial().omit({ id: true });
      const body = partialSchema.parse(request.body);
      
      const updatedServer = hubManager.updateServer(request.params.id, body);
      
      if (!updatedServer) {
        return reply.code(404).send({ error: 'Server not found' });
      }
      
      return updatedServer;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.issues });
      }
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // DELETE /api/servers/:id
  fastify.delete<{ Params: { id: string } }>('/api/servers/:id', async (request, reply) => {
    const success = hubManager.removeServer(request.params.id);
    if (!success) {
        return reply.code(404).send({ error: 'Server not found' });
    }
    return reply.code(204).send();
  });
}
