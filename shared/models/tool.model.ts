// JSON Schema type definition
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  default?: unknown;
  [key: string]: unknown;
}

// 工具注解接口
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

// 统一的工具模型接口
export interface Tool {
  name: string;
  description?: string;
  inputSchema?: JsonSchema;
  serverName: string;
  annotations?: ToolAnnotations;
}
