import type { ServerStatus, ServerTransport } from '@shared-types/common.types';
import type { ServerConfig as SharedServerConfig } from '@shared-models/server.model';

// 后端服务器配置接口，扩展共享配置
export interface ServerConfig extends Omit<SharedServerConfig, 'type'> {
  id: string;
  name: string;
  command: string;
  args: string[];
  type: ServerTransport;
  enabled: boolean;
}

// 服务器状态接口
export interface ServerState {
  status: ServerStatus;
  lastCheck: number;
  error?: string;
  pid?: number;
}

// 后端服务器模型接口，扩展共享服务器模型
export interface Server extends ServerConfig, ServerState {}

