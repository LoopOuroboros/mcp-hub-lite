import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gateway } from '@services/gateway.service.js';
import { logger, isToolsListResponse, simplifyToolsListResponse } from '@utils/logger.js';
import { configManager } from '@config/config-manager.js';
import {
  SessionState,
  SessionStore,
  SessionStateSchema,
  createEmptySessionStore
} from '@models/session.model.js';
import { clientTrackerService } from './client-tracker.service.js';
import * as fs from 'fs';
import path from 'path';
import os from 'os';

interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  sessionId: string;
  lastAccessed: number;
}

/**
 * Enhanced MCP Session Manager with persistence support
 *
 * Features:
 * - Session state persistence to disk
 * - Dirty tracking for optimized writes
 * - Batch flushing for reduced I/O
 * - Graceful shutdown handling
 * - Detailed logging with environment variable control
 */
export class McpSessionManager {
  private sessions: Map<string, Session> = new Map();
  private sessionStates: Map<string, SessionState> = new Map();
  private dirtySessions: Set<string> = new Set();
  private sessionsPath: string;
  private flushTimeout: NodeJS.Timeout | null = null; // Replace with one-time delay
  private isInitialized = false;

  private get SESSION_TIMEOUT(): number {
    return configManager.getConfig().security.sessionTimeout;
  }

  constructor() {
    // Initialize sessions file path
    const configPath =
      process.env.MCP_HUB_CONFIG_PATH ||
      path.join(os.homedir(), '.mcp-hub-lite', 'config', '.mcp-hub.json');
    const mcpHubDir = path.dirname(path.dirname(configPath)); // Get ~/.mcp-hub-lite directory
    this.sessionsPath = path.join(mcpHubDir, 'sessions.json');

    logger.info(`Using sessions file: ${this.sessionsPath}`, { subModule: 'SessionManager' });

    // Start cleanup interval
    setInterval(() => this.cleanup(), 60000);

    // Register graceful shutdown handler
    this.registerShutdownHandler();

    // Initialize by restoring sessions
    this.restoreSessions().catch((error) => {
      logger.error(' Failed to restore sessions during initialization:', error);
    });
  }

  /**
   * Register process shutdown handlers for graceful cleanup
   */
  private registerShutdownHandler(): void {
    const gracefulShutdown = async () => {
      logger.info(' Shutting down, flushing dirty sessions...');
      try {
        await this.flushDirtySessions();
      } catch (error) {
        logger.error(' Error during shutdown flush:', error);
      }
      if (this.flushTimeout) {
        clearTimeout(this.flushTimeout);
      }
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }

  /**
   * Mark a session as dirty (needs to be persisted)
   */
  private markAsDirty(sessionId: string): void {
    this.dirtySessions.add(sessionId);
    if (process.env.SESSION_DEBUG) {
      logger.debug(`Session marked as dirty: ${sessionId}`, { subModule: 'Session' });
    }

    // Set one-time delayed flush to avoid frequent writes (5-second delay, batch processing)
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => {
        this.flushDirtySessions();
        this.flushTimeout = null;
      }, 5000);
    }
  }

  /**
   * Load session store from disk
   */
  private async loadSessionStore(): Promise<SessionStore> {
    try {
      const sessionsDir = path.join(path.dirname(this.sessionsPath), 'sessions');

      if (!fs.existsSync(sessionsDir)) {
        if (process.env.SESSION_DEBUG) {
          logger.debug('Sessions directory not found, creating new one', { subModule: 'Session' });
        }
        fs.mkdirSync(sessionsDir, { recursive: true });
        return createEmptySessionStore();
      }

      const indexPath = path.join(sessionsDir, 'index.json');
      if (!fs.existsSync(indexPath)) {
        if (process.env.SESSION_DEBUG) {
          logger.debug('Sessions index file not found, creating new one', { subModule: 'Session' });
        }
        return createEmptySessionStore();
      }

      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      const index = JSON.parse(indexContent);

      if (!index.sessions || !Array.isArray(index.sessions)) {
        logger.error(' Invalid sessions index file, creating new one');
        return createEmptySessionStore();
      }

      const store: SessionStore = createEmptySessionStore();

      for (const sessionId of index.sessions) {
        const sessionPath = path.join(sessionsDir, `${sessionId}.json`);
        if (fs.existsSync(sessionPath)) {
          try {
            const sessionContent = fs.readFileSync(sessionPath, 'utf-8');
            const sessionState = JSON.parse(sessionContent);
            const validated = SessionStateSchema.parse(sessionState);
            store.sessions[sessionId] = validated;
          } catch (error) {
            logger.warn(` Failed to load session ${sessionId}:`, error);
          }
        }
      }

      if (process.env.SESSION_DEBUG) {
        logger.debug(`Loaded ${Object.keys(store.sessions).length} sessions from store`, {
          subModule: 'Session'
        });
      }

      return store;
    } catch (error) {
      logger.error(' Failed to load sessions store:', error);
      return createEmptySessionStore();
    }
  }

  /**
   * Save session store to disk
   */
  private async saveSessionStore(store: SessionStore): Promise<void> {
    try {
      const sessionsDir = path.join(path.dirname(this.sessionsPath), 'sessions');

      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
      }

      // Save individual session files
      for (const [sessionId, state] of Object.entries(store.sessions)) {
        const sessionPath = path.join(sessionsDir, `${sessionId}.json`);
        fs.writeFileSync(sessionPath, JSON.stringify(state, null, 2));
      }

      // Save index file
      const indexPath = path.join(sessionsDir, 'index.json');
      fs.writeFileSync(
        indexPath,
        JSON.stringify(
          {
            sessions: Object.keys(store.sessions)
          },
          null,
          2
        )
      );
    } catch (error) {
      logger.error(' Failed to save sessions store:', error);
      throw error;
    }
  }

  /**
   * Restore sessions from disk on startup
   */
  public async restoreSessions(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Restoring sessions from disk...');

      const store = await this.loadSessionStore();
      let restoredCount = 0;

      for (const [sessionId, state] of Object.entries(store.sessions)) {
        try {
          // Validate individual session state
          const validatedState = SessionStateSchema.parse(state);
          this.sessionStates.set(sessionId, validatedState);
          restoredCount++;

          if (process.env.SESSION_DEBUG) {
            logger.debug(`Restored session state: ${sessionId}`, { subModule: 'Session' });
          }
        } catch (error) {
          logger.warn(` Skipping invalid session state for ${sessionId}:`, error);
        }
      }

      this.isInitialized = true;
      logger.info(`Successfully restored ${restoredCount} session(s)`, {
        subModule: 'SessionManager'
      });
    } catch (error) {
      logger.error(' Failed to restore sessions:', error);
      // Continue with empty state rather than failing
      this.isInitialized = true;
    }
  }

  /**
   * Flush dirty sessions to disk
   */
  private async flushDirtySessions(): Promise<void> {
    if (this.dirtySessions.size === 0) {
      return;
    }

    try {
      logger.info(`Flushing ${this.dirtySessions.size} dirty session(s) to disk`, {
        subModule: 'SessionManager'
      });

      // Collect all sessions to save
      const sessionsToSave: Record<string, SessionState> = {};
      for (const sessionId of this.dirtySessions) {
        const sessionState = this.sessionStates.get(sessionId);
        if (sessionState) {
          sessionsToSave[sessionId] = sessionState;
        }
      }

      // Load current store and update
      const currentStore = await this.loadSessionStore();
      const newStore: SessionStore = {
        ...currentStore,
        sessions: {
          ...currentStore.sessions,
          ...sessionsToSave
        }
      };

      await this.saveSessionStore(newStore);

      const flushedCount = Object.keys(sessionsToSave).length;
      this.dirtySessions.clear();

      logger.info(`Successfully flushed ${flushedCount} session(s)`, {
        subModule: 'SessionManager'
      });
    } catch (error) {
      logger.error(' Failed to flush dirty sessions:', error);
    }
  }

  /**
   * Update session metadata from client tracker
   */
  private updateSessionMetadataFromClient(sessionId: string): Partial<SessionState> {
    const clientInfo = clientTrackerService.getClient(sessionId);
    return {
      clientName: clientInfo?.clientName,
      clientVersion: clientInfo?.clientVersion,
      cwd: clientInfo?.cwd,
      project: clientInfo?.project
    };
  }

  /**
   * Create or update session state
   */
  private upsertSessionState(sessionId: string): SessionState {
    const existing = this.sessionStates.get(sessionId);
    const now = Date.now();
    const clientMetadata = this.updateSessionMetadataFromClient(sessionId);

    const state: SessionState = {
      sessionId,
      clientName: clientMetadata.clientName || existing?.clientName,
      clientVersion: clientMetadata.clientVersion || existing?.clientVersion,
      cwd: clientMetadata.cwd || existing?.cwd,
      project: clientMetadata.project || existing?.project,
      createdAt: existing?.createdAt || now,
      lastAccessedAt: now,
      metadata: existing?.metadata || {}
    };

    this.sessionStates.set(sessionId, state);
    this.markAsDirty(sessionId);

    return state;
  }

  /**
   * Update session metadata explicitly
   */
  public async updateSessionMetadata(
    sessionId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const existing = this.sessionStates.get(sessionId);
    if (existing) {
      const now = Date.now();
      const updated: SessionState = {
        ...existing,
        lastAccessedAt: now,
        metadata: {
          ...existing.metadata,
          ...metadata
        }
      };
      this.sessionStates.set(sessionId, updated);
      this.markAsDirty(sessionId);

      if (process.env.SESSION_DEBUG) {
        logger.debug(`Updated metadata for session: ${sessionId}`, { subModule: 'Session' });
      }
    }
  }

  /**
   * Get or create a session
   */
  public async getSession(sessionId: string, requireInitialize: boolean = true): Promise<Session> {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = await this.createSession(sessionId, requireInitialize);
      this.sessions.set(sessionId, session);
    }

    const now = Date.now();
    const timeDiff = Math.abs(now - session.lastAccessed);

    // Only update lastAccessed if meaningful time has passed
    // This prevents excessive updates for rapid successive requests
    if (timeDiff >= 100) {
      session.lastAccessed = now;
      // Also update and persist session state
      this.upsertSessionState(sessionId);
    }

    return session;
  }

  /**
   * Get all persisted session states (for API)
   */
  public getAllSessionStates(): SessionState[] {
    return Array.from(this.sessionStates.values());
  }

  /**
   * Get a specific session state (for API)
   */
  public getSessionState(sessionId: string): SessionState | undefined {
    return this.sessionStates.get(sessionId);
  }

  /**
   * Delete a session (for API)
   */
  public async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.server.close();
      } catch (e) {
        logger.error(` Error closing session ${sessionId}:`, e);
      }
      this.sessions.delete(sessionId);
    }

    const existed = this.sessionStates.has(sessionId);
    if (existed) {
      this.sessionStates.delete(sessionId);
      // Mark as dirty to remove from persistence
      this.markAsDirty(sessionId);

      // Flush immediately to remove from disk
      await this.flushDirtySessions();
    }

    return existed;
  }

  private async createSession(
    sessionId: string,
    requireInitialize: boolean = true
  ): Promise<Session> {
    logger.info(` Creating new MCP session: ${sessionId}, requireInitialize: ${requireInitialize}`);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: (id) => {
        if (process.env.SESSION_DEBUG) {
          logger.debug(`Session initialized: ${id}`, { subModule: 'Session' });
        }
      },
      onsessionclosed: (id) => {
        if (process.env.SESSION_DEBUG) {
          logger.debug(`Session closed: ${id}`, { subModule: 'Session' });
        }
        this.sessions.delete(id);
      }
    });

    // Check if we have a restored state for this session
    const restoredState = this.sessionStates.get(sessionId);
    if (restoredState) {
      logger.info(`Reusing restored session state for: ${sessionId}`, {
        subModule: 'SessionManager'
      });
    }

    // For restored sessions or when explicitly requested to skip initialization, manually set the initialized flag
    // This allows sending requests like tools/list directly without needing to initialize first
    const shouldManuallyInitialize = !requireInitialize || !!restoredState;
    if (process.env.SESSION_DEBUG) {
      logger.debug(
        `shouldManuallyInitialize: ${shouldManuallyInitialize} (!requireInitialize: ${!requireInitialize} || restored: ${!!restoredState})`,
        { subModule: 'Session' }
      );
    }

    if (shouldManuallyInitialize) {
      // Define transport structure type
      interface WebStandardTransport {
        sessionId?: string;
        _initialized?: boolean;
      }

      interface TransportWithWebStandard {
        _webStandardTransport?: WebStandardTransport;
      }

      const webTransport = (transport as unknown as TransportWithWebStandard)._webStandardTransport;
      if (webTransport) {
        webTransport.sessionId = sessionId;
        webTransport._initialized = true;
        if (process.env.SESSION_DEBUG) {
          logger.debug(
            `Manually initialized transport for session: ${sessionId} (skipInitialize: ${!requireInitialize}, restored: ${!!restoredState})`,
            { subModule: 'Session' }
          );
          logger.debug(
            `Transport state after manual init - sessionId: ${webTransport.sessionId}, _initialized: ${webTransport._initialized}`,
            { subModule: 'Session' }
          );
        }
      } else {
        logger.error(`Failed to get _webStandardTransport from transport!`, {
          subModule: 'SessionManager'
        });
      }
    }

    // Communication debug logs: always set, controlled by logger.debug output level
    transport.onmessage = (message) => {
      try {
        const messageStr = JSON.stringify(message);
        logger.debug(`MCP message received: ${messageStr}`, { subModule: 'Communication' });
      } catch {
        logger.debug(`MCP message received: [Unserializable]`, { subModule: 'Communication' });
      }
    };

    // Wrap send method to log responses
    const originalSend = transport.send;
    transport.send = async (message, options) => {
      try {
        // Log response messages, simplify tools/list responses
        let logMessage = JSON.stringify(message);
        if (isToolsListResponse(logMessage)) {
          logMessage = simplifyToolsListResponse(logMessage);
        } else {
          try {
            // Try to format other JSON responses to improve readability
            const parsed = JSON.parse(logMessage);
            logMessage = JSON.stringify(parsed, null, 2);
          } catch {
            // If not valid JSON, output as-is and truncate long content
            logMessage =
              logMessage.length > 500 ? logMessage.substring(0, 500) + '...' : logMessage;
          }
        }
        logger.debug(`MCP message sent: ${logMessage}`, { subModule: 'Communication' });
      } catch {
        logger.debug(`MCP message sent: [Error formatting response]`, {
          subModule: 'Communication'
        });
      }

      // Call original send method
      return await originalSend.call(transport, message, options);
    };

    const server = gateway.createConnectionServer();

    // Ensure server is fully connected before returning session
    await server.connect(transport);

    // Note: StreamableHTTPServerTransport's onsessioninitialized callback is triggered
    // when the first actual request (GET /mcp) arrives, not during connect().
    // Therefore, we don't need to wait for this event - the transport is ready to receive requests.
    if (process.env.SESSION_DEBUG) {
      logger.debug(`StreamableHTTPServerTransport ready for session: ${sessionId}`, {
        subModule: 'Session'
      });
    }

    // Create/update session state
    this.upsertSessionState(sessionId);

    logger.info(`MCP session created successfully: ${sessionId}`, { subModule: 'SessionManager' });

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
        logger.info(
          `Cleaning up stale session: ${sessionId} (last accessed ${(now - session.lastAccessed) / 1000}s ago)`,
          { subModule: 'SessionManager' }
        );
        try {
          session.server.close();
          cleanedCount++;
        } catch (e) {
          logger.error(` Error closing session ${sessionId}:`, e);
        }
        this.sessions.delete(sessionId);
      }
    }
    if (cleanedCount > 0) {
      logger.info(
        `Cleaned up ${cleanedCount} stale sessions. Active sessions: ${this.sessions.size}`,
        { subModule: 'SessionManager' }
      );
    }
  }
}

export const mcpSessionManager = new McpSessionManager();
