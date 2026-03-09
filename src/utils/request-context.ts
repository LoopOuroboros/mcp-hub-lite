/**
 * Request context management using AsyncLocalStorage for request-scoped data.
 *
 * This module provides a way to store and access request-specific context data
 * across asynchronous operations without having to pass context objects through
 * every function call. It uses Node.js AsyncLocalStorage to maintain context
 * throughout the request lifecycle.
 *
 * The primary use case is storing session context information (sessionId, clientName,
 * cwd, project, etc.) that needs to be accessible from any part of the application
 * during request processing.
 *
 * @module utils/request-context
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { SessionContext } from '@shared-types/session-context.types.js';

/**
 * AsyncLocalStorage instance for storing request context.
 *
 * This storage holds the SessionContext object for the current request and
 * makes it available throughout the entire request processing chain,
 * including asynchronous operations and nested function calls.
 *
 * @example
 * ```typescript
 * // In route handler
 * await requestContext.run(sessionContext, async () => {
 *   // Any code executed here can access the session context
 *   const ctx = getSessionContext();
 *   console.log(ctx.sessionId);
 * });
 * ```
 */
export const requestContext = new AsyncLocalStorage<SessionContext>();

/**
 * Retrieves the current request's session context.
 *
 * This function returns the SessionContext object stored in the AsyncLocalStorage
 * for the current request. It should only be called within a request context
 * that has been established using requestContext.run().
 *
 * @returns {SessionContext | undefined} The current request's session context, or undefined if not in a request context
 *
 * @example
 * ```typescript
 * const context = getSessionContext();
 * if (context) {
 *   console.log(`Processing request for session: ${context.sessionId}`);
 * }
 * ```
 */
export function getSessionContext(): SessionContext | undefined {
  return requestContext.getStore();
}

/**
 * Retrieves the current request's working directory (cwd).
 *
 * This is a convenience function that extracts the cwd property from the
 * current request's session context. It's commonly used in file operations
 * that need to respect the session's current working directory.
 *
 * @returns {string | undefined} The current request's working directory, or undefined if not available
 *
 * @example
 * ```typescript
 * const cwd = getSessionCwd();
 * if (cwd) {
 *   const fullPath = path.join(cwd, relativePath);
 * }
 * ```
 */
export function getSessionCwd(): string | undefined {
  return requestContext.getStore()?.cwd;
}
