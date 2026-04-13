/**
 * Object key sorting utilities for consistent configuration.
 */

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
 * Normalizes URL fields in a configuration object.
 * Currently handles:
 * - url fields at any level
 * - proxy.url fields
 *
 * @param obj - Object to normalize
 * @returns New object with normalized URLs
 */
function normalizeConfigUrls<T>(obj: T): T {
  if (!obj) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeConfigUrls(item)) as T;
  }

  if (typeof obj === 'object') {
    const result = {} as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'url' && typeof value === 'string') {
        result[key] = normalizeUrl(value);
      } else if (key === 'proxy' && typeof value === 'object' && value !== null) {
        const proxy = value as Record<string, unknown>;
        if (typeof proxy.url === 'string') {
          result[key] = { ...proxy, url: normalizeUrl(proxy.url) };
        } else {
          result[key] = normalizeConfigUrls(value);
        }
      } else {
        result[key] = normalizeConfigUrls(value);
      }
    }
    return result as T;
  }

  return obj;
}

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
 * Also normalizes URL fields by removing trailing slashes.
 *
 * @param config - Server configuration object with optional env and headers
 * @returns New object with sorted env and headers keys and normalized URLs
 */
export function sortServerConfigEnvHeaders<
  T extends { env?: Record<string, string>; headers?: Record<string, string> }
>(config: T): T {
  // First normalize URLs
  const normalized = normalizeConfigUrls(config);
  const result = { ...normalized };

  if (result.env) {
    result.env = sortObjectKeysCaseInsensitive(result.env);
  }

  if (result.headers) {
    result.headers = sortObjectKeysCaseInsensitive(result.headers);
  }

  return result;
}
