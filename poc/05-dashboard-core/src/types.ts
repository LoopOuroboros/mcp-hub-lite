/**
 * Dashboard核心功能类型定义
 */

export interface MCPServer {
  id: string;
  name: string;
  status: "online" | "offline" | "error" | "starting" | "stopping";
  cpu?: number;
  memory?: number;
  port?: number;
  uptime?: number;
  tools?: MCPTool[];
  tags?: Record<string, string>;
}

export interface MCPTool {
  id: string;
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  timestamp: string;
}

export interface DashboardData {
  servers: MCPServer[];
  metrics: SystemMetrics;
  searchResults?: MCPTool[];
}

export interface DashboardAction {
  type: "START_SERVER" | "STOP_SERVER" | "RESTART_SERVER" | "SEARCH_TOOLS" | "CALL_TOOL";
  payload: {
    serverId?: string;
    tool?: MCPTool;
    query?: string;
  };
}