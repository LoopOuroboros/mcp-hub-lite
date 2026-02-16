/**
 * Request context management using AsyncLocalStorage for request-scoped data.
 *
 * This module provides a way to store and access request-specific context data
 * across asynchronous operations without having to pass context objects through
 * every function call. It uses Node.js AsyncLocalStorage to maintain context
 * throughout the request lifecycle.
 *
 * The primary use case is storing client context information (sessionId, clientName,
 * cwd, project, etc.) that needs to be accessible from any part of the application
 * during request processing.
 *
 * @module utils/request-context
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { ClientContext } from '@shared-types/client.types';

/**
 * AsyncLocalStorage instance for storing request context.
 *
 * This storage holds the ClientContext object for the current request and
 * makes it available throughout the entire request processing chain,
 * including asynchronous operations and nested function calls.
 *
 * @example
 * ```typescript
 * // In route handler
 * await requestContext.run(clientContext, async () => {
 *   // Any code executed here can access the client context
 *   const ctx = getClientContext();
 *   console.log(ctx.sessionId);
 * });
 * ```
 */
export const requestContext = new AsyncLocalStorage<ClientContext>();

/**
 * Retrieves the current request's client context.
 *
 * This function returns the ClientContext object stored in the AsyncLocalStorage
 * for the current request. It should only be called within a request context
 * that has been established using requestContext.run().
 *
 * @returns {ClientContext | undefined} The current request's client context, or undefined if not in a request context
 *
 * @example
 * ```typescript
 * const context = getClientContext();
 * if (context) {
 *   console.log(`Processing request for session: ${context.sessionId}`);
 * }
 * ```
 */
export function getClientContext(): ClientContext | undefined {
  return requestContext.getStore();
}

/**
 * Retrieves the current request's working directory (cwd).
 *
 * This is a convenience function that extracts the cwd property from the
 * current request's client context. It's commonly used in file operations
 * that need to respect the client's current working directory.
 *
 * @returns {string | undefined} The current request's working directory, or undefined if not available
 *
 * @example
 * ```typescript
 * const cwd = getClientCwd();
 * if (cwd) {
 *   const fullPath = path.join(cwd, relativePath);
 * }
 * ```
 */
export function getClientCwd(): string | undefined {
  return requestContext.getStore()?.cwd;
}
