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
        // Start cleanup interval
        setInterval(() => this.cleanup(), 60000);
    }

    public async getSession(sessionId: string): Promise<Session> {
        let session = this.sessions.get(sessionId);

        if (!session) {
            session = await this.createSession(sessionId);
            this.sessions.set(sessionId, session);
        }

        const now = Date.now();
        const timeDiff = Math.abs(now - session.lastAccessed);

        // Only update lastAccessed if meaningful time has passed
        // This prevents excessive updates for rapid successive requests
        if (timeDiff >= 100) {
            session.lastAccessed = now;
        }

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

        // 条件性调试日志：支持多种环境变量控制
        if (process.env.DEV_LOG_FILE || process.env.MCP_COMM_DEBUG) {
            transport.onmessage = (message) => {
                try {
                    const messageStr = JSON.stringify(message);
                    if (process.env.MCP_COMM_DEBUG) {
                        logger.debug(`MCP message received: ${messageStr}`, { subModule: 'Communication' });
                    }
                } catch {
                    if (process.env.MCP_COMM_DEBUG) {
                        logger.debug(`MCP message received: [Unserializable]`, { subModule: 'Communication' });
                    }
                }
            };

            // 包装send方法以记录响应
            const originalSend = transport.send;
            transport.send = async (message, options) => {
                try {
                    // 记录响应消息
                    const messageStr = JSON.stringify(message, null, 2);
                    const truncatedMessage = messageStr.length > 2000
                        ? messageStr.substring(0, 2000) + '... [truncated]'
                        : messageStr;
                    logger.debug(`MCP message sent: ${truncatedMessage}`, { subModule: 'Communication' });
                } catch (error) {
                    logger.debug(`MCP message sent: [Error formatting response]`, { subModule: 'Communication' });
                }

                // 调用原始send方法
                return await originalSend.call(transport, message, options);
            };
        }

        const server = gateway.createConnectionServer();

        // 确保服务器完全连接后再返回会话
        await server.connect(transport);

        logger.info(`MCP session created successfully: ${sessionId}`);

        const session = {
            server,
            transport,
            sessionId,
            lastAccessed: Date.now()
        };

        return session;
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