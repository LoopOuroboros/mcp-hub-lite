import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gateway } from './gateway.service.js';
import { logger } from '../utils/logger.js';

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
        const transport = new StreamableHTTPServerTransport();
        const server = gateway.createConnectionServer();
        
        // Setup Active Fetching for Roots
        // Handled by GatewayService's initialized notification handler
        // server.server.oninitialized = async () => { ... }

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
