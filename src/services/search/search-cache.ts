import type { Tool } from '@shared-models/tool.model.js';
import { logger } from '@utils/logger.js';

/**
 * Search cache service that provides time-based caching for search results.
 *
 * This service implements a simple TTL (Time-To-Live) cache mechanism for storing
 * and retrieving search results. It automatically invalidates cached data after
 * a specified time period (30 seconds by default) to ensure freshness while
 * providing performance benefits for repeated searches within the TTL window.
 *
 * The cache stores an array of Tool objects and maintains a timestamp of the last
 * update to determine cache validity. This is particularly useful in scenarios
 * where search operations might be expensive or frequently repeated, such as
 * in autocomplete or real-time search interfaces.
 *
 * @example
 * ```typescript
 * const cache = new SearchCacheService();
 *
 * // Set cache with search results
 * cache.set(searchResults);
 *
 * // Retrieve cached results (returns null if expired)
 * const results = cache.get();
 *
 * // Manually invalidate cache
 * cache.invalidate();
 * ```
 */
export class SearchCacheService {
  private cache: Tool[] | null = null;
  private lastUpdate: number = 0;
  private readonly CACHE_TTL = 30 * 1000;

  /**
   * Checks if the current cache is valid based on the TTL (Time-To-Live).
   *
   * A cache is considered valid if it exists and has not exceeded the
   * configured TTL since the last update. The default TTL is 30 seconds.
   *
   * @returns {boolean} True if the cache exists and is within the TTL window,
   *                    false otherwise (either no cache or expired).
   *
   * @example
   * ```typescript
   * if (cache.isValid()) {
   *   // Use cached results
   *   const results = cache.get();
   * }
   * ```
   */
  isValid(): boolean {
    if (!this.cache) return false;

    return Date.now() - this.lastUpdate < this.CACHE_TTL;
  }

  /**
   * Retrieves the cached search results if they are still valid.
   *
   * This method first checks if the cache is valid using the TTL mechanism.
   * If the cache is invalid or expired, it automatically clears the cache
   * and returns null. Otherwise, it returns the cached Tool array.
   *
   * @returns {Tool[] | null} The cached array of Tool objects if valid,
   *                          null if the cache is invalid, expired, or empty.
   *
   * @example
   * ```typescript
   * const cachedResults = cache.get();
   * if (cachedResults) {
   *   // Use cached results
   *   return cachedResults;
   * } else {
   *   // Perform fresh search
   *   const freshResults = performSearch();
   *   cache.set(freshResults);
   *   return freshResults;
   * }
   * ```
   */
  get(): Tool[] | null {
    if (!this.isValid()) {
      this.cache = null;
      return null;
    }

    return this.cache;
  }

  /**
   * Stores search results in the cache with the current timestamp.
   *
   * This method sets the provided Tool array as the cached value and
   * records the current timestamp as the last update time. The cache
   * will remain valid until it exceeds the TTL (30 seconds by default).
   *
   * @param {Tool[]} tools - The array of Tool objects to cache.
   *                         Must be a valid array of Tool instances.
   *
   * @example
   * ```typescript
   * const searchResults = await searchTools('pattern');
   * cache.set(searchResults);
   * ```
   */
  set(tools: Tool[]): void {
    this.cache = tools;
    this.lastUpdate = Date.now();
  }

  /**
   * Immediately invalidates and clears the current cache.
   *
   * This method forces the cache to be cleared by setting the cache to null
   * and resetting the last update timestamp to zero. After calling this method,
   * subsequent calls to `get()` will return null until new data is set.
   *
   * This is useful when external events indicate that cached data may be stale,
   * such as when servers are added, removed, or updated.
   *
   * @example
   * ```typescript
   * // Invalidate cache when server configuration changes
   * hubManager.on('serverUpdated', () => {
   *   searchCache.invalidate();
   * });
   * ```
   */
  invalidate(): void {
    this.cache = null;
    this.lastUpdate = 0;
  }

  /**
   * Updates a specific tool in the cache (deprecated method).
   *
   * This method is currently deprecated because the serverId field has been
   * removed from the Tool interface. It logs a warning message and performs
   * no actual operations. The method is kept for backward compatibility but
   * should not be used in new code.
   *
   * @deprecated This method is deprecated and does nothing. ServerId field
   *             has been removed from the Tool interface, making this method
   *             obsolete.
   *
   * @example
   * ```typescript
   * // This will log a warning but do nothing
   * cache.updateTool();
   * ```
   */
  updateTool(): void {
    // Since serverId field has been removed from Tool interface, this method needs refactoring
    // Currently kept but not performing any operations, or modify according to actual requirements
    logger.warn('updateTool method is deprecated because serverId field is removed from Tool', {
      subModule: 'Search'
    });
  }
}