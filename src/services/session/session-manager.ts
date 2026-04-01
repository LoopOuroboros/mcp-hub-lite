import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { gateway } from '@services/gateway.service.js';
import {
  logger,
  LOG_MODULES,
  formatMcpMessageForLogging,
  logNotificationMessage
} from '@utils/logger.js';
import { configManager } from '@config/config-manager.js';
import { formatDuration } from '@utils/format-utils.js';
import { getSessionDebugSetting, getMcpCommDebugSetting } from '@utils/json-utils.js';
import type { TransportWithWebStandard, Session } from './types.js';

/**
 * Lightweight MCP Session Manager with in-memory session management only.
 *
 * This service manages MCP sessions with basic in-memory storage and automatic
 * cleanup of stale sessions. It provides session isolation through unique
 * server and transport instances per session while maintaining shared resources
 * for efficiency.
 *
 * Key features:
 * - In-memory session storage only (no persistence)
 * - Automatic cleanup of stale sessions based on configurable timeout (default 30 minutes)
 * - Session ID generation for internal use
 *
 * @example
 * ```typescript
 * const sessionManager = new McpSessionManager();
 * const session = await sessionManager.getSession('my-session-id');
 * // Use session.server and session.transport for MCP communication
 * ```
 *
 * @since 2.0.0
 */
export class McpSessionManager {
  private sessions: Map<string, Session> = new Map();

  private get SESSION_TIMEOUT(): number {
    return configManager.getConfig().security.sessionTimeout;
  }

  private get CLEANUP_INTERVAL(): number {
    return configManager.getConfig().security.sessionFlushInterval;
  }

  constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  /**
   * Retrieves an existing session or creates a new one if it doesn't exist.
   *
   * This method provides access to active sessions, creating new ones on demand with
   * proper initialization based on the requireInitialize parameter. It updates session
   * access timestamps.
   *
   * @param {string} sessionId - Unique identifier of the session to retrieve or create
   * @param {boolean} [requireInitialize=true] - Whether to require MCP protocol initialization
   * @returns {Promise<Session>} Active session object with server and transport
   *
   * @example
   * ```typescript
   * // Get or create session with default initialization
   * const session = await sessionManager.getSession('my-session-id');
   * ```
   */
  public async getSession(sessionId: string, requireInitialize: boolean = true): Promise<Session> {
    if (getSessionDebugSetting()) {
      const hasSessionObject = this.sessions.has(sessionId);
      logger.debug(
        `getSession called for ${sessionId} (requireInitialize: ${requireInitialize}). Object exists: ${hasSessionObject}`,
        LOG_MODULES.SESSION_MANAGER
      );
    }

    let session = this.sessions.get(sessionId);

    if (!session) {
      // Normal case: create new session
      session = await this.createSession(sessionId, requireInitialize);
      this.sessions.set(sessionId, session);
    } else {
      // Ensure transport session state is correctly initialized
      const webTransport = (session.transport as unknown as TransportWithWebStandard)
        ._webStandardTransport;
      if (webTransport) {
        const currentSessionId = webTransport.sessionId;
        const isInitialized = webTransport._initialized;

        if (getSessionDebugSetting()) {
          logger.debug(
            `Transport state check - Expected: ${sessionId} (initialized: ${!requireInitialize}), Actual: ${currentSessionId} (initialized: ${isInitialized})`,
            LOG_MODULES.SESSION_MANAGER
          );
        }

        if (webTransport.sessionId !== sessionId) {
          logger.warn(
            `Session ID mismatch detected for ${sessionId}. Resetting transport sessionId.`,
            LOG_MODULES.SESSION_MANAGER
          );
          webTransport.sessionId = sessionId;
          if (webTransport._session !== undefined) {
            webTransport._session = sessionId;
          }
        }

        if (!requireInitialize && !webTransport._initialized) {
          logger.warn(
            `Session initialization state mismatch detected for ${sessionId}. Setting initialized flag.`,
            LOG_MODULES.SESSION_MANAGER
          );
          webTransport._initialized = true;
        }
      }
    }

    const now = Date.now();
    const timeDiff = Math.abs(now - session.lastAccessed);

    // Only update lastAccessed if meaningful time has passed
    if (timeDiff >= 100) {
      session.lastAccessed = now;
    }

    if (getSessionDebugSetting()) {
      logger.debug(`Returning session for ${sessionId}`, LOG_MODULES.SESSION_MANAGER);
    }

    return session;
  }

  /**
   * Checks if a session object exists in the active sessions map.
   *
   * @param sessionId - Unique identifier of the session to check
   * @returns {boolean} True if the session object exists, false otherwise
   */
  public hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Deletes a session from memory.
   *
   * This method gracefully closes the session's MCP server and removes it from memory.
   *
   * @param {string} sessionId - Unique identifier of the session to delete
   * @returns {Promise<boolean>} True if session existed and was deleted, false otherwise
   *
   * @example
   * ```typescript
   * const deleted = await sessionManager.deleteSession('my-session-id');
   * if (deleted) {
   *   console.log('Session deleted successfully');
   * }
   * ```
   */
  public async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.server.close();
      } catch (e) {
        logger.error(`Error closing session ${sessionId}:`, e, LOG_MODULES.SESSION_MANAGER);
      }
      this.sessions.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Creates a new MCP session with proper initialization and transport setup.
   *
   * This method sets up a complete MCP session including server, transport, and
   * communication logging.
   *
   * @param {string} sessionId - Unique identifier for the new session
   * @param {boolean} [requireInitialize=true] - Whether to require MCP protocol initialization
   * @returns {Promise<Session>} Newly created session object
   * @throws {Error} If session creation or connection fails
   *
   * @example
   * ```typescript
   * const session = await sessionManager.createSession('new-session-id');
   * // Use session.server and session.transport for MCP communication
   * ```
   */
  private async createSession(
    sessionId: string,
    requireInitialize: boolean = true
  ): Promise<Session> {
    logger.info(
      `Creating new MCP session: ${sessionId}, requireInitialize: ${requireInitialize}`,
      LOG_MODULES.SESSION_MANAGER
    );

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: (id) => {
        if (getSessionDebugSetting()) {
          logger.debug(`Session initialized: ${id}`, LOG_MODULES.SESSION_MANAGER);
        }
      },
      onsessionclosed: (id) => {
        if (getSessionDebugSetting()) {
          logger.debug(`Session closed: ${id}`, LOG_MODULES.SESSION_MANAGER);
        }
        this.sessions.delete(id);
      }
    });

    // Directly set sessionId property to avoid validateSession failure
    const webTransport = (transport as unknown as TransportWithWebStandard)._webStandardTransport;
    if (webTransport) {
      webTransport.sessionId = sessionId;
      if (getSessionDebugSetting()) {
        logger.debug(
          `Directly set sessionId on transport: ${sessionId}`,
          LOG_MODULES.SESSION_MANAGER
        );
      }
    }

    // For sessions that need to skip initialization, manually set the initialized flag
    if (!requireInitialize) {
      const webTransport = (transport as unknown as TransportWithWebStandard)._webStandardTransport;
      if (webTransport) {
        webTransport.sessionId = sessionId;
        webTransport._initialized = true;
        if (webTransport._session !== undefined) {
          webTransport._session = sessionId;
        }
        if (getSessionDebugSetting()) {
          logger.debug(
            `Manually initialized transport for session: ${sessionId} (skipInitialize: ${!requireInitialize}`,
            LOG_MODULES.SESSION_MANAGER
          );
        }
      }
    }

    // Always set up message handler for notifications/message
    transport.onmessage = (message) => {
      // Communication debug logs: controlled by MCP_COMM_DEBUG environment variable
      if (getMcpCommDebugSetting()) {
        const logMessage = formatMcpMessageForLogging(message);
        logger.debug(`MCP message received: ${logMessage}`, LOG_MODULES.COMMUNICATION);
      }

      // Log notifications/message to application logs (always enabled)
      logNotificationMessage(message, sessionId);
    };

    // Wrap send method for debug logging (if enabled)
    if (getMcpCommDebugSetting()) {
      const originalSend = transport.send;
      transport.send = async (message, options) => {
        try {
          const logMessage = formatMcpMessageForLogging(message);
          logger.debug(`MCP message sent: ${logMessage}`, LOG_MODULES.COMMUNICATION);
        } catch {
          logger.debug(`MCP message sent: [Error formatting response]`, LOG_MODULES.COMMUNICATION);
        }

        // Call original send method
        return await originalSend.call(transport, message, options);
      };
    }

    const server = gateway.createConnectionServer();

    // Ensure server is fully connected before returning session
    await server.connect(transport);

    if (getSessionDebugSetting()) {
      logger.debug(
        `StreamableHTTPServerTransport ready for session: ${sessionId}`,
        LOG_MODULES.SESSION_MANAGER
      );
    }

    logger.info(`MCP session created successfully: ${sessionId}`, LOG_MODULES.SESSION_MANAGER);

    const session = {
      server,
      transport,
      sessionId,
      lastAccessed: Date.now()
    };

    return session;
  }

  /**
   * Cleans up stale sessions based on the configured session timeout.
   *
   * This method is called periodically to identify and close
   * sessions that haven't been accessed within the configured timeout period
   * (default 30 minutes). It gracefully closes MCP servers and removes sessions
   * from memory to prevent resource leaks.
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Called automatically every 60 seconds
   * sessionManager.cleanup();
   * ```
   */
  private cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    // Cleanup in-memory session objects
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > this.SESSION_TIMEOUT) {
        logger.debug(
          `Removing stale session: ${sessionId}. Last accessed ${formatDuration(now - session.lastAccessed)} ago, timeout ${formatDuration(this.SESSION_TIMEOUT)}`,
          LOG_MODULES.SESSION_MANAGER
        );
        try {
          session.server.close();
          cleanedCount++;
        } catch (e) {
          logger.error(`Error closing session ${sessionId}:`, e, LOG_MODULES.SESSION_MANAGER);
        }
        this.sessions.delete(sessionId);
      }
    }

    if (cleanedCount > 0) {
      logger.info(
        `Cleaned up ${cleanedCount} stale sessions. Active sessions: ${this.sessions.size}`,
        LOG_MODULES.SESSION_MANAGER
      );
    }
  }
}

export const mcpSessionManager = new McpSessionManager();
