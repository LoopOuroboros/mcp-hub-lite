// JSON Schema type definition
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  default?: unknown;
  [key: string]: unknown;
}

// Tool annotations interface
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

// Unified tool model interface
export interface Tool {
  name: string;
  description?: string;
  inputSchema?: JsonSchema;
  serverName: string;
  annotations?: ToolAnnotations;
}
