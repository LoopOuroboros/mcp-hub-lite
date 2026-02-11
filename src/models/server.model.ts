import type { ServerStatus, ServerTransport, ServerType } from '../../shared/types/common.types';
import type { McpServerConfig as SharedMcpServerConfig, ServerInstanceConfig, LogEntry, McpStatus, Server as SharedServer } from '@shared-models/server.model';

// 后端服务器配置接口，扩展共享配置
export interface McpServerConfig extends Omit<SharedMcpServerConfig, 'type'> {
  id: string;
  name: string;
  command: string;
  args: string[];
  type: ServerTransport;
  enabled: boolean;
}

// 服务器状态接口
export interface McpServerState {
  status: ServerStatus;
  lastCheck: number;
  error?: string;
  pid?: number;
}

// 后端服务器模型接口，扩展共享服务器模型
export interface McpServer extends McpServerConfig, McpServerState {}

// 导出共享类型以便后端使用
export type {
  ServerStatus,
  ServerTransport,
  ServerType,
  ServerInstanceConfig,
  LogEntry,
  McpStatus,
  SharedServer as Server
};
