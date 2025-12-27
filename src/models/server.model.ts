export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export type ServerStatus = 'online' | 'offline' | 'error' | 'starting';

export interface McpServerState {
  status: ServerStatus;
  lastCheck: number;
  error?: string;
  pid?: number;
}

export interface McpServer extends McpServerConfig, McpServerState {}
