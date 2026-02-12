import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gateway } from '@services/gateway.service.js';
import { logger } from '@utils/logger.js';
import { configManager } from '@config/config-manager.js';

interface Session {
    server: McpServer;
    transport: StreamableHTTPServerTransport;
    sessionId: string;
    lastAccessed: number;
}

export class McpSessionManager {
    private sessions: Map<string, Session> = new Map();
    private get SESSION_TIMEOUT(): number {
        return configManager.getConfig().security.sessionTimeout;
    }

    constructor() {
        setInterval(() => this.cleanup(), 60000);
    }

    public async getSession(sessionId: string): Promise<Session> {
        let session = this.sessions.get(sessionId);

        if (!session) {
            session = await this.createSession(sessionId);
            this.sessions.set(sessionId, session);
        }

        session.lastAccessed = Date.now();
        return session;
    }

    private async createSession(sessionId: string): Promise<Session> {
        logger.info(`Creating new MCP session: ${sessionId}`);

        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => sessionId,
            onsessioninitialized: (id) => {
                logger.debug(`Session initialized: ${id}`);
            },
            onsessionclosed: (id) => {
                logger.debug(`Session closed: ${id}`);
                this.sessions.delete(id);
            }
        });
        
        // 条件性调试日志：仅当 DEV_LOG_FILE 环境变量设置时才记录详细消息
        if (process.env.DEV_LOG_FILE) {
            transport.onmessage = (message) => {
                try {
                    const messageStr = JSON.stringify(message);
                    logger.debug(`MCP message received: ${messageStr}`);
                } catch {
                    logger.debug(`MCP message received: [Unserializable]`);
                }
            };
        }

        const server = gateway.createConnectionServer();

        await server.connect(transport);

        logger.info(`MCP session created successfully: ${sessionId}`);

        return {
            server,
            transport,
            sessionId,
            lastAccessed: Date.now()
        };
    }

    private cleanup() {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastAccessed > this.SESSION_TIMEOUT) {
                logger.info(`Cleaning up stale session: ${sessionId} (last accessed ${(now - session.lastAccessed) / 1000}s ago)`);
                try {
                    session.server.close();
                    cleanedCount++;
                } catch (e) {
                    logger.error(`Error closing session ${sessionId}:`, e);
                }
                this.sessions.delete(sessionId);
            }
        }
        if (cleanedCount > 0) {
            logger.info(`Cleaned up ${cleanedCount} stale sessions. Active sessions: ${this.sessions.size}`);
        }
    }
}

export const mcpSessionManager = new McpSessionManager();
