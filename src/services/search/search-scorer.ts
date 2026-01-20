import { McpTool } from '../../models/tool.model.js';

export class SearchScorer {
  scoreTool(tool: McpTool, query: string): number {
    const lowerQuery = query.toLowerCase();

    // 计算各字段得分
    const nameScore = this.scoreField(tool.name, lowerQuery, 12);
    const tagsScore = this.scoreTags(tool.tags, lowerQuery, 5);
    const descScore = this.scoreField(tool.description || '', lowerQuery, 3);

    // 确保名称完全匹配的得分是最高的
    if (nameScore === 120) { // 10 * 12 = 120 表示名称精确匹配
      return nameScore;
    }

    // 如果没有名称完全匹配，确保名称前缀匹配的得分高于其他组合得分
    if (nameScore === 60) { // 5 * 12 = 60 表示名称前缀匹配
      // 限制标签和描述的总得分，确保不超过名称前缀匹配的得分
      const additionalScore = Math.min(tagsScore + descScore, 55);
      return nameScore + additionalScore;
    }

    // 对于其他情况，返回各字段得分的总和
    return nameScore + tagsScore + descScore;
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

  private scoreTags(tags: string[] | undefined, query: string, weight: number): number {
    if (!tags || tags.length === 0) return 0;

    let maxScore = 0;

    for (const tag of tags) {
      const tagName = this.extractTagName(tag);
      const fieldScore = this.scoreField(tagName, query, weight);

      if (fieldScore > maxScore) {
        maxScore = fieldScore;
      }
    }

    return maxScore;
  }

  private extractTagName(tag: string): string {
    const parts = tag.split(':');
    return parts.length > 1 ? parts[1] : parts[0];
  }
}