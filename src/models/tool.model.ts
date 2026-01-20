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
  id?: string;
  name: string;
  description?: string;
  inputSchema?: McpToolSchema;
  serverId: string;
  tags?: string[];
  status?: 'online' | 'offline' | 'error';
}
