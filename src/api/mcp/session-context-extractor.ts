/**
 * Session Context Extractor for MCP Gateway.
 * Extracts and resolves session context from incoming requests.
 */

import type { FastifyRequest } from 'fastify';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { randomUUID } from 'crypto';
import type { ClientContext } from '@shared-types/client.types.js';
import { clientTrackerService } from '@services/client-tracker.service.js';
import { mcpSessionManager } from '@services/mcp-session-manager.js';

// MCP Protocol Request Body Types
export interface RequestBody {
  method?: string;
  params?: {
    clientInfo?: {
      name: string;
      version: string;
    };
    protocolVersion?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Extracts session context from incoming MCP requests to establish client identity and session management.
 *
 * This function implements a sophisticated session ID resolution strategy with multiple fallback mechanisms:
 * 1. Query parameter sessionId (for SSE connections)
 * 2. Initialize request parameters (for JSON-RPC initialization)
 * 3. Existing client tracker information (for subsequent requests)
 * 4. Persisted session states (for service restart recovery)
 * 5. New unique session ID generation (fallback)
 *
 * The function also extracts and enriches client context including name, version, working directory,
 * project information, IP address, and user agent for comprehensive session tracking.
 *
 * @param {FastifyRequest<{ Body: RequestBody | null }>} request - Incoming Fastify request object
 * @returns {{ sessionId: string; clientContext: ClientContext }} Object containing resolved session ID and enriched client context
 *
 * @example
 * ```typescript
 * const { sessionId, clientContext } = extractSessionContext(request);
 * console.log(`Session: ${sessionId}, Client: ${clientContext.clientName}`);
 * ```
 */
export function extractSessionContext(request: FastifyRequest<{ Body: RequestBody | null }>): {
  sessionId: string;
  clientContext: ClientContext;
} {
  const headers = request.headers;

  // Fully use the original clientId generation logic as sessionId
  // Priority 1: Session ID from Query (Standard MCP SSE)
  let sessionId = (request.query as { sessionId?: string })?.sessionId;

  if (request.url.includes('sessionId=')) {
    const match = request.url.match(/sessionId=([^&]+)/);
    if (match) {
      sessionId = match[1];
      logger.debug(`Extracted sessionId from URL: ${sessionId}`, LOG_MODULES.CONTEXT);
    }
  }

  let clientName = (headers['x-mcp-client-id'] as string) || (headers['x-client-id'] as string);
  const clients = clientTrackerService.getClients();
  const existingSessionStates = mcpSessionManager.getAllSessionStates();
  let clientVersion: string | undefined;
  let protocolVersion: string | undefined;
  logger.debug(
    `ClientName: ${clientName}, Query SessionId: ${sessionId}, Active Clients: ${clients.length}, Persisted Sessions: ${existingSessionStates.length}`,
    LOG_MODULES.CONTEXT
  );

  // Priority 2: For JSON-RPC requests like initialize, maintain session consistency
  if (!sessionId && request.body) {
    if (request.body.method === 'initialize' && request.body.params?.clientInfo) {
      const { name, version } = request.body.params.clientInfo;
      protocolVersion = request.body.params.protocolVersion;
      const cwd = (headers['x-mcp-cwd'] as string) || (headers['x-cwd'] as string);

      let baseId = `${name.replace(/[^a-zA-Z0-9-]/g, '')}-${version.replace(/[^a-zA-Z0-9-]/g, '')}`;
      if (cwd) {
        const cwdHash = cwd
          .split('')
          .reduce((acc, char) => {
            acc = (acc << 5) - acc + char.charCodeAt(0);
            return acc & acc;
          }, 0)
          .toString(16)
          .replace('-', '');
        baseId = `${baseId}-${cwdHash}`;
      } else {
        const randomHash = randomUUID().substring(0, 8);
        baseId = `${baseId}-${randomHash}`;
      }
      sessionId = baseId;
      logger.debug(`Extracted sessionId from initialize params: ${sessionId}`, LOG_MODULES.CONTEXT);

      // Save client version and protocol version information
      clientVersion = version;
      protocolVersion = request.body.params.protocolVersion;
      // Set clientName directly since we get more accurate information from the initialize request
      clientName = name;
    } else if (
      request.body.method === 'notifications/initialized' ||
      request.body.method === 'tools/list'
    ) {
      // For notifications/initialized and tools/list requests, we need to find existing sessions
      // Because these requests are typically sent immediately after initialize
      if (existingSessionStates.length > 0) {
        // If there are persisted sessions, prioritize using them (this indicates recovery after restart)
        logger.debug(
          `Found ${existingSessionStates.length} persisted session states, will try to match`,
          LOG_MODULES.CONTEXT
        );
        // First, look for sessions matching the current clientName
        if (clientName) {
          const matchedSession = existingSessionStates.find(
            (state) => state.clientName === clientName
          );
          if (matchedSession) {
            sessionId = matchedSession.sessionId;
            logger.debug(`Matched persisted session by clientName ${clientName}: ${sessionId}`, LOG_MODULES.CONTEXT);
          }
        }

        if (!sessionId && clients.length > 0) {
          // No matching persisted session found, use the latest active session
          const latestClient = clients.reduce((latest, current) => {
            return current.timestamp > latest.timestamp ? current : latest;
          });
          sessionId = latestClient.sessionId;
          logger.debug(
            `Extracted sessionId from latest client for ${request.body.method}: ${sessionId}`,
            LOG_MODULES.CONTEXT
          );
        }

        if (!sessionId && existingSessionStates.length > 0) {
          // Finally, try using the most recently accessed persisted session
          const sortedSessions = [...existingSessionStates].sort(
            (a, b) => b.lastAccessedAt - a.lastAccessedAt
          );
          sessionId = sortedSessions[0].sessionId;
          logger.debug(`Using most recently accessed persisted session: ${sessionId}`, LOG_MODULES.CONTEXT);
        }
      }
    }
  }

  // Priority 3: For any request without sessionId, try to find latest session
  // This handles cases like GET /mcp without query params and POST /mcp with tools/list
  if (!sessionId && clients.length > 0) {
    const latestClient = clients.reduce((latest, current) => {
      return current.timestamp > latest.timestamp ? current : latest;
    });
    sessionId = latestClient.sessionId;
    logger.debug(`Extracted sessionId from latest client: ${sessionId}`, LOG_MODULES.CONTEXT);
  }

  // Priority 4: Simplified session matching - only match exact sessionId or clientName
  if (!sessionId) {
    if (clientName) {
      const existingClient = clients.find((c) => c.clientName === clientName);
      if (existingClient) {
        sessionId = existingClient.sessionId; // Use existing sessionId
        logger.debug(`Found existing sessionId for ${clientName}: ${sessionId}`, LOG_MODULES.CONTEXT);
      }
    }
  }

  // Priority 4.5: Try to find from persisted session states (when clientTracker has no clients but sessions are persisted)
  if (!sessionId && existingSessionStates.length > 0) {
    logger.debug(`ClientTracker has no clients, using persisted session states`, LOG_MODULES.CONTEXT);
    // First, try to find matching clientName
    if (clientName) {
      const matchedSession = existingSessionStates.find((state) => state.clientName === clientName);
      if (matchedSession) {
        sessionId = matchedSession.sessionId;
        logger.debug(`Matched persisted session by clientName ${clientName}: ${sessionId}`, LOG_MODULES.CONTEXT);
      }
    }

    if (!sessionId) {
      // Use the most recently accessed
      const sortedSessions = [...existingSessionStates].sort(
        (a, b) => b.lastAccessedAt - a.lastAccessedAt
      );
      sessionId = sortedSessions[0].sessionId;
      logger.debug(`Using most recently accessed persisted session: ${sessionId}`, LOG_MODULES.CONTEXT);
    }
  }

  // Priority 5: Generate new unique session ID only if no other method works
  if (!sessionId) {
    const prefix = clientName ? `${clientName.replace(/[^a-zA-Z0-9-]/g, '')}-` : 'session-';
    sessionId = `${prefix}${randomUUID().substring(0, 8)}`;
    // Detect if this is an initial StreamableHttp connection (GET request without any session context)
    if (!clientName && !request.body) {
      logger.debug(`Initial StreamableHttp connection - created new sessionId: ${sessionId}`, LOG_MODULES.CONTEXT);
    } else {
      logger.debug(`Generated new sessionId: ${sessionId}`, LOG_MODULES.CONTEXT);
    }
  }

  // Add consistency check before returning session information
  if (sessionId && mcpSessionManager.getSessionState(sessionId)) {
    const hasSessionObject = mcpSessionManager.hasSession(sessionId);
    if (!hasSessionObject) {
      logger.warn(`Session state exists but session object missing for ${sessionId}`, LOG_MODULES.CONTEXT);
    }
  }

  const clientContext: ClientContext = {
    sessionId,
    clientName,
    clientVersion,
    protocolVersion,
    cwd: (headers['x-mcp-cwd'] as string) || (headers['x-cwd'] as string),
    project: (headers['x-mcp-project'] as string) || (headers['x-project'] as string),
    ip: request.ip,
    userAgent: headers['user-agent'],
    timestamp: Date.now()
  };

  return { sessionId, clientContext };
}
