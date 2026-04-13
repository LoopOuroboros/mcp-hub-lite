import { z } from 'zod';

/**
 * Session State Schema
 * Represents the state of a client session (in-memory only)
 */
export const SessionStateSchema = z.object({
  sessionId: z.string(),
  clientName: z.string().optional(),
  clientVersion: z.string().optional(),
  protocolVersion: z.string().optional(),
  userAgent: z.string().optional(),
  ip: z.string().optional(),
  capabilities: z.any().optional(),
  createdAt: z.number(),
  lastAccessedAt: z.number(),
  metadata: z.record(z.string(), z.any()).default({})
});

export type SessionState = z.infer<typeof SessionStateSchema>;
