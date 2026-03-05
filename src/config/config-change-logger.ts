/**
 * Configuration change logging utilities.
 * Handles comparison and logging of configuration changes.
 */

import { logger, LOG_MODULES } from '@utils/logger.js';
import type { SystemConfig } from './config.schema.js';

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
  const changes: string[] = [];

  const compare = (obj1: unknown, obj2: unknown, path: string) => {
    const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const val1 =
        obj1 && typeof obj1 === 'object' ? (obj1 as Record<string, unknown>)[key] : undefined;
      const val2 =
        obj2 && typeof obj2 === 'object' ? (obj2 as Record<string, unknown>)[key] : undefined;

      if (JSON.stringify(val1) === JSON.stringify(val2)) continue;

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

  compare(oldConfig, newConfig, '');

  if (changes.length > 0) {
    logger.info(`${changes.join('\n')}`, LOG_MODULES.CONFIG_CHANGES);
  }
}
