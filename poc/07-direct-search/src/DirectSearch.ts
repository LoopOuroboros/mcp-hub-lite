/**
 * DirectSearch 搜索引擎
 * 零构建时间，即时搜索，无需预构建索引
 */
import type { MCPTool, SearchResult, DirectSearchConfig } from './types.js';

export class DirectSearchEngine {
  private tools: MCPTool[] = [];
  private config: DirectSearchConfig;

  constructor(config: Partial<DirectSearchConfig> = {}) {
    this.config = {
      maxSearchResults: 50,
      fuzzyThreshold: 0.6,
      enableFuzzySearch: true,
      cacheResults: false,
      ...config
    };
  }

  /**
   * 直接搜索，无需索引
   * 算法复杂度: O(n) - 线性搜索
   * 优点: 零内存占用，零构建时间
   * 适用于: 1000-5000工具场景
   */
  search(query: string): SearchResult[] {
    if (!query || query.trim().length === 0) {
      return this.tools.slice(0, this.config.maxSearchResults).map(tool => ({
        tool,
        score: 0,
        matchedFields: []
      }));
    }

    const startTime = performance.now();
    const searchQuery = query.toLowerCase().trim();
    const queryTerms = searchQuery.split(/\s+/);

    const results: SearchResult[] = [];

    for (const tool of this.tools) {
      const { score, matchedFields } = this.calculateScore(tool, queryTerms);

      if (score > 0) {
        results.push({
          tool,
          score,
          matchedFields
        });
      }
    }

    results.sort((a, b) => {
      // 高分优先，同分则短名优先
      if (b.score !== a.score) return b.score - a.score;
      return a.tool.name.length - b.tool.name.length;
    });

    // 限制结果数量
    const limitedResults = results.slice(0, this.config.maxSearchResults);
    const searchTime = performance.now() - startTime;

    return limitedResults;
  }

  /**
   * 计算工具与搜索查询的匹配分数
   * 精确匹配: 100分
   * 部分匹配: 50分 * 匹配度
   * 标签匹配: 30分 * 匹配度
   */
  private calculateScore(tool: MCPTool, queryTerms: string[]): { score: number; matchedFields: string[] } {
    let totalScore = 0;
    const matchedFields: string[] = [];

    for (const queryTerm of queryTerms) {
      let bestMatchScore = 0;
      let bestMatchField = '';

      // 1. 工具名称 (权重: 100%)
      const nameMatch = this.calculateFuzzyMatch(tool.name, queryTerm);
      if (nameMatch > bestMatchScore) {
        bestMatchScore = nameMatch;
        bestMatchField = 'name';
      }

      // 2. 类别 (权重: 80%)
      const categoryMatch = this.calculateExactMatch(tool.category, queryTerm);
      if (categoryMatch > bestMatchScore) {
        bestMatchScore = categoryMatch;
        bestMatchField = 'category';
      }

      // 3. 描述 (权重: 60%)
      const descMatch = this.calculateFuzzyMatch(tool.description, queryTerm);
      if (descMatch > bestMatchScore) {
        bestMatchScore = descMatch;
        bestMatchField = 'description';
      }

      // 4. 标签 (权重: 40%)
      const tagMatch = Math.max(
        ...tool.tags.map(tag => this.calculateFuzzyMatch(tag, queryTerm))
      );
      if (tagMatch > bestMatchScore) {
        bestMatchScore = tagMatch;
        bestMatchField = 'tags';
      }

      if (bestMatchScore > this.config.fuzzyThreshold) {
        totalScore += bestMatchScore;
        if (!matchedFields.includes(bestMatchField)) {
          matchedFields.push(bestMatchField);
        }
      }
    }

    return { score: totalScore, matchedFields };
  }

  /**
   * 精确匹配 (完全包含)
   */
  private calculateExactMatch(text: string, query: string): number {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();

    if (textLower.includes(queryLower)) {
      // 完全匹配返回高分
      return 1.0;
    }

    return 0;
  }

  /**
   * 模糊匹配 (部分匹配)
   * 使用最长公共子序列算法
   */
  private calculateFuzzyMatch(text: string, query: string): number {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();

    // 完全匹配
    if (textLower.includes(queryLower)) {
      return 1.0;
    }

    // 计算最长公共子序列长度
    const lcsLength = this.calculateLCS(textLower, queryLower);
    const maxLength = Math.max(textLower.length, queryLower.length);

    // 如果公共子序列较长，说明相似度高
    const similarity = lcsLength / maxLength;

    return similarity;
  }

  /**
   * 最长公共子序列算法
   * 时间复杂度: O(m*n)
   */
  private calculateLCS(text1: string, text2: string): number {
    const m = text1.length;
    const n = text2.length;
    const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (text1[i - 1] === text2[j - 1]) {
          dp[i]![j] = (dp[i - 1]![j - 1]!) + 1;
        } else {
          dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
        }
      }
    }

    return dp[m]![n]!;
  }

  /**
   * 添加工具到搜索索引
   * 零构建时间: 直接内存引用
   */
  addTools(tools: MCPTool[]): void {
    this.tools.push(...tools);
  }

  /**
   * 清除所有工具
   */
  clear(): void {
    this.tools = [];
  }

  /**
   * 获取工具数量
   */
  getToolCount(): number {
    return this.tools.length;
  }

  /**
   * 按类别分组工具
   */
  getToolsByCategory(): Record<string, MCPTool[]> {
    const grouped: Record<string, MCPTool[]> = {};
    for (const tool of this.tools) {
      if (!grouped[tool.category]) {
        grouped[tool.category] = [];
      }
      grouped[tool.category]!.push(tool);
    }
    return grouped;
  }

  /**
   * 获取内存使用估算
   * 每个工具约占用 ~200 字节 (name + description + tags)
   */
  getEstimatedMemoryUsage(): number {
    const bytesPerTool = 200;
    const totalBytes = this.tools.length * bytesPerTool;
    return totalBytes / (1024 * 1024); // MB
  }
}