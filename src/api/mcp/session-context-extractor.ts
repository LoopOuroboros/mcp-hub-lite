/**
 * Session Context Extractor for MCP Gateway.
 * Extracts and resolves session context from incoming requests.
 */

import type { FastifyRequest } from 'fastify';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { randomUUID } from 'crypto';
import type { ClientContext } from '@shared-types/client.types.js';
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
 * This function implements a simplified session ID resolution strategy with clear priority:
 * 1. Header parameter mcp-session-id/Mcp-Session-Id (highest priority)
 * 2. Query parameter sessionId (for SSE connections)
 * 3. URL pattern match for sessionId
 * 4. Initialize request: generate from clientInfo (only for initialize requests without sessionId)
 * 5. Generate new unique session ID (fallback for non-initialize requests)
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

  // Priority 1: Session ID from Header (highest priority)
  let sessionId: string | undefined =
    (headers['mcp-session-id'] as string) || (headers['Mcp-Session-Id'] as string);
  if (sessionId) {
    logger.debug(`Extracted sessionId from header: ${sessionId}`, LOG_MODULES.CONTEXT);
  }

  // Priority 2: Session ID from Query (Standard MCP SSE)
  if (!sessionId) {
    sessionId = (request.query as { sessionId?: string })?.sessionId;
    if (sessionId) {
      logger.debug(`Extracted sessionId from query: ${sessionId}`, LOG_MODULES.CONTEXT);
    }
  }

  // Priority 3: URL pattern match for sessionId
  if (!sessionId && request.url.includes('sessionId=')) {
    const match = request.url.match(/sessionId=([^&]+)/);
    if (match) {
      sessionId = match[1];
      logger.debug(`Extracted sessionId from URL: ${sessionId}`, LOG_MODULES.CONTEXT);
    }
  }

  // If sessionId was extracted, check if it exists in persisted sessions (for debugging)
  if (sessionId) {
    const persistedSession = mcpSessionManager.getSessionState(sessionId);
    if (persistedSession) {
      logger.debug(`Session ${sessionId} found in persisted sessions`, LOG_MODULES.CONTEXT);
    } else {
      logger.debug(
        `Session ${sessionId} not found in persisted sessions (will create new)`,
        LOG_MODULES.CONTEXT
      );
    }
  }

  // Extract client info from headers and request body
  let clientName = (headers['x-mcp-client-id'] as string) || (headers['x-client-id'] as string);
  let clientVersion: string | undefined;
  let protocolVersion: string | undefined;

  // Priority 4: For initialize requests without sessionId, generate from clientInfo
  const isInitializeRequest = request.body?.method === 'initialize';
  if (!sessionId && isInitializeRequest && request.body?.params?.clientInfo) {
    const { name, version } = request.body.params.clientInfo;
    protocolVersion = request.body.params.protocolVersion;

    // Generate sessionId from client info with random hash (no cwd dependency)
    const baseId = `${name.replace(/[^a-zA-Z0-9-]/g, '')}-${version.replace(/[^a-zA-Z0-9-]/g, '')}`;
    const randomHash = randomUUID().substring(0, 8);
    sessionId = `${baseId}-${randomHash}`;
    logger.debug(`Generated sessionId from initialize params: ${sessionId}`, LOG_MODULES.CONTEXT);

    // Save client version and protocol version information
    clientVersion = version;
    protocolVersion = request.body.params.protocolVersion;
    // Set clientName directly since we get more accurate information from the initialize request
    clientName = name;
  }

  // Priority 5: Generate new unique session ID for non-initialize requests
  if (!sessionId) {
    const prefix = clientName ? `${clientName.replace(/[^a-zA-Z0-9-]/g, '')}-` : 'session-';
    sessionId = `${prefix}${randomUUID().substring(0, 8)}`;
    if (!clientName && !request.body) {
      logger.debug(
        `Initial StreamableHttp connection - created new sessionId: ${sessionId}`,
        LOG_MODULES.CONTEXT
      );
    } else {
      logger.debug(`Generated new sessionId: ${sessionId}`, LOG_MODULES.CONTEXT);
    }
  }

  // Add consistency check before returning session information
  if (sessionId && mcpSessionManager.getSessionState(sessionId)) {
    const hasSessionObject = mcpSessionManager.hasSession(sessionId);
    if (!hasSessionObject) {
      logger.warn(
        `Session state exists but session object missing for ${sessionId}`,
        LOG_MODULES.CONTEXT
      );
    }
  }

  const clientContext: ClientContext = {
    sessionId,
    clientName,
    clientVersion,
    protocolVersion,
    cwd: undefined, // Will be populated from roots/list response later
    project: undefined, // Will be populated from roots/list response later
    ip: request.ip,
    userAgent: headers['user-agent'],
    timestamp: Date.now()
  };

  return { sessionId, clientContext };
}
