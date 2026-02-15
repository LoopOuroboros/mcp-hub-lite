import type { Tool } from '@shared-models/tool.model.js';

export class SearchScorer {
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
