import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gateway } from '@services/gateway.service.js';
import { logger, isToolsListResponse, simplifyToolsListResponse } from '@utils/logger.js';
import { stringifyForLogging } from '@utils/json-utils.js';
import { configManager } from '@config/config-manager.js';
import { formatDuration } from '@utils/format-utils.js';
import {
  SessionState,
  SessionStore,
  SessionStateSchema,
  createEmptySessionStore
} from '@shared-models/session.model.js';
import { clientTrackerService } from './client-tracker.service.js';
import * as fs from 'fs';
import path from 'path';
import os from 'os';

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
interface WebStandardTransport {
  sessionId?: string;
  _initialized?: boolean;
  _session?: string;
}

interface TransportWithWebStandard {
  _webStandardTransport?: WebStandardTransport;
}

interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  sessionId: string;
  lastAccessed: number;
}

/**
 * Enhanced MCP Session Manager with comprehensive persistence and lifecycle management.
 *
 * This service manages MCP sessions with full state persistence, automatic cleanup,
 * and graceful shutdown handling. It provides session isolation through unique
 * server and transport instances per session while maintaining shared resources
 * for efficiency.
 *
 * Key features include:
 * - Session state persistence to disk with individual session files and index
 * - Dirty tracking with 5-second batch flushing to minimize I/O operations
 * - Automatic cleanup of stale sessions based on configurable timeout (default 30 minutes)
 * - Graceful shutdown handling with SIGTERM/SIGINT signal capture
 * - Client metadata integration from client tracker service
 * - Environment variable controlled debugging (SESSION_DEBUG)
 *
 * Session storage structure:
 * ```
 * ~/.mcp-hub-lite/
 * └── sessions/
 *     ├── index.json          # Session index file
 *     └── {sessionId}.json    # Individual session state files
 * ```
 *
 * @example
 * ```typescript
 * const sessionManager = new McpSessionManager();
 * const session = await sessionManager.getSession('my-session-id');
 * // Use session.server and session.transport for MCP communication
 * ```
 *
 * @since 1.0.0
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
    // Initialize sessions directory path
    const configPath =
      process.env.MCP_HUB_CONFIG_PATH ||
      path.join(os.homedir(), '.mcp-hub-lite', 'config', '.mcp-hub.json');
    const mcpHubDir = path.dirname(path.dirname(configPath)); // Get ~/.mcp-hub-lite directory
    this.sessionsPath = path.join(mcpHubDir, 'sessions');

    logger.info(`Using sessions directory: ${this.sessionsPath}`, { subModule: 'SessionManager' });

    // Start cleanup interval
    setInterval(() => this.cleanup(), 60000);

    // Register graceful shutdown handler
    this.registerShutdownHandler();

    // Initialize by restoring sessions
    this.restoreSessions().catch((error) => {
      logger.error(' Failed to restore sessions during initialization:', error, { subModule: 'SessionManager' });
    });
  }

  /**
   * Registers process shutdown handlers for graceful session cleanup.
   *
   * This method sets up event listeners for SIGTERM and SIGINT signals to ensure
   * that all dirty sessions are flushed to disk before the process terminates.
   * This prevents data loss during unexpected shutdowns or service restarts.
   *
   * The shutdown handler performs a final flush of all dirty sessions and
   * clears any pending flush timeouts to ensure clean termination.
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Called automatically in constructor
   * sessionManager.registerShutdownHandler();
   * ```
   */
  private registerShutdownHandler(): void {
    const gracefulShutdown = async () => {
      logger.info(' Shutting down, flushing dirty sessions...', { subModule: 'SessionManager' });
      try {
        await this.flushDirtySessions();
      } catch (error) {
        logger.error(' Error during shutdown flush:', error, { subModule: 'SessionManager' });
      }
      if (this.flushTimeout) {
        clearTimeout(this.flushTimeout);
      }
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }

  /**
   * Marks a session as dirty, indicating it needs to be persisted to disk.
   *
   * This method adds the session ID to the dirty sessions set and initiates
   * a delayed batch flush operation with a 5-second timeout. This optimization
   * prevents excessive I/O operations by batching multiple session updates
   * that occur in quick succession.
   *
   * When the SESSION_DEBUG environment variable is set, detailed logging
   * is enabled for debugging session persistence behavior.
   *
   * @param {string} sessionId - Unique identifier of the session to mark as dirty
   * @returns {void}
   *
   * @example
   * ```typescript
   * sessionManager.markAsDirty('my-session-id');
   * // Session will be flushed to disk within 5 seconds
   * ```
   */
  private markAsDirty(sessionId: string): void {
    this.dirtySessions.add(sessionId);
    if (process.env.SESSION_DEBUG) {
      logger.debug(`Session marked as dirty: ${sessionId}`, { subModule: 'Session' });
    }

    // Set one-time delayed flush to avoid frequent writes (configurable delay, batch processing)
    if (!this.flushTimeout) {
      const flushInterval = configManager.getConfig().security.sessionFlushInterval || 5000;
      this.flushTimeout = setTimeout(() => {
        this.flushDirtySessions();
        this.flushTimeout = null;
      }, flushInterval);
    }
  }

  /**
   * Loads the complete session store from disk, including all individual session files.
   *
   * This method reads the sessions index file and loads each individual session state
   * file, validating each session state against the SessionStateSchema. Invalid
   * session states are skipped with warning logs, ensuring robust recovery from
   * corrupted data.
   *
   * The method creates the sessions directory and index file if they don't exist,
   * providing a clean initialization path for first-time usage.
   *
   * @returns {Promise<SessionStore>} Complete session store with all valid sessions
   * @throws {Error} If critical I/O operations fail (non-recoverable errors)
   *
   * @example
   * ```typescript
   * const store = await sessionManager.loadSessionStore();
   * console.log(`Loaded ${Object.keys(store.sessions).length} sessions`);
   * ```
   */
  private async loadSessionStore(): Promise<SessionStore> {
    try {
      if (!fs.existsSync(this.sessionsPath)) {
        if (process.env.SESSION_DEBUG) {
          logger.debug('Sessions directory not found, creating new one', { subModule: 'Session' });
        }
        fs.mkdirSync(this.sessionsPath, { recursive: true });
        return createEmptySessionStore();
      }

      const indexPath = path.join(this.sessionsPath, 'index.json');
      if (!fs.existsSync(indexPath)) {
        if (process.env.SESSION_DEBUG) {
          logger.debug('Sessions index file not found, creating new one', { subModule: 'Session' });
        }
        return createEmptySessionStore();
      }

      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      const index = JSON.parse(indexContent);

      if (!index.sessions || !Array.isArray(index.sessions)) {
        logger.error(' Invalid sessions index file, creating new one', { subModule: 'Session' });
        return createEmptySessionStore();
      }

      const store: SessionStore = createEmptySessionStore();

      for (const sessionId of index.sessions) {
        const sessionPath = path.join(this.sessionsPath, `${sessionId}.json`);
        if (fs.existsSync(sessionPath)) {
          try {
            const sessionContent = fs.readFileSync(sessionPath, 'utf-8');
            const sessionState = JSON.parse(sessionContent);
            const validated = SessionStateSchema.parse(sessionState);
            store.sessions[sessionId] = validated;
          } catch (error) {
            logger.warn(` Failed to load session ${sessionId}:`, error, { subModule: 'Session' });
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
      logger.error(' Failed to load sessions store:', error, { subModule: 'Session' });
      return createEmptySessionStore();
    }
  }

  /**
   * Saves the complete session store to disk, writing individual session files and index.
   *
   * This method persists all session states by writing individual JSON files for each
   * session and updating the sessions index file. The operation is atomic at the
   * file level, ensuring data integrity even if the process is interrupted.
   *
   * @param {SessionStore} store - Complete session store to persist
   * @returns {Promise<void>} Resolves when all files are successfully written
   * @throws {Error} If any file write operations fail
   *
   * @example
   * ```typescript
   * await sessionManager.saveSessionStore(mySessionStore);
   * console.log('Session store saved successfully');
   * ```
   */
  private async saveSessionStore(store: SessionStore): Promise<void> {
    try {
      if (!fs.existsSync(this.sessionsPath)) {
        fs.mkdirSync(this.sessionsPath, { recursive: true });
      }

      // Save individual session files
      for (const [sessionId, state] of Object.entries(store.sessions)) {
        const sessionPath = path.join(this.sessionsPath, `${sessionId}.json`);
        fs.writeFileSync(sessionPath, JSON.stringify(state, null, 2));
      }

      // Save index file
      const indexPath = path.join(this.sessionsPath, 'index.json');
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
      logger.error(' Failed to save sessions store:', error, { subModule: 'Session' });
      throw error;
    }
  }

  /**
   * Restores all sessions from disk during service startup.
   *
   * This method is called automatically during initialization to recover session states
   * from persistent storage. It loads the session store, validates each session state,
   * and populates the in-memory session state cache. Invalid sessions are skipped
   * with warning logs to ensure robust startup even with corrupted data.
   *
   * The method ensures idempotent execution by checking the initialization flag,
   * preventing multiple restoration attempts.
   *
   * @returns {Promise<void>} Resolves when all valid sessions are restored
   *
   * @example
   * ```typescript
   * await sessionManager.restoreSessions();
   * console.log('Sessions restored from disk');
   * ```
   */
  public async restoreSessions(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Restoring sessions from disk...', { subModule: 'SessionManager' });

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
          logger.warn(` Skipping invalid session state for ${sessionId}:`, error, { subModule: 'Session' });
        }
      }

      this.isInitialized = true;
      logger.info(`Successfully restored ${restoredCount} session(s)`, {
        subModule: 'SessionManager'
      });
    } catch (error) {
      logger.error(' Failed to restore sessions:', error, { subModule: 'SessionManager' });
      // Continue with empty state rather than failing
      this.isInitialized = true;
    }
  }

  /**
   * Flushes all dirty sessions to disk in a single batch operation.
   *
   * This method collects all sessions marked as dirty, loads the current session store,
   * updates it with the dirty sessions, and saves the complete store back to disk.
   * This batch approach minimizes I/O operations and ensures data consistency.
   *
   * The method includes comprehensive error handling to prevent partial writes and
   * maintains detailed logging for debugging and monitoring purposes.
   *
   * @returns {Promise<void>} Resolves when all dirty sessions are successfully flushed
   *
   * @example
   * ```typescript
   * await sessionManager.flushDirtySessions();
   * console.log('All dirty sessions flushed to disk');
   * ```
   */
  private async flushDirtySessions(): Promise<void> {
    if (this.dirtySessions.size === 0) {
      return;
    }

    try {
      logger.info(`Flushing ${this.dirtySessions.size} dirty session(s) to disk`, {
        subModule: 'SessionManager'
      });

      // Load current store
      const currentStore = await this.loadSessionStore();
      const newStore: SessionStore = {
        ...currentStore,
        sessions: { ...currentStore.sessions }
      };

      // Process all dirty sessions
      for (const sessionId of this.dirtySessions) {
        const sessionState = this.sessionStates.get(sessionId);
        if (sessionState) {
          // Session exists - update it
          newStore.sessions[sessionId] = sessionState;
        } else {
          // Session does not exist - remove it
          delete newStore.sessions[sessionId];
          // Also remove the individual session file
          const sessionPath = path.join(this.sessionsPath, `${sessionId}.json`);
          if (fs.existsSync(sessionPath)) {
            fs.unlinkSync(sessionPath);
            logger.debug(`Deleted session file: ${sessionId}.json`, { subModule: 'Session' });
          }
        }
      }

      await this.saveSessionStore(newStore);

      const flushedCount = this.dirtySessions.size;
      this.dirtySessions.clear();

      logger.info(`Successfully flushed ${flushedCount} session(s)`, {
        subModule: 'SessionManager'
      });
    } catch (error) {
      logger.error(' Failed to flush dirty sessions:', error, { subModule: 'SessionManager' });
    }
  }

  /**
   * Updates session metadata by retrieving client information from the client tracker service.
   *
   * This method fetches current client information including name, version, working directory,
   * and project context from the client tracker service and returns a partial session state
   * update object containing only the relevant metadata fields.
   *
   * @param {string} sessionId - Unique identifier of the session to update
   * @returns {Partial<SessionState>} Partial session state with updated client metadata
   *
   * @example
   * ```typescript
   * const metadata = sessionManager.updateSessionMetadataFromClient('my-session-id');
   * console.log('Updated client metadata:', metadata);
   * ```
   */
  private updateSessionMetadataFromClient(sessionId: string): Partial<SessionState> {
    const clientInfo = clientTrackerService.getClient(sessionId);
    return {
      clientName: clientInfo?.clientName,
      clientVersion: clientInfo?.clientVersion,
      protocolVersion: clientInfo?.protocolVersion,
      cwd: clientInfo?.cwd,
      project: clientInfo?.project,
      userAgent: clientInfo?.userAgent,
      ip: clientInfo?.ip
    };
  }

  /**
   * Creates or updates a session state with current metadata and timestamps.
   *
   * This method merges existing session state (if any) with current client metadata
   * from the client tracker service, updates access timestamps, and ensures proper
   * session state structure. The updated state is stored in memory and marked as dirty
   * for persistence.
   *
   * @param {string} sessionId - Unique identifier of the session to create or update
   * @returns {SessionState} Complete updated session state object
   *
   * @example
   * ```typescript
   * const state = sessionManager.upsertSessionState('my-session-id');
   * console.log('Session state updated:', state);
   * ```
   */
  private upsertSessionState(sessionId: string): SessionState {
    const existing = this.sessionStates.get(sessionId);
    const now = Date.now();
    const clientMetadata = this.updateSessionMetadataFromClient(sessionId);

    const state: SessionState = {
      sessionId,
      clientName: clientMetadata.clientName || existing?.clientName,
      clientVersion: clientMetadata.clientVersion || existing?.clientVersion,
      protocolVersion: clientMetadata.protocolVersion || existing?.protocolVersion,
      cwd: clientMetadata.cwd || existing?.cwd,
      project: clientMetadata.project || existing?.project,
      userAgent: clientMetadata.userAgent || existing?.userAgent,
      ip: clientMetadata.ip || existing?.ip,
      createdAt: existing?.createdAt || now,
      lastAccessedAt: now,
      metadata: existing?.metadata || {}
    };

    this.sessionStates.set(sessionId, state);
    this.markAsDirty(sessionId);

    return state;
  }

  /**
   * Updates session metadata explicitly with provided key-value pairs.
   *
   * This method merges the provided metadata object with existing session metadata,
   * updates the last accessed timestamp, and marks the session as dirty for persistence.
   * It's useful for storing custom session-specific information that needs to be persisted.
   *
   * @param {string} sessionId - Unique identifier of the session to update
   * @param {Record<string, unknown>} metadata - Key-value pairs to merge into session metadata
   * @returns {Promise<void>} Resolves when metadata is updated and marked for persistence
   *
   * @example
   * ```typescript
   * await sessionManager.updateSessionMetadata('my-session-id', {
   *   userPreferences: { theme: 'dark' },
   *   lastProject: 'my-project'
   * });
   * ```
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
   * Retrieves an existing session or creates a new one if it doesn't exist.
   *
   * This method provides access to active sessions, creating new ones on demand with
   * proper initialization based on the requireInitialize parameter. It updates session
   * access timestamps and persists session state changes to ensure data consistency.
   *
   * The method includes optimization to prevent excessive timestamp updates for rapid
   * successive requests by only updating when at least 100ms have passed since the last access.
   *
   * @param {string} sessionId - Unique identifier of the session to retrieve or create
   * @param {boolean} [requireInitialize=true] - Whether to require MCP protocol initialization
   * @returns {Promise<Session>} Active session object with server and transport
   *
   * @example
   * ```typescript
   * // Get or create session with default initialization
   * const session = await sessionManager.getSession('my-session-id');
   *
   * // Get or create session without requiring initialization (for restored sessions)
   * const restoredSession = await sessionManager.getSession('restored-session-id', false);
   * ```
   */
  public async getSession(sessionId: string, requireInitialize: boolean = true): Promise<Session> {
    if (process.env.SESSION_DEBUG) {
      const hasSessionState = this.sessionStates.has(sessionId);
      const hasSessionObject = this.sessions.has(sessionId);
      logger.debug(
        `getSession called for ${sessionId} (requireInitialize: ${requireInitialize}). State exists: ${hasSessionState}, Object exists: ${hasSessionObject}`,
        { subModule: 'Session' }
      );
    }

    let session = this.sessions.get(sessionId);

    // Check if session state exists but session object doesn't (inconsistency case)
    const hasSessionState = this.sessionStates.has(sessionId);
    const hasSessionObject = this.sessions.has(sessionId);

    if (hasSessionState && !hasSessionObject) {
      // Session state exists but session object is missing - recreate session
      if (process.env.SESSION_DEBUG) {
        logger.debug(
          `Session state exists but session object missing for ${sessionId}, recreating...`,
          {
            subModule: 'Session'
          }
        );
      }
      session = await this.createSession(sessionId, requireInitialize);
      this.sessions.set(sessionId, session);
    } else if (!session) {
      // Normal case: create new session
      session = await this.createSession(sessionId, requireInitialize);
      this.sessions.set(sessionId, session);
    } else {
      // Enhanced check: ensure transport session state is correctly initialized
      // This fixes the "Session not found" error when transport has lost session context
      const hasRestoredState = this.sessionStates.has(sessionId);
      const shouldManuallyInitialize = !requireInitialize || hasRestoredState;

      // Always ensure sessionId is set on transport, regardless of initialization status
      // This fixes the "Session not found" error for non-initialization requests
      const webTransport = (session.transport as unknown as TransportWithWebStandard)._webStandardTransport;
      if (webTransport) {
        const currentSessionId = webTransport.sessionId;
        const isInitialized = webTransport._initialized;

        if (process.env.SESSION_DEBUG) {
          logger.debug(
            `Transport state check - Expected: ${sessionId} (initialized: ${shouldManuallyInitialize}), Actual: ${currentSessionId} (initialized: ${isInitialized})`,
            { subModule: 'Session' }
          );
        }

        if (webTransport.sessionId !== sessionId) {
          logger.warn(
            `Session ID mismatch detected for ${sessionId}. Resetting transport sessionId.`,
            { subModule: 'Session' }
          );
          webTransport.sessionId = sessionId;
          if (webTransport._session !== undefined) {
            webTransport._session = sessionId;
          }
        }

        if (shouldManuallyInitialize && !webTransport._initialized) {
          logger.warn(
            `Session initialization state mismatch detected for ${sessionId}. Setting initialized flag.`,
            { subModule: 'Session' }
          );
          webTransport._initialized = true;
        }
      }
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

    if (process.env.SESSION_DEBUG) {
      logger.debug(`Returning session for ${sessionId}`, { subModule: 'Session' });
    }

    return session;
  }

  /**
   * Retrieves all persisted session states for API exposure.
   *
   * This method returns an array of all current session states, providing a complete
   * snapshot of all active sessions and their metadata. It's primarily used by the
   * web API to expose session information to clients.
   *
   * @returns {SessionState[]} Array of all current session states
   *
   * @example
   * ```typescript
   * const allStates = sessionManager.getAllSessionStates();
   * console.log(`Total active sessions: ${allStates.length}`);
   * ```
   */
  public getAllSessionStates(): SessionState[] {
    return Array.from(this.sessionStates.values());
  }

  /**
   * Retrieves a specific session state by session ID for API exposure.
   *
   * This method returns the current state of a specific session or undefined if
   * the session doesn't exist. It's primarily used by the web API to provide
   * detailed information about individual sessions.
   *
   * @param {string} sessionId - Unique identifier of the session to retrieve
   * @returns {SessionState | undefined} Session state object or undefined if not found
   *
   * @example
   * ```typescript
   * const state = sessionManager.getSessionState('my-session-id');
   * if (state) {
   *   console.log('Session client:', state.clientName);
   * }
   * ```
   */
  public getSessionState(sessionId: string): SessionState | undefined {
    return this.sessionStates.get(sessionId);
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
   * Deletes a session and removes it from persistent storage.
   *
   * This method gracefully closes the session's MCP server, removes it from memory,
   * and ensures it's removed from persistent storage by marking it as dirty and
   * performing an immediate flush. It returns true if the session existed and was deleted.
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
        logger.error(` Error closing session ${sessionId}:`, e, { subModule: 'Session' });
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

  /**
   * Creates a new MCP session with proper initialization and transport setup.
   *
   * This method sets up a complete MCP session including server, transport, and
   * communication logging. It handles both fresh sessions and restored sessions,
   * with special logic for skipping initialization when appropriate.
   *
   * Key features:
   * - Creates StreamableHTTPServerTransport with custom session ID generation
   * - Sets up comprehensive message logging for debugging
   * - Handles restored sessions by manually initializing transport state
   * - Integrates with client tracker service for metadata
   * - Creates/updates session state and marks as dirty for persistence
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
    logger.info(` Creating new MCP session: ${sessionId}, requireInitialize: ${requireInitialize}`, { subModule: 'SessionManager' });

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

    // Directly set sessionId property to avoid validateSession failure
    // because WebStandardStreamableHTTPServerTransport only calls sessionIdGenerator during initialize
    const webTransport = (transport as unknown as TransportWithWebStandard)._webStandardTransport;
    if (webTransport) {
      webTransport.sessionId = sessionId;
      // Do not set _initialized = true here because it will cause initialize request to fail
      // _initialized flag will be set as needed in the shouldManuallyInitialize logic
      if (process.env.SESSION_DEBUG) {
        logger.debug(
          `Directly set sessionId on transport: ${sessionId}`,
          { subModule: 'Session' }
        );
      }
    }

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
        // Add additional properties that might be needed
        _session?: string;
      }

      interface TransportWithWebStandard {
        _webStandardTransport?: WebStandardTransport;
      }

      const webTransport = (transport as unknown as TransportWithWebStandard)._webStandardTransport;
      if (webTransport) {
        webTransport.sessionId = sessionId;
        webTransport._initialized = true;
        // Ensure session property is also set if it exists
        if (webTransport._session !== undefined) {
          webTransport._session = sessionId;
        }
        if (process.env.SESSION_DEBUG) {
          logger.debug(
            `Manually initialized transport for session: ${sessionId} (skipInitialize: ${!requireInitialize}, restored: ${!!restoredState})`,
            { subModule: 'Session' }
          );
          logger.debug(
            `Transport state after manual init - sessionId: ${webTransport.sessionId}, _initialized: ${webTransport._initialized}, _session: ${webTransport._session}`,
            { subModule: 'Session' }
          );
        }
      } else {
        logger.error(`Failed to get _webStandardTransport from transport!`, {
          subModule: 'SessionManager'
        });
        // Even if we can't manually initialize, continue with normal initialization
        // The transport will be initialized when the first request arrives
      }
    }

    // Communication debug logs: always set, controlled by logger.debug output level
    transport.onmessage = (message) => {
      try {
        const messageStr = stringifyForLogging(message);
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
        let logMessage = stringifyForLogging(message);
        if (isToolsListResponse(logMessage)) {
          logMessage = simplifyToolsListResponse(logMessage);
        } else {
          try {
            // Try to format other JSON responses to improve readability
            const parsed = JSON.parse(logMessage);
            logMessage = stringifyForLogging(parsed);
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

  /**
   * Cleans up stale sessions based on the configured session timeout.
   *
   * This method is called periodically (every 60 seconds) to identify and close
   * sessions that haven't been accessed within the configured timeout period
   * (default 30 minutes). It gracefully closes MCP servers and removes sessions
   * from memory to prevent resource leaks.
   *
   * The method logs detailed information about cleaned sessions and maintains
   * active session count for monitoring purposes.
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
        logger.debug(`Removing stale session: ${sessionId}. Last accessed ${formatDuration(now - session.lastAccessed)} ago, timeout ${formatDuration(this.SESSION_TIMEOUT)}`, { subModule: 'Session' });
        try {
          session.server.close();
          cleanedCount++;
        } catch (e) {
          logger.error(` Error closing session ${sessionId}:`, e, { subModule: 'Session' });
        }
        this.sessions.delete(sessionId);
      }
    }

    // Cleanup persisted session states
    const expiredSessionIds: string[] = [];
    for (const [sessionId, session] of this.sessionStates.entries()) {
      if (now - session.lastAccessedAt > this.SESSION_TIMEOUT) {
        expiredSessionIds.push(sessionId);
        cleanedCount++;
      }
    }

    for (const sessionId of expiredSessionIds) {
      this.sessionStates.delete(sessionId);
      this.markAsDirty(sessionId);
      logger.debug(`Marking expired session for deletion: ${sessionId}`, { subModule: 'Session' });
    }

    // Immediately flush to delete session files from disk
    if (expiredSessionIds.length > 0) {
      this.flushDirtySessions().catch(error => {
        logger.error('Failed to flush expired sessions:', error, { subModule: 'SessionManager' });
      });
    }

    if (cleanedCount > 0) {
      logger.info(
        `Cleaned up ${cleanedCount} stale sessions. Active sessions: ${this.sessions.size}, Persisted states: ${this.sessionStates.size}`,
        { subModule: 'SessionManager' }
      );
    }
  }
}

export const mcpSessionManager = new McpSessionManager();
