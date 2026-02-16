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
 * Validates and normalizes session store data using Zod schema validation.
 *
 * This function takes raw session store data (typically parsed from JSON) and validates it
 * against the SessionStoreSchema. If validation succeeds, it returns the validated and
 * normalized data. If validation fails, it returns an empty session store with default values.
 *
 * The function uses safeParse to prevent exceptions during validation, making it safe to use
 * with untrusted or potentially corrupted data sources like persisted JSON files.
 *
 * @param {unknown} data - Raw session store data to validate (typically from JSON.parse)
 * @returns {SessionStore} Validated session store data, or an empty store if validation fails
 *
 * @example
 * ```typescript
 * // Validate data from a JSON file
 * const rawData = JSON.parse(fs.readFileSync('sessions.json', 'utf-8'));
 * const validatedStore = validateSessionStore(rawData);
 *
 * // Use the validated store
 * Object.keys(validatedStore.sessions).forEach(sessionId => {
 *   console.log(`Session: ${sessionId}`);
 * });
 * ```
 */
export function validateSessionStore(data: unknown): SessionStore {
  const result = SessionStoreSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  // Return empty store if validation fails
  return createEmptySessionStore();
}
