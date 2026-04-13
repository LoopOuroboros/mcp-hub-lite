/**
 * Instance ID generation utilities using content-based hashing.
 */

import { createHash } from 'node:crypto';
import type { ServerInstance } from '@config/config.schema.js';

/**
 * Generates a stable 8-character hash from an object.
 * Uses SHA-256 and returns the first 8 hex characters.
 *
 * @param obj - The object to hash
 * @returns An 8-character hex string
 */
export function generateInstanceHash(obj: Record<string, unknown>): string {
  function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return '[' + value.map(stableStringify).join(',') + ']';
    }
    const sortedObj: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sortedObj[key] = (value as Record<string, unknown>)[key];
    }
    return (
      '{' +
      Object.keys(sortedObj)
        .map((key) => JSON.stringify(key) + ':' + stableStringify(sortedObj[key]))
        .join(',') +
      '}'
    );
  }

  const stableString = stableStringify(obj);
  const hash = createHash('sha256');
  hash.update(stableString);
  return hash.digest('hex').slice(0, 8);
}

/**
 * Generates a deterministic instance ID based on server name and instance configuration.
 * The ID format is: ${serverName}-${hash}
 *
 * @param serverName - Name of the server
 * @param instanceConfig - Partial instance configuration
 * @returns A deterministic instance ID
 */
export function generateInstanceId(
  serverName: string,
  instanceConfig: Partial<ServerInstance>
): string {
  const hashableContent: Record<string, unknown> = {};
  if (instanceConfig.args && instanceConfig.args.length > 0) {
    hashableContent.args = instanceConfig.args;
  }
  if (instanceConfig.env) {
    hashableContent.env = instanceConfig.env;
  }
  if (instanceConfig.headers) {
    hashableContent.headers = instanceConfig.headers;
  }
  if (instanceConfig.tags && Object.keys(instanceConfig.tags).length > 0) {
    hashableContent.tags = instanceConfig.tags;
  }

  const hash = generateInstanceHash(hashableContent);
  return `${serverName}-${hash}`;
}
