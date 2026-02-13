import type { Tool } from '@shared-models/tool.model.js';

export class SearchScorer {
  scoreTool(tool: Tool, query: string): number {
    const lowerQuery = query.toLowerCase();

    // 计算各字段得分
    const nameScore = this.scoreField(tool.name, lowerQuery, 12);
    const descScore = this.scoreField(tool.description || '', lowerQuery, 3);

    // 确保名称完全匹配的得分是最高的
    if (nameScore === 120) { // 10 * 12 = 120 表示名称精确匹配
      return nameScore;
    }

    // 如果没有名称完全匹配，确保名称前缀匹配的得分高于其他组合得分
    if (nameScore === 60) { // 5 * 12 = 60 表示名称前缀匹配
      // 限制描述的得分，确保不超过名称前缀匹配的得分
      const additionalScore = Math.min(descScore, 55);
      return nameScore + additionalScore;
    }

    // 对于其他情况，返回各字段得分的总和
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