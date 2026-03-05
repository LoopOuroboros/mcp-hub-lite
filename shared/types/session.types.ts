/**
 * Session Types
 * Shared session types between frontend and backend
 */

// Import from shared models
import type { SessionState } from '../models/session.model.js';

/**
 * Session information for display in the UI
 */
export interface SessionInfo extends SessionState {
  // Additional computed fields for display
  isActive?: boolean;
  age?: string;
  lastAccessed?: string;
}

// Re-export SessionState for use in frontend
export type { SessionState };
