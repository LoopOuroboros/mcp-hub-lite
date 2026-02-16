import type { Tool } from '@shared-models/tool.model.js';

/**
 * SearchScorer class provides relevance scoring functionality for search results.
 * It calculates weighted scores for tools based on how well their fields (name, description)
 * match against a given search query using different matching strategies.
 *
 * The scoring algorithm prioritizes matches in the following order:
 * 1. Exact name matches (highest priority)
 * 2. Name prefix matches (second highest priority)
 * 3. Partial matches in name or description (lower priority)
 *
 * Each field has configurable weights that determine its importance in the final score.
 * The name field typically has a higher weight than the description field to ensure
 * that tools with relevant names appear higher in search results.
 *
 * This class is used by the SearchCoreService to rank and sort search results
 * based on relevance to provide better user experience in tool discovery.
 */
export class SearchScorer {
  /**
   * Calculates the relevance score for a tool against a search query.
   *
   * The scoring logic ensures proper ranking by:
   * - Giving exact name matches the highest possible score (120 points)
   * - Ensuring name prefix matches have higher scores than any combination of
   *   partial matches in other fields
   * - Combining scores from multiple fields while maintaining proper priorities
   *
   * @param tool - The Tool object to score against the query
   * @param query - The search query string to match against tool fields
   * @returns A numerical score representing the relevance of the tool to the query
   *          Higher scores indicate better matches
   */
  scoreTool(tool: Tool, query: string): number {
    const lowerQuery = query.toLowerCase();

    // Calculate scores for each field
    const nameScore = this.scoreField(tool.name, lowerQuery, 12);
    const descScore = this.scoreField(tool.description || '', lowerQuery, 3);

    // Ensure exact name match has the highest score
    if (nameScore === 120) {
      // 10 * 12 = 120 indicates exact name match
      return nameScore;
    }

    // If no exact name match, ensure name prefix match score is higher than other combined scores
    if (nameScore === 60) {
      // 5 * 12 = 60 indicates name prefix match
      // Limit description score to ensure it doesn't exceed name prefix match score
      const additionalScore = Math.min(descScore, 55);
      return nameScore + additionalScore;
    }

    // For other cases, return the sum of scores from all fields
    return nameScore + descScore;
  }

  /**
   * Calculates the score for a single text field against a search query.
   *
   * The scoring uses three levels of matching with decreasing priority:
   * 1. Exact match: Returns 10 * weight (highest score)
   * 2. Prefix match: Returns 5 * weight (medium score)
   * 3. Contains match: Returns 3 * weight (lowest score)
   * 4. No match: Returns 0
   *
   * This method performs case-insensitive matching by converting both
   * the input text and query to lowercase before comparison.
   *
   * @param text - The text field to evaluate (e.g., tool name or description)
   * @param query - The lowercase search query to match against
   * @param weight - The importance weight for this field (higher = more important)
   * @returns A numerical score based on the match type multiplied by the field weight
   */
  private scoreField(text: string, query: string, weight: number): number {
    const lowerText = text.toLowerCase();

    if (lowerText === query) {
      return 10 * weight;
    }

    if (lowerText.startsWith(query)) {
      return 5 * weight;
    }

    if (lowerText.includes(query)) {
      return 3 * weight;
    }

    return 0;
  }
}
