/**
 * Type conversion utilities for configuration management.
 * Handles backward compatibility type conversions.
 */

import { TransportType } from './config.schema.js';

/**
 * Unified type conversion method: convert type: 'http' to type: 'streamable-http'
 * Ensure compatibility across all scenarios (loading, adding, updating)
 *
 * @param config - The configuration object to convert
 * @returns The converted configuration object
 */
export function convertHttpToStreamableHttp(config: unknown): unknown {
  if (!config) return config;

  // If it's an array, process each element
  if (Array.isArray(config)) {
    return config.map((item) => convertHttpToStreamableHttp(item));
  }

  // If it's an object, create a copy to avoid directly modifying the original object
  if (typeof config === 'object' && config !== null) {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (key === 'type' && value === TransportType.HTTP) {
        result[key] = TransportType.STREAMABLE_HTTP;
      } else if (typeof value === 'object' && value !== null) {
        result[key] = convertHttpToStreamableHttp(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // Return primitive types directly
  return config;
}
