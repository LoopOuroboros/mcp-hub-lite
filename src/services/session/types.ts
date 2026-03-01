import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Transport with web standard transport property.
 */
export interface TransportWithWebStandard {
  _webStandardTransport?: {
    sessionId?: string;
    _initialized?: boolean;
    _session?: string;
  };
}

/**
 * Represents an active MCP session with its associated server and transport.
 *
 * Each session maintains its own MCP server instance and HTTP transport layer,
 * providing isolated communication channels for different clients. The session
 * tracks the last access time for automatic cleanup of stale sessions.
 *
 * @interface Session
 * @property {McpServer} server - The MCP server instance handling this session
 * @property {StreamableHTTPServerTransport} transport - The HTTP transport for this session
 * @property {string} sessionId - Unique identifier for the session
 * @property {number} lastAccessed - Timestamp (milliseconds) of last session access
 */
export interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  sessionId: string;
  lastAccessed: number;
}
