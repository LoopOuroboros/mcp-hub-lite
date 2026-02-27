/**
 * JSON utilities for logging and formatting
 */

/**
 * Type for the config getter function to avoid direct import dependency.
 */
type ConfigGetter = () => { system: { logging: { jsonPretty: boolean } } };

/**
 * Optional config getter to retrieve jsonPretty setting from config.
 * This avoids circular dependency issues.
 */
let _configGetter: ConfigGetter | null = null;

/**
 * Set the config getter for jsonPretty setting.
 * This allows retrieving the setting from config without direct import dependency.
 *
 * @param getter - Function that returns the config object
 */
export function setJsonPrettyConfigGetter(getter: ConfigGetter): void {
  _configGetter = getter;
}

/**
 * Convert Node.js rawHeaders array [key1, value1, key2, value2, ...] to object
 * @param rawHeaders Node.js rawHeaders array
 * @returns Headers as key-value object
 */
export function rawHeadersToObject(rawHeaders: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const key = rawHeaders[i];
    const value = rawHeaders[i + 1];
    if (key !== undefined && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Stringify Node.js rawHeaders array for logging
 * Converts [key1, value1, key2, value2, ...] to readable object format
 * @param rawHeaders Node.js rawHeaders array
 * @returns Formatted JSON string
 */
export function stringifyRawHeadersForLogging(rawHeaders: string[]): string {
  const headersObj = rawHeadersToObject(rawHeaders);
  return stringifyForLogging(headersObj);
}

/**
 * Get JSON pretty setting from config getter if available, otherwise from environment variable.
 *
 * @returns boolean indicating whether to use pretty JSON formatting
 */
export function getJsonPrettySetting(): boolean {
  // Try config getter first
  if (_configGetter) {
    try {
      const config = _configGetter();
      return config.system.logging.jsonPretty;
    } catch {
      // Fall through to environment variable if config getter fails
    }
  }
  // Fall back to environment variable
  const envValue = process.env.LOG_JSON_PRETTY;
  if (envValue !== undefined) {
    return envValue.toLowerCase() === 'true' || envValue === '1';
  }
  return true; // Default to true (matches current default in config schema)
}

/**
 * Stringify object for logging with dynamic pretty formatting based on LOG_JSON_PRETTY environment variable
 * @param obj Object to stringify
 * @returns Formatted JSON string
 */
export function stringifyForLogging(obj: unknown): string {
  const jsonPretty = getJsonPrettySetting();
  if (jsonPretty) {
    return JSON.stringify(obj, null, 2);
  }
  return JSON.stringify(obj);
}

/**
 * Stringify object for logging with replacer and dynamic pretty formatting based on LOG_JSON_PRETTY environment variable
 * @param obj Object to stringify
 * @param replacer Optional replacer function
 * @returns Formatted JSON string
 */
export function stringifyForLoggingWithReplacer(
  obj: unknown,
  replacer?: (key: string, value: unknown) => unknown
): string {
  const jsonPretty = getJsonPrettySetting();
  if (jsonPretty) {
    return JSON.stringify(obj, replacer, 2);
  }
  return JSON.stringify(obj, replacer);
}
