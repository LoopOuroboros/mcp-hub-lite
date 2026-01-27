import { z } from 'zod';

/**
 * MCP Server Configuration Schema
 * Simplified schema for MCP-HUB-LITE Lite version
 */

// 服务器配置 Schema（以服务器名称为 key）
export const McpServerConfigSchema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
  tags: z.record(z.string(), z.string()).optional(),
  type: z.enum(['stdio', 'sse', 'streamable-http', 'http']).default('stdio'),
  timeout: z.number().default(60000),
  url: z.string().optional(),
  allowedTools: z.array(z.string()).default([])
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

// 服务器实例 Schema（每个实例包含 id、timestamp、hash）
export const ServerInstanceConfigSchema = z.object({
  id: z.string(),
  timestamp: z.number(), // 启动时间
  hash: z.string(),
  pid: z.number().optional(), // 进程ID
  startTime: z.number().optional() // 启动时间（与 timestamp 相同，保持兼容性）
});

export type ServerInstanceConfig = z.infer<typeof ServerInstanceConfigSchema>;

/**
 * Logging Configuration Schema
 */
export const LoggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  rotation: z.object({
    enabled: z.boolean().default(true),
    maxAge: z.string().default('7d'), // e.g., "7d", "30d"
    maxSize: z.string().default('100MB'), // e.g., "100MB", "1GB"
    compress: z.boolean().default(false)
  }).default({
    enabled: true,
    maxAge: '7d',
    maxSize: '100MB',
    compress: false
  })
}).default({
  level: 'info',
  rotation: {
    enabled: true,
    maxAge: '7d',
    maxSize: '100MB',
    compress: false
  }
});

/**
 * Security Configuration Schema
 */
export const SecurityConfigSchema = z.object({
  allowedNetworks: z.array(z.string()).default([
    "127.0.0.1",
    "192.168.0.0/16",
    "10.0.0.0/8",
    "172.16.0.0/12"
  ]),
  maxConcurrentConnections: z.number().min(1).max(1000).default(50),
  connectionTimeout: z.number().min(1000).default(30000),
  idleConnectionTimeout: z.number().min(30000).default(300000),
  maxConnections: z.number().min(1).max(1000).default(50)
}).default({
  allowedNetworks: [
    "127.0.0.1",
    "192.168.0.0/16",
    "10.0.0.0/8",
    "172.16.0.0/12"
  ],
  maxConcurrentConnections: 50,
  connectionTimeout: 30000,
  idleConnectionTimeout: 300000,
  maxConnections: 50
});

/**
 * System Configuration Schema
 */
export const SystemConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  system: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(7788),
    language: z.enum(['zh', 'en']).default('zh'),
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    logging: LoggingConfigSchema
  }).default({
    host: 'localhost',
    port: 7788,
    language: 'zh',
    theme: 'system',
    logging: {
      level: 'info',
      rotation: {
        enabled: true,
        maxAge: '7d',
        maxSize: '100MB',
        compress: false
      }
    }
  }),
  security: SecurityConfigSchema,
  servers: z.record(z.string(), McpServerConfigSchema).default({})
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;