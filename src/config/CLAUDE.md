[根目录](../../CLAUDE.md) > [src](../) > **config**

# Config 模块

## 模块职责

Config 模块负责配置文件的加载、验证、更新和环境变量管理，是应用的配置中心。

## 目录结构

```
config/
├── config-manager.ts      # 配置管理器
└── config.schema.ts       # 配置 Schema 定义
```

## 核心类

### ConfigManager (`config-manager.ts`)

**职责**: 配置文件的 CRUD 和环境变量管理

**配置查找优先级**:
1. 环境变量 `MCP_HUB_CONFIG_PATH`
2. 当前目录的 `.mcp-hub.json`
3. `config/.mcp-hub.json`
4. `~/.mcp-hub.json`

**主要方法**:
- `getConfig()` - 获取当前配置
- `getServers()` - 获取服务器列表
- `getServerById(id)` - 根据 ID 获取服务器
- `addServer(server)` - 添加新服务器
- `updateServer(id, updates)` - 更新服务器配置
- `removeServer(id)` - 删除服务器
- `updateConfig(newConfig)` - 更新系统配置

**环境变量支持**:
- `PORT` - 覆盖配置的端口
- `HOST` - 覆盖配置的主机
- `LOG_LEVEL` - 覆盖日志级别
- `LOG_ROTATION_ENABLED` - 是否启用日志轮转
- `LOG_MAX_AGE` - 日志最大保留时间
- `LOG_MAX_SIZE` - 日志最大文件大小

### SystemConfigSchema (`config.schema.ts`)

**职责**: 使用 Zod 定义配置 Schema，进行配置验证

**Schema 定义**:
```typescript
export const SystemConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  port: z.number().default(7788),
  host: z.string().default('localhost'),
  servers: z.array(McpServerConfigSchema).default([]),
  logging: LoggingConfigSchema.default({}),
  security: SecurityConfigSchema.default({}),
  settings: SettingsConfigSchema.default({}),
  groups: z.array(GroupConfigSchema).default([])
});
```

## 配置结构

### 完整配置示例
```json
{
  "version": "1.0.0",
  "port": 7788,
  "host": "localhost",
  "servers": [
    {
      "id": "server-1",
      "name": "Example MCP Server",
      "type": "stdio",
      "command": "npx my-mcp-server",
      "enabled": true
    }
  ],
  "logging": {
    "level": "info",
    "rotation": {
      "enabled": true,
      "maxAge": "7d",
    }
  },
  "security": {
    "allowedIPs": ["127.0.0.1", "::1"],
    "maxConcurrentConnections": 100,
    "connectionTimeout": 30000,
    "idleConnectionTimeout": 60000
  },
  "settings": {
    "language": {
      "current": "zh-CN",
      "autoDetect": true,
      "fallback": "zh-CN"
    }
  },
  "groups": [
    {
      "id": "group-1",
      "name": "Database Servers",
      "description": "数据库相关的 MCP 服务器",
      "servers": ["server-1"]
    }
  ]
}
```

## 依赖关系

```
config/
├── config-manager.ts
│   └── depends on: config.schema.ts (Zod Schema)
│
└── config.schema.ts
    └── depends on: zod
```

## 数据模型

### 服务器配置
```typescript
export interface McpServerConfig {
  id?: string;
  name: string;
  type: 'stdio' | 'sse' | 'streamable-http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  timeout?: number;
  enabled?: boolean;
}
```

### 系统配置
```typescript
export interface SystemConfig {
  version: string;
  port: number;
  host: string;
  servers: McpServerConfig[];
  logging: LoggingConfig;
  security: SecurityConfig;
  settings: SettingsConfig;
  groups: GroupConfig[];
}
```

## 测试与质量

### 单元测试

**文件**: `tests/unit/utils/config.test.ts`

**测试覆盖**:
- 配置加载和解析
- Schema 验证
- 环境变量覆盖
- 配置更新操作

## 常见问题 (FAQ)

### Q: 如何修改配置文件位置？

A: 设置环境变量 `MCP_HUB_CONFIG_PATH` 指向自定义配置文件路径。

### Q: 配置修改后如何生效？

A: 配置修改会自动写入文件，但某些设置（如端口）需要重启服务才能生效。

## 相关文件清单

| 文件路径 | 描述 |
|---------|------|
| `config/config-manager.ts` | 配置管理器 |
| `config/config.schema.ts` | 配置 Schema 定义 |

## 变更记录 (Changelog)

### 2026-01-19
- 初始化 Config 模块文档
