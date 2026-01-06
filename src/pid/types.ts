/**
 * PID管理相关类型定义
 */

export interface PidInfo {
  pid: number;
  timestamp: number;
  port?: number;
}

export interface PidFileOptions {
  configDir?: string;
  filename?: string;
}
