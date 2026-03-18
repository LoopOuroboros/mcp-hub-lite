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

// Tool summary (for listings and searches - without inputSchema)
export interface ToolSummary {
  name: string;
  description?: string;
  serverName: string;
}

// Unified tool model interface (complete version with inputSchema)
export interface Tool extends ToolSummary {
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
}
