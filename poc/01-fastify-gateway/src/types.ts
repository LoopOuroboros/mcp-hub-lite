/**
 * POC: Fastify MCP Gateway 类型定义
 * 验证 TypeScript 类型安全
 */

// MCP JSON-RPC 2.0 标准类型
export interface MCPRequest {
  jsonrpc: "2.0";
  method: "tools/list" | "tools/call" | "initialize" | "ping";
  params?: Record<string, unknown>;
  id: string | number;
}

// MCP 响应类型
export interface MCPResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number;
}

// MCP 工具定义
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// 服务器注册信息
export interface ServerConfig {
  id: string;
  name: string;
  endpoint: string;
  status: "online" | "offline" | "error";
  tools: MCPTool[];
}