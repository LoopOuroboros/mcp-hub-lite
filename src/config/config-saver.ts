/**
 * Configuration saving utilities.
 * Handles persisting configuration to disk with proper directory creation.
 */

import * as fs from 'fs';
import path from 'path';

/**
 * Checks if a value is considered empty and should be removed from the output.
 *
 * @param value - The value to check
 * @returns true if the value is empty and should be removed
 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string' && value === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
    return Object.keys(value).length === 0;
  }
  return false;
}

/**
 * Recursively cleans empty values from an object.
 * Empty values include: null, undefined, empty string '', empty array [], empty object {}.
 * The 'version' field is always preserved even if it would be considered empty.
 *
 * @param obj - The object to clean
 * @returns A new object with empty values removed
 */
function cleanEmptyValues(obj: unknown): unknown {
  // For non-object/array types, use isEmptyValue directly
  if (obj === null || obj === undefined) {
    return undefined;
  }

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return isEmptyValue(obj) ? undefined : obj;
  }

  if (Array.isArray(obj)) {
    const cleanedArray = obj
      .map((item) => cleanEmptyValues(item))
      .filter((item) => item !== undefined);
    return isEmptyValue(cleanedArray) ? undefined : cleanedArray;
  }

  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const result: Record<string, unknown> = {};
    let hasNonEmptyField = false;

    for (const [key, value] of Object.entries(obj)) {
      // Always preserve the 'version' field
      if (key === 'version') {
        result[key] = value;
        hasNonEmptyField = true;
        continue;
      }

      const cleanedValue = cleanEmptyValues(value);
      if (cleanedValue !== undefined) {
        result[key] = cleanedValue;
        hasNonEmptyField = true;
      }
    }

    // If we have version field, always keep the object even if it would otherwise be empty
    if ('version' in result) {
      return result;
    }

    return hasNonEmptyField ? result : undefined;
  }

  return obj;
}

/**
 * Saves the configuration to disk at the specified path.
 *
 * This function writes the current configuration to the configured file path,
 * creating the directory structure if it doesn't exist. Errors during the save
 * operation are silently ignored to prevent crashes during normal operation.
 *
 * Before writing, empty values (null, undefined, empty string, empty array, empty object)
 * are removed from the configuration to keep the file concise. The 'version' field is
 * always preserved.
 *
 * @param configPath - Path to save the configuration file
 * @param config - The configuration object to save
 */
export function saveConfig(configPath: string, config: unknown): void {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const cleanedConfig = cleanEmptyValues(config) || {};
    fs.writeFileSync(configPath, JSON.stringify(cleanedConfig, null, 2));
  } catch {
    // Ignore
  }
}
