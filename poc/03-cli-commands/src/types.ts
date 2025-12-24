/**
 * CLI命令类型定义
 */

export interface MCPServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  status: "running" | "stopped" | "error";
  pid?: number;
  port?: number;
  tags?: Record<string, string>;
}

export interface ProcessStatus {
  pid: number;
  command: string;
  cpu: number;
  memory: number; // MB
  uptime: number; // seconds
}

export interface CLIOptions {
  verbose: boolean;
  config: string;
  debug: boolean;
}

export type CLICommand =
  | "start"
  | "stop"
  | "status"
  | "list"
  | "restart"
  | "ui"
  | "help";

export interface StartOptions {
  name?: string;
  port?: number;
  serverId?: string;
}

export interface StopOptions {
  serverId: string;
  force?: boolean;
}

export interface StatusOptions {
  json?: boolean;
  verbose?: boolean;
}