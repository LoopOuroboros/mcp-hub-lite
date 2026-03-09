/**
 * Client Types
 * Shared client session types between frontend and backend
 */

import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js';

/**
 * Workspace root information
 */
export interface ClientRoot {
  uri: string;
  name?: string;
}

/**
 * Basic request context - for AsyncLocalStorage
 * Contains the minimal set of fields required for requests
 */
export interface ClientContext {
  sessionId: string;
  clientName?: string;
  clientVersion?: string;
  protocolVersion?: string;
  cwd?: string;
  project?: string;
  ip?: string;
  userAgent?: string;
  capabilities?: ClientCapabilities;
  timestamp: number;
}

/**
 * Complete client information - for tracking and display
 * Extends ClientContext with runtime state
 */
export interface ClientInfo extends ClientContext {
  lastSeen: number;
  roots?: ClientRoot[];
}
