/**
 * Client Types
 * 前后端共享的客户端会话类型
 */

/**
 * Workspace root 信息
 */
export interface ClientRoot {
  uri: string;
  name?: string;
}

/**
 * 基础请求上下文 - 用于 AsyncLocalStorage
 * 包含请求必需的最小字段集合
 */
export interface ClientContext {
  sessionId: string;
  clientName?: string;
  clientVersion?: string;
  protocolVersion?: string;
  cwd?: string;
  project?: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
}

/**
 * 完整客户端信息 - 用于追踪和展示
 * 扩展 ClientContext，包含运行时状态
 */
export interface ClientInfo extends ClientContext {
  lastSeen: number;
  roots?: ClientRoot[];
}
