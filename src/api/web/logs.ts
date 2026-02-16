import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { logStorage } from '@services/log-storage.service.js';
import type { LogEntry } from '@shared-models/server.model.js';
import type { LogLevel } from '@shared-types/common.types.js';

/**
 * Server Logs API Routes
 *
 * Provides comprehensive logging endpoints for monitoring and debugging MCP server operations.
 * This module enables real-time log streaming, historical log retrieval, and log management
 * across all connected MCP servers.
 *
 * The logging system supports multiple log levels (debug, info, warn, error), pagination,
 * filtering by timestamp, and real-time Server-Sent Events (SSE) streaming for live monitoring.
 * Logs are stored per-server and can be retrieved individually or aggregated across all servers.
 *
 * Key features include:
 * - Per-server log retrieval with filtering and pagination
 * - Real-time log streaming via SSE
 * - Log count statistics
 * - Cross-server log aggregation
 * - Log clearing and maintenance operations
 *
 * @param fastify - The Fastify instance to register routes on
 * @returns Promise that resolves when all routes are registered
 *
 * @example
 * ```typescript
 * // Register log routes
 * await webLogRoutes(app);
 * ```
 */
export async function webLogRoutes(fastify: FastifyInstance) {
  // Query string schema for logs endpoints
  const logQuerySchema = z.object({
    level: z.custom<LogLevel>().optional(),
    limit: z.coerce.number().int().positive().optional(),
    offset: z.coerce.number().int().min(0).optional(),
    since: z.coerce.number().int().optional()
  });

  // GET /web/servers/:id/logs - Get logs for a specific server
  fastify.get<{ Params: { id: string }; Querystring: z.infer<typeof logQuerySchema> }>(
    '/web/servers/:id/logs',
    async (request) => {
      const { id } = request.params;
      const query = logQuerySchema.parse(request.query);

      const logs = logStorage.getLogs(id, query);
      return {
        code: 200,
        message: 'Success',
        data: logs,
        timestamp: new Date().toISOString()
      };
    }
  );

  // GET /web/servers/:id/logs/stream - Get real-time logs stream via SSE
  fastify.get<{ Params: { id: string } }>(
    '/web/servers/:id/logs/stream',
    async (request, reply) => {
      const { id } = request.params;

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial event
      reply.raw.write(
        `data: ${JSON.stringify({
          type: 'connected',
          timestamp: new Date().toISOString(),
          message: 'Connected to log stream'
        })}\n\n`
      );

      // Handle client disconnect
      request.raw.on('close', () => {
        logStorage.removeLogListener(id, listener);
      });

      // Create log listener
      const listener = (log: LogEntry) => {
        try {
          reply.raw.write(`data: ${JSON.stringify(log)}\n\n`);
        } catch {
          // Ignore write errors (e.g. client disconnected)
        }
      };

      logStorage.addLogListener(id, listener);

      // Keep connection alive
      const keepAliveInterval = setInterval(() => {
        try {
          reply.raw.write(': ping\n\n');
        } catch {
          clearInterval(keepAliveInterval);
          logStorage.removeLogListener(id, listener);
        }
      }, 30000);

      // Return a promise that never resolves to keep the connection alive
      return new Promise(() => {
        // Connection will be closed when client disconnects or server shuts down
      });
    }
  );

  // DELETE /web/servers/:id/logs - Clear logs for a specific server
  fastify.delete<{ Params: { id: string } }>('/web/servers/:id/logs', async (request) => {
    const { id } = request.params;
    logStorage.clearLogs(id);
    return {
      code: 200,
      message: 'Logs cleared',
      timestamp: new Date().toISOString()
    };
  });

  // GET /web/logs - Get all logs from all servers
  fastify.get<{ Querystring: z.infer<typeof logQuerySchema> }>('/web/logs', async (request) => {
    const query = logQuerySchema.parse(request.query);

    const servers = logStorage.getServersWithLogs();
    const allLogs = servers
      .flatMap((serverId) => logStorage.getLogs(serverId, query))
      .sort((a, b) => a.timestamp - b.timestamp);

    // Apply pagination to all logs
    const offset = query.offset || 0;
    const limit = query.limit || allLogs.length;

    return {
      code: 200,
      message: 'Success',
      data: allLogs.slice(offset, offset + limit),
      timestamp: new Date().toISOString()
    };
  });

  // GET /web/servers/:id/logs/count - Get log count for a specific server
  fastify.get<{ Params: { id: string }; Querystring: { level?: string } }>(
    '/web/servers/:id/logs/count',
    async (request) => {
      const { id } = request.params;
      const { level } = request.query;

      let count = logStorage.getLogCount(id);
      if (level) {
        const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
        if (validLevels.includes(level as LogLevel)) {
          count = logStorage.getLogs(id, { level: level as LogLevel }).length;
        }
      }

      return {
        code: 200,
        message: 'Success',
        data: { count },
        timestamp: new Date().toISOString()
      };
    }
  );
}
