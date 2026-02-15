import { z } from 'zod';

/**
 * Session State Schema
 * Represents the persistent state of a client session
 */
export const SessionStateSchema = z.object({
  sessionId: z.string(),
  clientName: z.string().optional(),
  clientVersion: z.string().optional(),
  cwd: z.string().optional(),
  project: z.string().optional(),
  createdAt: z.number(),
  lastAccessedAt: z.number(),
  metadata: z.record(z.string(), z.any()).default({})
});

export type SessionState = z.infer<typeof SessionStateSchema>;

/**
 * Session Store Schema
 * Container for all persisted sessions
 */
export const SessionStoreSchema = z.object({
  version: z.string().default('1.0.0'),
  sessions: z.record(z.string(), SessionStateSchema).default({})
});

export type SessionStore = z.infer<typeof SessionStoreSchema>;

/**
 * Create a new empty session store
 */
export function createEmptySessionStore(): SessionStore {
  return {
    version: '1.0.0',
    sessions: {}
  };
}

/**
 * Validate and normalize session store data
 */
export function validateSessionStore(data: unknown): SessionStore {
  const result = SessionStoreSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  // Return empty store if validation fails
  return createEmptySessionStore();
}
