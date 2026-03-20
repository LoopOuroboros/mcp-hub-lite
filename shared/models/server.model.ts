import type { ServerStatus, ServerTransport, ServerType, LogLevel } from '../types/common.types';
import type { Tool } from './tool.model';
import type { Resource } from './resource.model';

// Server configuration interface
export interface ServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
  enabled?: boolean;
  allowedTools?: string[];
  type: ServerTransport;
  tags?: Record<string, string>;
  description?: string;
}

// Server instance configuration interface
export interface ServerInstanceConfig {
  id: string;
  timestamp: number;
  hash: string;
  index?: number;
  displayName?: string;
}

// Log entry interface
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
}

// Server status information interface
export interface StatusInfo {
  id: string;
  status: {
    connected: boolean;
    error?: string;
    lastCheck: number;
    toolsCount: number;
    resourcesCount: number;
    pid?: number;
    startTime?: number;
    version?: string;
    hash?: string;
  };
}

// Unified server model interface
export interface Server {
  id: string;
  name: string;
  status: ServerStatus;
  type: ServerType;
  config: ServerConfig;
  instance: ServerInstanceConfig;
  logs: LogEntry[];
  uptime?: string;
  startTime?: number;
  pid?: number;
  tools?: Tool[];
  resources?: Resource[];
  toolsCount?: number;
  resourcesCount?: number;
  version?: string;
}
