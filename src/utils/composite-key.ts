/**
 * Composite key utilities for server instance identification
 *
 * This module provides utilities for generating and parsing composite keys
 * that uniquely identify a server instance across multiple instances
 * of the same server name.
 *
 * Format: `${serverName}-${serverIndex}`
 * Example: 'my-server-0', 'my-server-1', 'test-server-0'
 */

/**
 * Generates a composite key from serverName and serverIndex
 * @param serverName - The server name
 * @param serverIndex - The instance index
 * @returns Composite key string
 * @example getCompositeKey('my-server', 0) => 'my-server-0'
 */
export function getCompositeKey(serverName: string, serverIndex: number): string {
  return `${serverName}-${serverIndex}`;
}

/**
 * Parses a composite key back into serverName and serverIndex
 * @param key - The composite key to parse
 * @returns Object with serverName and serverIndex, or null if invalid
 * @example parseCompositeKey('my-server-0') => { serverName: 'my-server', serverIndex: 0 }
 */
export function parseCompositeKey(key: string): { serverName: string; serverIndex: number } | null {
  const lastDashIndex = key.lastIndexOf('-');
  if (lastDashIndex === -1) {
    return null;
  }
  const serverName = key.slice(0, lastDashIndex);
  const serverIndexPart = key.slice(lastDashIndex + 1);
  const serverIndex = parseInt(serverIndexPart, 10);
  if (isNaN(serverIndex)) {
    return null;
  }
  return { serverName, serverIndex };
}
