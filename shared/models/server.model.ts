import { z } from 'zod';
import type { ServerStatus, ServerTransport, ServerType, LogLevel } from '../types/common.types';
import type { Tool } from './tool.model';
import type { Resource } from './resource.model';

// ====== Server Runtime Configuration (flat format, merged template + instance) ======

/**
 * Server runtime configuration (flat format, merged template + instance)
 * Used by connection manager and frontend for actual server execution
 */
export interface ServerRuntimeConfig {
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
  enabled?: boolean;
  aggregatedTools?: string[];
  type: ServerTransport;
  tags?: Record<string, string>;
  description?: string;
  proxy?: {
    url: string;
  };
}

// ====== v1.1 Configuration Schema (Server Template + Instance Model) ======

/**
 * Instance selection strategy constants for multi-instance servers
 */
export const InstanceSelectionStrategy = {
  RANDOM: 'random',
  ROUND_ROBIN: 'round-robin',
  TAG_MATCH_UNIQUE: 'tag-match-unique'
} as const;

export type InstanceSelectionStrategy =
  (typeof InstanceSelectionStrategy)[keyof typeof InstanceSelectionStrategy];

/**
 * Transport type constants for MCP server connections
 */
export const TransportType = {
  STDIO: 'stdio',
  SSE: 'sse',
  STREAMABLE_HTTP: 'streamable-http',
  HTTP: 'http'
} as const;

export type TransportType = (typeof TransportType)[keyof typeof TransportType];

// ====== Common Base Schemas (Extracted to Eliminate Duplication) ======

/**
 * Server Environment Configuration Base Schema
 * Shared by both ServerTemplate and ServerInstance (for overrides)
 */
export const ServerEnvConfigSchema = z.object({
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  headers: z.record(z.string(), z.string()).default({}),
  proxy: z
    .object({
      url: z.string()
    })
    .optional()
});

export type ServerEnvConfig = z.infer<typeof ServerEnvConfigSchema>;

/**
 * Server Instance Metadata Schema
 * Shared by ServerInstance and ServerInstanceConfig
 */
export const ServerInstanceMetadataSchema = z.object({
  id: z.string(),
  index: z.number().optional(),
  displayName: z.string().optional()
});

export type ServerInstanceMetadata = z.infer<typeof ServerInstanceMetadataSchema>;

/**
 * Server Instance Runtime State Schema
 * Shared by ServerInstance and ServerInstanceConfig
 */
export const ServerInstanceRuntimeSchema = z.object({
  timestamp: z.number().optional(),
  pid: z.number().optional(),
  startTime: z.number().optional()
});

export type ServerInstanceRuntime = z.infer<typeof ServerInstanceRuntimeSchema>;

// ====== Tag Definition Schema ======

/**
 * Tag Definition Schema
 * Defines metadata about a tag key for validation and UI purposes
 */
export const TagDefinitionSchema = z.object({
  key: z.string(),
  description: z.string().optional(),
  type: z.enum(['string', 'number', 'boolean', 'enum']).default('string'),
  values: z.array(z.string()).optional() // For enum type
});

export type TagDefinition = z.infer<typeof TagDefinitionSchema>;

// ====== Server Instance Schema ======

/**
 * Server Instance Configuration Schema
 * Represents a single instance of a server with specific configuration
 */
export const ServerInstanceSchema = ServerInstanceMetadataSchema.merge(
  ServerInstanceRuntimeSchema.partial()
).extend({
  enabled: z.boolean().default(true),
  // Environment config (for overriding template values)
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  headers: z.record(z.string(), z.string()).default({}),
  proxy: z
    .object({
      url: z.string()
    })
    .optional(),
  // Instance-specific tags
  tags: z.record(z.string(), z.string()).default({})
});

export type ServerInstance = z.infer<typeof ServerInstanceSchema>;

/**
 * Server Instance Update Schema (without defaults)
 * Used for partial updates to server instances - intentionally omits default values
 * to prevent overwriting existing configuration with empty defaults.
 */
export const ServerInstanceUpdateSchema = z.object({
  id: z.string().optional(),
  index: z.number().optional(),
  displayName: z.string().optional(),
  timestamp: z.number().optional(),
  pid: z.number().optional(),
  startTime: z.number().optional(),
  enabled: z.boolean().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  proxy: z
    .object({
      url: z.string()
    })
    .optional(),
  tags: z.record(z.string(), z.string()).optional()
});

export type ServerInstanceUpdate = z.infer<typeof ServerInstanceUpdateSchema>;

// ====== Server Template Schema ======

/**
 * Server Template Configuration Schema
 * Template configuration that can be shared across multiple instances
 */
export const ServerTemplateSchema = ServerEnvConfigSchema.extend({
  command: z.string().optional(),
  type: z
    .enum([
      TransportType.STDIO,
      TransportType.SSE,
      TransportType.STREAMABLE_HTTP,
      TransportType.HTTP
    ])
    .default(TransportType.STDIO),
  timeout: z.number().default(60000),
  url: z.string().optional(),
  aggregatedTools: z.array(z.string()).default([]),
  description: z.string().optional(),
  // Instance selection strategy for multi-instance servers
  instanceSelectionStrategy: z
    .enum([
      InstanceSelectionStrategy.RANDOM,
      InstanceSelectionStrategy.ROUND_ROBIN,
      InstanceSelectionStrategy.TAG_MATCH_UNIQUE
    ])
    .optional(),
  // Ready patterns for startup detection (stdout/stderr output containing any pattern = server ready)
  // Using .optional() without .default() - code should use readyPatterns ?? [] for default value
  readyPatterns: z.array(z.string()).optional()
});

export type ServerTemplate = z.infer<typeof ServerTemplateSchema>;

// ====== Server Config Schema (v1.1) ======

/**
 * Server Configuration Schema (v1.1 - Primary)
 * A server with a template and multiple instances
 */
export const ServerConfigSchema = z.object({
  template: ServerTemplateSchema,
  instances: z.array(ServerInstanceSchema).default([]),
  tagDefinitions: z.array(TagDefinitionSchema).default([])
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// ====== Logging Configuration Schema ======

/**
 * Logging Configuration Schema
 */
export const LoggingConfigSchema = z
  .object({
    level: z.custom<LogLevel>().default('info'),
    rotationAge: z.string().default('7d'),
    jsonPretty: z.boolean().default(true),
    mcpCommDebug: z.boolean().default(false),
    apiDebug: z.boolean().default(false),
    gatewayDebug: z.boolean().default(false)
  })
  .default({
    level: 'info',
    rotationAge: '7d',
    jsonPretty: true,
    mcpCommDebug: false,
    apiDebug: false,
    gatewayDebug: false
  });

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// ====== Security Configuration Schema ======

/**
 * Security Configuration Schema
 */
export const SecurityConfigSchema = z
  .object({
    allowedNetworks: z
      .array(z.string())
      .default(['127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12']),
    maxConcurrentConnections: z.number().min(1).max(1000).default(50),
    connectionTimeout: z.number().min(1000).default(30000),
    idleConnectionTimeout: z.number().min(30000).default(300000),
    maxConnections: z.number().min(1).max(1000).default(50)
  })
  .default({
    allowedNetworks: ['127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'],
    maxConcurrentConnections: 50,
    connectionTimeout: 30000,
    idleConnectionTimeout: 300000,
    maxConnections: 50
  });

export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

// ====== Startup Configuration Schema ======

/**
 * Startup Configuration Schema
 * Unified configuration for server startup behavior
 */
export const StartupConfigSchema = z
  .object({
    // Sequential startup delay between instances (ms)
    startupDelay: z.number().min(0).max(60000).default(3000),
    // Ready pattern detection timeout (ms)
    readyTimeout: z.number().min(10000).max(300000).default(120000),
    // Maximum connection retry attempts
    maxConnectRetries: z.number().min(0).max(10).default(3),
    // Base delay for exponential backoff retry (ms)
    connectRetryDelay: z.number().min(1000).max(30000).default(5000)
  })
  .default({
    startupDelay: 3000,
    readyTimeout: 120000,
    maxConnectRetries: 3,
    connectRetryDelay: 5000
  });

export type StartupConfig = z.infer<typeof StartupConfigSchema>;

// ====== System Configuration Schema ======

/**
 * System Configuration Schema (v1.1 - Primary)
 */
export const SystemConfigSchema = z.object({
  version: z.literal('1.1.0').default('1.1.0'),
  system: z
    .object({
      host: z.string().default('localhost'),
      port: z.number().default(7788),
      language: z.enum(['zh', 'en']).default('zh'),
      theme: z.enum(['light', 'dark', 'system']).default('system'),
      logging: LoggingConfigSchema,
      // Using .optional() without .default() - code should use startup ?? {defaults} for default value
      startup: StartupConfigSchema.optional()
    })
    .default({
      host: 'localhost',
      port: 7788,
      language: 'zh',
      theme: 'system',
      logging: {
        level: 'info',
        rotationAge: '7d',
        jsonPretty: true,
        mcpCommDebug: false,
        apiDebug: false,
        gatewayDebug: false
      },
      startup: {
        startupDelay: 3000,
        readyTimeout: 120000,
        maxConnectRetries: 3,
        connectRetryDelay: 5000
      }
    }),
  security: SecurityConfigSchema,
  servers: z.record(z.string(), ServerConfigSchema).default({}),
  tagDefinitions: z.array(TagDefinitionSchema).default([])
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;

// ====== Server Instance Config Schema ======

/**
 * Server instance runtime configuration (for connection manager)
 * Contains runtime-specific fields like timestamp, pid, etc.
 */
export const ServerInstanceConfigSchema = ServerInstanceMetadataSchema.merge(
  ServerInstanceRuntimeSchema.required({ timestamp: true })
);

export type ServerInstanceConfig = z.infer<typeof ServerInstanceConfigSchema>;

// ====== Server instance configuration interface (original, for backward compatibility) ======

/**
 * Server instance configuration interface
 */
export interface ServerInstanceConfigLegacy {
  id: string;
  timestamp: number;
  hash: string;
  index?: number;
  displayName?: string;
}

// ====== Log Entry Interface ======

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
}

// ====== Status Info Interface ======

/**
 * Server status information interface
 */
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

// ====== Unified Server Model Interface ======

/**
 * Unified server model interface
 */
export interface Server {
  id: string;
  name: string;
  status: ServerStatus;
  type: ServerType;
  config: ServerRuntimeConfig;
  instance?: ServerInstanceConfig;
  instances?: (ServerInstanceConfig & { status: ServerStatus })[];
  logs: LogEntry[];
  uptime?: string;
  startTime?: number;
  pid?: number;
  tools?: Tool[];
  resources?: Resource[];
  toolsCount?: number;
  resourcesCount?: number;
  version?: string;
  rawV11Config?: ServerConfig;
}
