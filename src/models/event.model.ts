/**
 * Event data models
 * Contains all data interface definitions used by the event bus
 */

import type { ServerConfig, ServerInstanceConfig } from '@config/config.schema.js';
import type { Tool } from '@shared-models/tool.model.js';
import type { Resource } from '@shared-models/resource.model.js';
import type { LogLevel } from '@shared-types/common.types.js';

// Server-related event data
export interface ServerAddedEventData {
  name: string;
  config: ServerConfig;
}

export interface ServerUpdatedEventData {
  name: string;
  config: ServerConfig;
}

// ServerDeletedEventData is just a string (server name)
export type ServerDeletedEventData = string;

export interface ServerInstanceAddedEventData {
  name: string;
  instance: ServerInstanceConfig;
}

export interface ServerInstanceUpdatedEventData {
  name: string;
  index: number;
  updates: Partial<ServerInstanceConfig>;
}

export interface ServerInstanceDeletedEventData {
  name: string;
  index: number;
}

// Connection status event data
export interface ServerConnectedEventData {
  serverName: string;
  serverIndex: number;
  status: 'online';
  timestamp: number;
}

export interface ServerDisconnectedEventData {
  serverName: string;
  serverIndex: number;
  status: 'offline';
  timestamp: number;
}

export interface ServerStatusChangeEventData {
  serverName: string;
  serverIndex: number;
  status: 'online' | 'offline' | 'error';
  error?: string;
  timestamp: number;
}

// Tool-related event data
export interface ToolsUpdatedEventData {
  serverName: string;
  serverIndex: number;
  tools: Tool[];
}

export interface ToolCallStartedEventData {
  requestId: string;
  serverName: string;
  serverIndex: number;
  toolName: string;
  timestamp: number;
  args: Record<string, unknown>;
}

export interface ToolCallCompletedEventData {
  requestId: string;
  serverName: string;
  serverIndex: number;
  toolName: string;
  timestamp: number;
  result: unknown;
}

export interface ToolCallErrorEventData {
  requestId: string;
  serverName: string;
  serverIndex: number;
  toolName: string;
  timestamp: number;
  error: string;
  stack?: string;
}

// Resource-related event data
export interface ResourcesUpdatedEventData {
  serverName: string;
  serverIndex: number;
  resources: Resource[];
}

// Log-related event data
export interface LogEntryEventData {
  serverName: string;
  serverIndex: number;
  logs: Array<{
    level: LogLevel;
    message: string;
    timestamp: number;
  }>;
}

// System-related event data
export interface ConfigurationUpdatedEventData {
  timestamp: number;
  config: unknown;
  changes?: unknown;
}

// Union type for event data types
// Use unknown as the base type to maintain backward compatibility
export type EventData = unknown;
