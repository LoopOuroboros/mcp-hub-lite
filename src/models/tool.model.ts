export interface McpToolParameter {
  type: string;
  description?: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface McpToolSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: McpToolSchema;
  serverName: string;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}
