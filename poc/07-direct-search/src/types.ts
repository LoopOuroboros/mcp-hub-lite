/**
 * DirectSearch POC: 类型定义
 */

// 工具接口定义
export interface MCPTool {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  serverId: string;
}

// 搜索结果接口
export interface SearchResult {
  tool: MCPTool;
  score: number;
  matchedFields: string[];
}

// 搜索性能指标
export interface PerformanceMetrics {
  searchTimeMs: number;
  memoryUsedMB: number;
  resultsCount: number;
  query: string;
  timestamp: string;
}

// DirectSearch引擎配置
export interface DirectSearchConfig {
  maxSearchResults: number;
  fuzzyThreshold: number;
  enableFuzzySearch: boolean;
  cacheResults: boolean;
}