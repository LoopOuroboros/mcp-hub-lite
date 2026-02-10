import type { ToolAnnotations, JsonSchema } from '@shared-models/tool.model';

// 后端工具参数接口
export interface McpToolParameter {
  type: string;
  description?: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

// 后端工具模式接口，与共享的 JsonSchema 保持一致
export type McpToolSchema = JsonSchema;

// 后端工具模型接口，确保与现有代码兼容
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: McpToolSchema;
  serverName: string;
  annotations?: ToolAnnotations;
}

// 导出共享类型以便后端使用
export type {
  ToolAnnotations,
  JsonSchema
};
