/**
 * Object key sorting utilities for consistent configuration.
 */

/**
 * Sorts object keys alphabetically using localeCompare.
 * Returns a new object with sorted keys, preserving the original object.
 *
 * @param obj - Object to sort
 * @returns New object with sorted keys
 */
export function sortObjectKeys<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const sortedObj = {} as T;
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    sortedObj[key as keyof T] = obj[key as keyof T];
  }
  return sortedObj;
}

/**
 * Sorts object keys alphabetically, case-insensitive.
 * Returns a new object with sorted keys, preserving the original object and original key case.
 *
 * @param obj - Object to sort
 * @returns New object with sorted keys (case-insensitive sort)
 */
export function sortObjectKeysCaseInsensitive<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const sortedObj = {} as T;
  const keys = Object.keys(obj).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  for (const key of keys) {
    sortedObj[key as keyof T] = obj[key as keyof T];
  }
  return sortedObj;
}

/**
 * Recursively sorts all object keys in a nested structure.
 * Returns a new object with all nested keys sorted, preserving the original object.
 *
 * @param obj - Object to sort recursively
 * @returns New object with all nested keys sorted
 */
export function sortObjectKeysDeep<T>(obj: T): T {
  if (!obj) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sortObjectKeysDeep(item)) as T;
  }

  if (typeof obj === 'object') {
    const sortedObj = {} as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      sortedObj[key] = sortObjectKeysDeep((obj as Record<string, unknown>)[key]);
    }
    return sortedObj as T;
  }

  return obj;
}

/**
 * Sorts env and headers objects in a server configuration.
 * This is a convenience function for server template/instance configurations.
 *
 * @param config - Server configuration object with optional env and headers
 * @returns New object with sorted env and headers keys
 */
export function sortServerConfigEnvHeaders<
  T extends { env?: Record<string, string>; headers?: Record<string, string> }
>(config: T): T {
  const result = { ...config };

  if (result.env) {
    result.env = sortObjectKeysCaseInsensitive(result.env);
  }

  if (result.headers) {
    result.headers = sortObjectKeysCaseInsensitive(result.headers);
  }

  return result;
}
