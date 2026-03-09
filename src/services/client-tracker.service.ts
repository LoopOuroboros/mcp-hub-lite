import type { ClientContext, ClientInfo, ClientRoot } from '@shared-types/client.types.js';
import { logger } from '@utils/logger.js';
import { eventBus } from './event-bus.service.js';
import { fileURLToPath } from 'node:url';
import { configManager } from '@config/config-manager.js';
import { formatDuration } from '@utils/format-utils.js';

/**
 * Client tracking service that manages client connections and their metadata.
 *
 * This service maintains a registry of connected clients (typically IDEs or other
 * MCP clients) and tracks their connection state, metadata, and workspace roots.
 * It provides automatic cleanup of stale clients after a timeout period and
 * publishes connection/disconnection events via the event bus.
 *
 * The service is primarily used by the MCP session manager to track which clients
 * are connected and maintain their context information for proper session management.
 *
 * @example
 * // Update client information when a new connection is established
 * clientTrackerService.updateClient({
 *   sessionId: 'session-123',
 *   clientName: 'VS Code',
 *   clientVersion: '1.85.0',
 *   cwd: '/home/user/project'
 * });
 *
 * // Get all currently connected clients
 * const clients = clientTrackerService.getClients();
 */
class ClientTrackerService {
  private clients: Map<string, ClientInfo> = new Map();
  // Use the same timeout as session manager (default 30 minutes)
  private get TIMEOUT_MS(): number {
    return configManager.getConfig().security.sessionTimeout;
  }

  /**
   * Creates a new client tracker service instance.
   *
   * Initializes the service with automatic periodic cleanup of stale clients
   * every 60 seconds to prevent memory leaks from disconnected clients.
   */
  constructor() {
    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Updates or creates a client entry with the provided context information.
   *
   * This method is called whenever a client sends a request with context information.
   * It preserves existing client metadata that isn't provided in the new context,
   * ensuring that clients don't lose their previously established information.
   *
   * If this is a new client (not previously tracked), it publishes a 'client-connected'
   * event to notify other services about the new connection.
   *
   * @param context - The client context containing session ID and optional metadata
   * @param context.sessionId - Unique identifier for the client session
   * @param context.clientName - Optional name of the client application
   * @param context.clientVersion - Optional version of the client application
   * @param context.protocolVersion - Optional MCP protocol version
   * @param context.project - Optional project identifier
   * @param context.cwd - Optional current working directory
   * @param context.userAgent - Optional user agent string
   * @param context.ip - Optional client IP address
   *
   * @example
   * clientTrackerService.updateClient({
   *   sessionId: 'session-123',
   *   clientName: 'VS Code',
   *   clientVersion: '1.85.0',
   *   cwd: '/home/user/project'
   * });
   */
  public updateClient(context: ClientContext) {
    const existing = this.clients.get(context.sessionId);
    const clientInfo: ClientInfo = {
      ...context,
      // Preserve existing info if not provided in new request
      clientName: context.clientName || existing?.clientName,
      clientVersion: context.clientVersion || existing?.clientVersion,
      protocolVersion: context.protocolVersion || existing?.protocolVersion,
      capabilities: context.capabilities || existing?.capabilities,
      project: context.project || existing?.project,
      cwd: context.cwd || existing?.cwd, // Preserve CWD if not provided in new request (e.g. inferred from roots)
      userAgent: context.userAgent || existing?.userAgent,
      ip: context.ip || existing?.ip,

      lastSeen: Date.now(),
      roots: existing?.roots // Preserve roots if already fetched
    };
    this.clients.set(context.sessionId, clientInfo);

    // If it's a new client, publish connection event
    if (!existing) {
      eventBus.publish('client-connected', {
        timestamp: Date.now(),
        client: clientInfo
      });
    }
  }

  /**
   * Updates the workspace roots for a specific client session.
   *
   * This method is typically called when a client provides its workspace root
   * directories, which helps determine the client's working directory context.
   * If the client doesn't have a current working directory (cwd) set, it will
   * attempt to infer one from the first root URI in the list.
   *
   * For file:// URIs, it converts them to local file paths using Node.js's
   * fileURLToPath utility. For other URI schemes, it uses the URI directly.
   *
   * @param sessionId - The unique session identifier for the client
   * @param roots - Array of client root objects containing URI information
   *
   * @example
   * clientTrackerService.updateClientRoots('session-123', [
   *   { uri: 'file:///home/user/project' },
   *   { uri: 'file:///home/user/other-project' }
   * ]);
   */
  public updateClientRoots(sessionId: string, roots: ClientRoot[]) {
    const client = this.clients.get(sessionId);
    if (client) {
      client.roots = roots;
      client.lastSeen = Date.now();

      // If CWD is missing, try to infer from roots
      if (!client.cwd && roots.length > 0) {
        // Convert file:// uri to path if possible, or just use URI
        const root = roots[0];
        if (root.uri.startsWith('file://')) {
          try {
            client.cwd = fileURLToPath(root.uri);
          } catch {
            client.cwd = root.uri;
          }
        } else {
          client.cwd = root.uri;
        }
        logger.debug(`Inferred CWD for session ${sessionId} from roots: ${client.cwd}`);
      }

      // If project is missing, try to infer from roots (use name or last path segment)
      if (!client.project && roots.length > 0) {
        const root = roots[0];
        if (root.name) {
          client.project = root.name;
        } else if (root.uri.startsWith('file://')) {
          try {
            const localPath = fileURLToPath(root.uri);
            const pathSegments = localPath.split(/[/\\]/);
            const lastSegment = pathSegments.filter(Boolean).pop();
            if (lastSegment) {
              client.project = lastSegment;
            }
          } catch {
            // If path parsing fails, don't set project
          }
        }
        if (client.project) {
          logger.debug(`Inferred project for session ${sessionId} from roots: ${client.project}`);
        }
      }
    }
  }

  /**
   * Retrieves all currently tracked client information.
   *
   * Returns an array of all active client info objects, including their metadata
   * and connection state. This is useful for monitoring all connected clients
   * or displaying client information in administrative interfaces.
   *
   * @returns Array of ClientInfo objects representing all tracked clients
   *
   * @example
   * const allClients = clientTrackerService.getClients();
   * console.log(`Currently tracking ${allClients.length} clients`);
   */
  public getClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /**
   * Retrieves client information for a specific session ID.
   *
   * Returns the complete client info object for the given session ID, or undefined
   * if no client with that session ID is currently being tracked.
   *
   * @param sessionId - The unique session identifier to look up
   * @returns ClientInfo object if found, undefined otherwise
   *
   * @example
   * const client = clientTrackerService.getClient('session-123');
   * if (client) {
   *   console.log(`Client ${client.clientName} is connected`);
   * }
   */
  public getClient(sessionId: string): ClientInfo | undefined {
    return this.clients.get(sessionId);
  }

  /**
   * Cleans up stale client entries that haven't been seen recently.
   *
   * This private method is called periodically to remove clients that haven't
   * sent any requests within the timeout period (5 minutes by default). When
   * a client is removed, it publishes a 'client-disconnected' event to notify
   * other services about the disconnection.
   *
   * This prevents memory leaks from accumulating disconnected clients and ensures
   * that the client registry only contains active connections.
   *
   * @private
   */
  private cleanup() {
    const now = Date.now();
    for (const [id, info] of this.clients.entries()) {
      if (now - info.lastSeen > this.TIMEOUT_MS) {
        logger.debug(
          `Removing stale client: ${id}. Last seen ${formatDuration(now - info.lastSeen)} ago, timeout ${formatDuration(this.TIMEOUT_MS)}`
        );
        this.clients.delete(id);

        eventBus.publish('client-disconnected', {
          timestamp: Date.now(),
          clientId: id,
          client: info
        });
      }
    }
  }
}

export const clientTrackerService = new ClientTrackerService();
