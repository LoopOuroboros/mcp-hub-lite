import { z } from 'zod';

/**
 * MCP Server Configuration Schema
 * Simplified schema for MCP-HUB-LITE Lite version
 */

export const McpServerConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
  tags: z.record(z.string(), z.string()).optional(),
  type: z.enum(['stdio', 'sse', 'streamable-http']).default('stdio'),
  longRunning: z.boolean().default(true),
  timeout: z.number().default(60000),
  url: z.string().optional()
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

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
  host: z.string().default('localhost'),
  port: z.number().default(7788),
  logging: LoggingConfigSchema,
  security: SecurityConfigSchema,
  servers: z.array(McpServerConfigSchema).default([])
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;