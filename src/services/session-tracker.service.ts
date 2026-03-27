import type {
  SessionContext,
  SessionInfo,
  SessionRoot
} from '@shared-types/session-context.types.js';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { eventBus } from './event-bus.service.js';
import { configManager } from '@config/config-manager.js';
import { formatDuration } from '@utils/format-utils.js';

/**
 * Session tracking service that manages session connections and their metadata.
 *
 * This service maintains a registry of connected sessions (typically IDEs or other
 * MCP clients) and tracks their connection state, metadata, and workspace roots.
 * It provides automatic cleanup of stale sessions after a timeout period and
 * publishes connection/disconnection events via the event bus.
 *
 * The service is primarily used by the MCP session manager to track which sessions
 * are connected and maintain their context information for proper session management.
 *
 * @example
 * // Update session information when a new connection is established
 * sessionTrackerService.updateSession({
 *   sessionId: 'session-123',
 *   clientName: 'VS Code',
 *   clientVersion: '1.85.0',
 *   cwd: '/home/user/project'
 * });
 *
 * // Get all currently connected sessions
 * const sessions = sessionTrackerService.getSessions();
 */
class SessionTrackerService {
  private sessions: Map<string, SessionInfo> = new Map();
  // Use the same timeout as session manager (default 30 minutes)
  private get TIMEOUT_MS(): number {
    return configManager.getConfig().security.sessionTimeout;
  }

  /**
   * Creates a new session tracker service instance.
   *
   * Initializes the service with automatic periodic cleanup of stale sessions
   * every 60 seconds to prevent memory leaks from disconnected sessions.
   */
  constructor() {
    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Updates or creates a session entry with the provided context information.
   *
   * This method is called whenever a session sends a request with context information.
   * It preserves existing session metadata that isn't provided in the new context,
   * ensuring that sessions don't lose their previously established information.
   *
   * If this is a new session (not previously tracked), it publishes a 'session-connected'
   * event to notify other services about the new connection.
   *
   * @param context - The session context containing session ID and optional metadata
   * @param context.sessionId - Unique identifier for the session
   * @param context.clientName - Optional name of the client application
   * @param context.clientVersion - Optional version of the client application
   * @param context.protocolVersion - Optional MCP protocol version
   * @param context.userAgent - Optional user agent string
   * @param context.ip - Optional session IP address
   *
   * @example
   * sessionTrackerService.updateSession({
   *   sessionId: 'session-123',
   *   clientName: 'VS Code',
   *   clientVersion: '1.85.0'
   * });
   */
  public updateSession(context: SessionContext) {
    const existing = this.sessions.get(context.sessionId);
    const sessionInfo: SessionInfo = {
      ...context,
      // Preserve existing info if not provided in new request
      clientName: context.clientName || existing?.clientName,
      clientVersion: context.clientVersion || existing?.clientVersion,
      protocolVersion: context.protocolVersion || existing?.protocolVersion,
      capabilities: context.capabilities || existing?.capabilities,
      userAgent: context.userAgent || existing?.userAgent,
      ip: context.ip || existing?.ip,

      lastSeen: Date.now(),
      roots: existing?.roots // Preserve roots if already fetched
    };
    this.sessions.set(context.sessionId, sessionInfo);

    // If it's a new session, publish connection event
    if (!existing) {
      eventBus.publish('session-connected', {
        timestamp: Date.now(),
        session: sessionInfo
      });
    }
  }

  /**
   * Updates the workspace roots for a specific session.
   *
   * This method is typically called when a session provides its workspace root
   * directories.
   *
   * @param sessionId - The unique session identifier for the session
   * @param roots - Array of session root objects containing URI information
   *
   * @example
   * sessionTrackerService.updateSessionRoots('session-123', [
   *   { uri: 'file:///home/user/project' },
   *   { uri: 'file:///home/user/other-project' }
   * ]);
   */
  public updateSessionRoots(sessionId: string, roots: SessionRoot[]) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.roots = roots;
      session.lastSeen = Date.now();
    }
  }

  /**
   * Retrieves all currently tracked session information.
   *
   * Returns an array of all active session info objects, including their metadata
   * and connection state. This is useful for monitoring all connected sessions
   * or displaying session information in administrative interfaces.
   *
   * @returns Array of SessionInfo objects representing all tracked sessions
   *
   * @example
   * const allSessions = sessionTrackerService.getSessions();
   * console.log(`Currently tracking ${allSessions.length} sessions`);
   */
  public getSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Retrieves session information for a specific session ID.
   *
   * Returns the complete session info object for the given session ID, or undefined
   * if no session with that session ID is currently being tracked.
   *
   * @param sessionId - The unique session identifier to look up
   * @returns SessionInfo object if found, undefined otherwise
   *
   * @example
   * const session = sessionTrackerService.getSession('session-123');
   * if (session) {
   *   console.log(`Session ${session.clientName} is connected`);
   * }
   */
  public getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Cleans up stale session entries that haven't been seen recently.
   *
   * This private method is called periodically to remove sessions that haven't
   * sent any requests within the timeout period (5 minutes by default). When
   * a session is removed, it publishes a 'session-disconnected' event to notify
   * other services about the disconnection.
   *
   * This prevents memory leaks from accumulating disconnected sessions and ensures
   * that the session registry only contains active connections.
   *
   * @private
   */
  private cleanup() {
    const now = Date.now();
    for (const [id, info] of this.sessions.entries()) {
      if (now - info.lastSeen > this.TIMEOUT_MS) {
        logger.debug(
          `Removing stale session: ${id}. Last seen ${formatDuration(now - info.lastSeen)} ago, timeout ${formatDuration(this.TIMEOUT_MS)}`,
          LOG_MODULES.SESSION_TRACKER
        );
        this.sessions.delete(id);

        eventBus.publish('session-disconnected', {
          timestamp: Date.now(),
          sessionId: id,
          session: info
        });
      }
    }
  }
}

export const sessionTrackerService = new SessionTrackerService();

export type { SessionTrackerService };
