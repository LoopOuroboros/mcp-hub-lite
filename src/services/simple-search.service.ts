import type { Tool } from '@shared-models/tool.model.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';

/**
 * Represents a search result containing a tool and its relevance score.
 */
export interface SearchResult {
  tool: Tool;
  score: number;
}

/**
 * A lightweight search service that provides basic string-based matching for MCP tools.
 *
 * This service is designed for small to medium-scale deployments (50-200 tools) where
 * performance requirements are modest (<100ms response time) and full-text search
 * capabilities are not required. It implements a simple scoring algorithm based on
 * exact matches, prefix matches, substring matches, and description matches.
 *
 * The search is case-insensitive and returns results sorted by relevance score in
 * descending order. Tools with higher scores appear first in the results.
 *
 * Use cases:
 * - Quick tool discovery in development environments
 * - Basic search functionality for independent developers
 * - Lightweight alternative when advanced search features are not needed
 *
 * For larger scale deployments or when fuzzy search is required, consider using
 * the SearchCoreService instead.
 */
export class SimpleSearchService {
  /**
   * Performs a case-insensitive search across all available MCP tools and returns
   * ranked results based on relevance scoring.
   *
   * The scoring algorithm works as follows:
   * - Exact name match: +10 points
   * - Name starts with query: +5 points
   * - Name contains query: +3 points
   * - Description contains query: +1 point
   *
   * Results are filtered to only include tools with a score greater than 0,
   * and are sorted by score in descending order (highest relevance first).
   *
   * @param query - The search query string. If empty or whitespace only,
   *                returns all tools with a score of 1.
   * @returns An array of SearchResult objects containing the matching tools
   *          and their relevance scores, sorted by score in descending order.
   *
   * @example
   * // Search for tools containing "find"
   * const results = simpleSearchService.search("find");
   * console.log(results[0].tool.name); // Highest scoring tool name
   * console.log(results[0].score);     // Relevance score (e.g., 10 for exact match)
   *
   * @example
   * // Get all tools (empty query)
   * const allTools = simpleSearchService.search("");
   * console.log(`Total tools: ${allTools.length}`);
   *
   * @example
   * // Case-insensitive search
   * const results1 = simpleSearchService.search("FIND");
   * const results2 = simpleSearchService.search("find");
   * // results1 and results2 will be identical
   */
  public search(query: string): SearchResult[] {
    const allTools = mcpConnectionManager.getAllTools();
    if (!query.trim()) {
      return allTools.map((t) => ({ tool: t, score: 1 }));
    }

    const lowerQuery = query.toLowerCase();

    return allTools
      .map((tool) => {
        let score = 0;
        const name = tool.name.toLowerCase();
        const desc = (tool.description || '').toLowerCase();

        if (name === lowerQuery) score += 10;
        else if (name.startsWith(lowerQuery)) score += 5;
        else if (name.includes(lowerQuery)) score += 3;

        if (desc.includes(lowerQuery)) score += 1;

        return { tool, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }
}

export const simpleSearchService = new SimpleSearchService();
