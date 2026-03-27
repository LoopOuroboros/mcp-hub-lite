/**
 * Session Context Types
 * Shared session context types between frontend and backend
 */

import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js';

/**
 * Workspace root information
 */
export interface SessionRoot {
  uri: string;
  name?: string;
}

/**
 * Basic request context - for AsyncLocalStorage
 * Contains the minimal set of fields required for requests
 */
export interface SessionContext {
  sessionId: string;
  clientName?: string;
  clientVersion?: string;
  protocolVersion?: string;
  ip?: string;
  userAgent?: string;
  capabilities?: ClientCapabilities;
  timestamp: number;
}

/**
 * Complete session information - for tracking and display
 * Extends SessionContext with runtime state
 */
export interface SessionInfo extends SessionContext {
  lastSeen: number;
  roots?: SessionRoot[];
}
