/**
 * JSON utilities for logging and formatting
 */

/**
 * Get JSON pretty setting from environment variable
 * @returns boolean indicating whether to use pretty JSON formatting
 */
export function getJsonPrettySetting(): boolean {
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
