/**
 * 配置验证器
 * 使用Zod实现强类型配置验证
 */

import { z } from "zod";
import type {
  SystemConfig,
  MCPServerConfig,
  ValidationResult
} from "./types.js";

// MCP服务器配置Schema
export const mcpServerSchema = z.object({
  id: z.string().min(1, "服务器ID不能为空").regex(/^[a-zA-Z0-9_-]+$/, "服务器ID只能包含字母、数字、下划线和短横线"),
  name: z.string().min(1, "服务器名称不能为空"),
  command: z.string().min(1, "启动命令不能为空"),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  port: z.number().int().min(1024).max(65535, "端口范围必须在1024-65535之间").optional(),
  tags: z.record(z.string(), z.string()).optional()
});

// 日志配置Schema
export const loggingSchema = z.object({
  level: z.enum(["error", "warn", "info", "debug"]).default("info"),
  output: z.enum(["console", "file", "both"]).default("console"),
  file: z.object({
    path: z.string(),
    maxSize: z.number().positive()
  }).optional()
});

// 备份配置Schema
export const backupSchema = z.object({
  enabled: z.boolean().default(false),
  interval: z.number().int().min(1, "备份间隔至少1小时").default(24),
  maxBackups: z.number().int().min(1, "最大备份数至少1个").default(10),
  path: z.string()
});

// 全局配置Schema
export const globalSchema = z.object({
  port: z.number().int().min(1).max(65535, "端口范围必须在1-65535之间").default(3000),
  host: z.string().min(1).default("localhost"),
  cors: z.object({
    enabled: z.boolean().default(true),
    allowedOrigins: z.array(z.string()).default(["*"])
  }),
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    requestsPerMinute: z.number().int().min(1).default(100)
  })
});

// 完整配置Schema
export const configSchema = z.object({
  servers: z.array(mcpServerSchema).default([]),
  global: globalSchema,
  logging: loggingSchema,
  backup: backupSchema
});

// 验证配置文件
export function validateConfig(config: unknown): ValidationResult {
  try {
    const result = configSchema.safeParse(config);

    if (result.success) {
      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    } else {
      const errors = result.error.issues.map(err => ({
        path: err.path.join("."),
        message: `${err.message}`
      }));

      // 添加业务逻辑验证警告
      // const warnings = validateBusinessLogic(result.data);

      return {
        isValid: false,
        errors,
        warnings: []
      };
    }
  } catch (error) {
    return {
      isValid: false,
      errors: [
        {
          path: "config",
          message: `配置验证异常: ${(error as Error).message}`
        }
      ],
      warnings: []
    };
  }
}

// 业务逻辑验证
function validateBusinessLogic(config: SystemConfig): ValidationResult["warnings"] {
  const warnings: Array<{ path: string; message: string }> = [];

  // 检查端口冲突
  const ports = config.servers.map(s => s.port).filter((p): p is number => p !== undefined);
  const portSet = new Set(ports);
  if (ports.length !== portSet.size) {
    warnings.push({
      path: "servers",
      message: "检测到端口冲突，部分MCP服务器端口重复"
    });
  }

  // 检查服务器ID唯一性
  const ids = config.servers.map(s => s.id);
  const idSet = new Set(ids);
  if (ids.length !== idSet.size) {
    warnings.push({
      path: "servers",
      message: "检测到服务器ID重复，每个服务器ID必须唯一"
    });
  }

  // 检查全局端口和服务端口冲突
  if (ports.includes(config.global.port)) {
    warnings.push({
      path: "global.port",
      message: `全局端口${config.global.port}与MCP服务器端口冲突`
    });
  }

  // 检查备份路径是否可写（这里仅检查格式）
  if (config.backup.enabled && !config.backup.path.startsWith(".")) {
    warnings.push({
      path: "backup.path",
      message: "建议使用相对路径进行备份存储"
    });
  }

  // 检查日志文件目录是否可写
  if (config.logging.output === "file" && !config.logging.file?.path.startsWith(".")) {
    warnings.push({
      path: "logging.file.path",
      message: "建议使用相对路径进行日志存储"
    });
  }

  // 检查标签键值对的规范性
  for (const server of config.servers) {
    if (server.tags) {
      for (const [key, value] of Object.entries(server.tags)) {
        if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
          warnings.push({
            path: `servers.${server.id}.tags.${key}`,
            message: `标签键名不规范，建议使用字母、数字、下划线和短横线`
          });
        }
        if (!value) {
          warnings.push({
            path: `servers.${server.id}.tags.${key}`,
            message: `标签键${key}值为空，建议删除此键`
          });
        }
      }
    }
  }

  return warnings;
}

// 验证单个MCP服务器配置
export function validateServerConfig(config: MCPServerConfig): ValidationResult {
  try {
    const result = mcpServerSchema.safeParse(config);

    if (result.success) {
      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    } else {
      const errors = result.error.issues.map(err => ({
        path: err.path.join("."),
        message: err.message
      }));

      return {
        isValid: false,
        errors,
        warnings: []
      };
    }
  } catch (error) {
    return {
      isValid: false,
      errors: [
        {
          path: "server",
          message: `服务器配置验证异常: ${(error as Error).message}`
        }
      ],
      warnings: []
    };
  }
}