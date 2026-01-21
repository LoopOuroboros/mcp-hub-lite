import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gateway } from './gateway.service.js';
import { clientTrackerService } from './client-tracker.service.js';
import { logger } from '../utils/logger.js';
import { ListRootsResultSchema } from '@modelcontextprotocol/sdk/types.js';

interface Session {
    server: McpServer;
    transport: StreamableHTTPServerTransport;
    clientId: string;
    lastAccessed: number;
}

export class McpSessionManager {
    private sessions: Map<string, Session> = new Map();
    private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    constructor() {
        setInterval(() => this.cleanup(), 60000);
    }

    public async getSession(clientId: string): Promise<Session> {
        let session = this.sessions.get(clientId);
        
        if (!session) {
            session = await this.createSession(clientId);
            this.sessions.set(clientId, session);
        }

        session.lastAccessed = Date.now();
        return session;
    }

    private async createSession(clientId: string): Promise<Session> {
        logger.info(`Creating new MCP session for client: ${clientId}`);
        
        // Use stateless mode for the transport to avoid strict session validation
        // The Gateway handles session routing via clientId in the URL/headers
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined
        });
        const server = gateway.createConnectionServer();
        
        // Setup Active Fetching for Roots
        // We hook into oninitialized to fetch roots as soon as the client is ready
        server.server.oninitialized = async () => {
            logger.info(`Session initialized for client ${clientId}, fetching roots...`);
            try {
              // Wait a short moment for the SSE connection to be fully established
              // The client sends POST initialize/initialized and GET /mcp (SSE) concurrently
              // We need to ensure the SSE stream is ready before we can send requests to the client
              await new Promise(resolve => setTimeout(resolve, 1000));

              // Fetch roots from client
              // Note: This requires the client to support roots/list request handling
              const result = await server.server.request(
                { method: "roots/list" }, 
                ListRootsResultSchema
              );
                
                if (result.roots) {
                    logger.info(`Received ${result.roots.length} roots from client ${clientId}`);
                    clientTrackerService.updateClientRoots(clientId, result.roots);
                }
            } catch (error) {
                // It's common that clients might not support this or fail, so just warn
                logger.warn(`Failed to fetch roots from client ${clientId}: ${error instanceof Error ? error.message : String(error)}`);
            }
        };

        await server.connect(transport);

        return {
            server,
            transport,
            clientId,
            lastAccessed: Date.now()
        };
    }

    private cleanup() {
        const now = Date.now();
        for (const [id, session] of this.sessions.entries()) {
            if (now - session.lastAccessed > this.SESSION_TIMEOUT) {
                logger.info(`Cleaning up stale session: ${id}`);
                // Best effort cleanup
                try {
                    session.server.close();
                } catch (e) {
                    logger.error(`Error closing session ${id}:`, e);
                }
                this.sessions.delete(id);
            }
        }
    }
}

export const mcpSessionManager = new McpSessionManager();
