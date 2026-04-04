/**
 * Configuration change logging utilities.
 * Handles comparison and logging of configuration changes.
 */

import { logger, LOG_MODULES } from '@utils/logger.js';
import type { SystemConfig } from './config.schema.js';

/**
 * Normalizes a URL string by removing trailing slashes.
 *
 * @param url - The URL to normalize
 * @returns Normalized URL
 */
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Checks if a path looks like a URL field.
 *
 * @param path - The field path to check
 * @returns True if the path looks like a URL field
 */
function isUrlField(path: string): boolean {
  const urlPatterns = [/\.url$/, /^url$/, /\.proxy\.url$/];
  return urlPatterns.some((pattern) => pattern.test(path));
}

/**
 * Compares two values with URL normalization support.
 *
 * @param val1 - First value
 * @param val2 - Second value
 * @param path - The field path for context
 * @returns True if values are considered equal
 */
function areValuesEqual(val1: unknown, val2: unknown, path: string): boolean {
  // Special handling for URL fields
  if (isUrlField(path)) {
    if (typeof val1 === 'string' && typeof val2 === 'string') {
      return normalizeUrl(val1) === normalizeUrl(val2);
    }
  }
  return JSON.stringify(val1) === JSON.stringify(val2);
}

/**
 * Gets the changes between two objects.
 *
 * This function performs a deep comparison of two objects
 * and returns all changes at the field level.
 *
 * @param oldObj - The original object
 * @param newObj - The new object
 * @returns An array of change strings
 */
export function getObjectChanges(oldObj: unknown, newObj: unknown): string[] {
  const changes: string[] = [];

  const compare = (obj1: unknown, obj2: unknown, path: string) => {
    const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const val1 =
        obj1 && typeof obj1 === 'object' ? (obj1 as Record<string, unknown>)[key] : undefined;
      const val2 =
        obj2 && typeof obj2 === 'object' ? (obj2 as Record<string, unknown>)[key] : undefined;

      if (areValuesEqual(val1, val2, currentPath)) continue;

      if (
        typeof val1 === 'object' &&
        val1 !== null &&
        typeof val2 === 'object' &&
        val2 !== null &&
        !Array.isArray(val1) &&
        !Array.isArray(val2)
      ) {
        compare(val1, val2, currentPath);
      } else {
        const formatVal = (v: unknown) => (v === undefined ? 'undefined' : JSON.stringify(v));
        changes.push(`${currentPath} = ${formatVal(val1)} -> ${formatVal(val2)}`);
      }
    }
  };

  compare(oldObj, newObj, '');
  return changes;
}

/**
 * Logs object changes with a custom title.
 *
 * @param title - The title to display before the changes
 * @param oldObj - The original object
 * @param newObj - The new object
 * @param logModule - The log module to use
 */
export function logObjectChangesWithTitle(
  title: string,
  oldObj: unknown,
  newObj: unknown,
  logModule: { module: string } = LOG_MODULES.CONFIG_CHANGES
): void {
  const changes = getObjectChanges(oldObj, newObj);

  if (changes.length > 0) {
    const message = `${title}\n${changes.join('\n')}`;
    logger.info(message, logModule);
  }
}

/**
 * Logs the differences between two system configurations.
 *
 * This function performs a deep comparison of two configuration objects
 * and logs all changes at the field level for audit purposes.
 *
 * @param oldConfig - The original configuration
 * @param newConfig - The new configuration
 */
export function logConfigChanges(oldConfig: SystemConfig, newConfig: SystemConfig): void {
  const changes = getObjectChanges(oldConfig, newConfig);

  if (changes.length > 0) {
    const message = `System Config Changes：\n${changes.join('\n')}`;
    logger.info(message, LOG_MODULES.CONFIG_CHANGES);
  }
}
