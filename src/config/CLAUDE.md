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
2. `~/.mcp-hub-lite/config/.mcp-hub.json`（用户主目录下的隐藏文件夹）

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
  system: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(7788),
    language: z.enum(['zh', 'en']).default('zh'),
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    logging: LoggingConfigSchema
  }),
  security: SecurityConfigSchema,
  servers: z.record(z.string(), ServerConfigSchema).default({}),
  observability: ObservabilityConfigSchema
});
```

## 配置结构

### 安全配置

```typescript
export const SecurityConfigSchema = z.object({
  allowedNetworks: z
    .array(z.string())
    .default(['127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12']),
  maxConcurrentConnections: z.number().min(1).max(1000).default(50),
  connectionTimeout: z.number().min(1000).default(30000),
  idleConnectionTimeout: z.number().min(30000).default(300000),
  sessionTimeout: z
    .number()
    .min(60000)
    .default(30 * 60 * 1000), // Default 30 minutes, min 1 minute
  maxConnections: z.number().min(1).max(1000).default(50)
});
```

### 完整配置示例

```json
{
  "version": "1.0.0",
  "system": {
    "host": "localhost",
    "port": 7788,
    "language": "zh",
    "theme": "system",
    "logging": {
      "level": "info",
      "rotationAge": "7d"
    }
  },
  "security": {
    "allowedNetworks": ["127.0.0.1", "192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"],
    "maxConcurrentConnections": 50,
    "connectionTimeout": 30000,
    "idleConnectionTimeout": 300000,
    "sessionTimeout": 1800000,
    "sessionFlushInterval": 900000,
    "maxConnections": 50
  },
  "servers": {
    "example-server": {
      "command": "npx my-mcp-server",
      "args": [],
      "env": {},
      "enabled": true,
      "tags": {},
      "type": "stdio",
      "timeout": 60000,
      "allowedTools": []
    }
  },
  "observability": {
    "tracing": {
      "enabled": false,
      "exporter": "console",
      "endpoint": "http://localhost:4318/v1/traces",
      "sampleRate": 1.0
    }
  }
}
```

## 配置选项说明

### 安全配置 (security)

| 配置项                     | 类型     | 默认值                                                           | 说明                                       |
| -------------------------- | -------- | ---------------------------------------------------------------- | ------------------------------------------ |
| `allowedNetworks`          | string[] | `['127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12']` | 允许访问的网络列表                         |
| `maxConcurrentConnections` | number   | `50`                                                             | 最大并发连接数 (1-1000)                    |
| `connectionTimeout`        | number   | `30000`                                                          | 连接超时（毫秒，最小 1000）                |
| `idleConnectionTimeout`    | number   | `300000`                                                         | 空闲连接超时（毫秒，最小 30000）           |
| `sessionTimeout`           | number   | `1800000`                                                        | 会话超时（毫秒，最小 60000，默认 30 分钟） |
| `sessionFlushInterval`     | number   | `900000`                                                         | 会话刷盘间隔（毫秒，最小 1000，默认 15 分钟） |
| `maxConnections`           | number   | `50`                                                             | 最大连接数 (1-1000)                        |

### 服务器配置 (servers)

服务器配置以服务器名称为 key，每个服务器包含以下配置：

| 配置项         | 类型                                            | 默认值    | 说明                                            |
| -------------- | ----------------------------------------------- | --------- | ----------------------------------------------- |
| `command`      | string                                          | -         | 启动命令（stdio 类型必需）                      |
| `args`         | string[]                                        | `[]`      | 命令参数                                        |
| `env`          | Record<string, string>                          | -         | 环境变量                                        |
| `enabled`      | boolean                                         | `true`    | 是否启用                                        |
| `tags`         | Record<string, string>                          | -         | 配置标签                                        |
| `type`         | 'stdio' \| 'sse' \| 'streamable-http' \| 'http' | `'stdio'` | 传输类型                                        |
| `timeout`      | number                                          | `60000`   | 超时时间（毫秒）                                |
| `url`          | string                                          | -         | 服务器 URL（sse/streamable-http/http 类型必需） |
| `allowedTools` | string[]                                        | `[]`      | 允许的工具列表                                  |

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
export interface ServerConfig {
  command?: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  tags?: Record<string, string>;
  type: 'stdio' | 'sse' | 'streamable-http' | 'http';
  timeout: number;
  url?: string;
  allowedTools: string[];
}
```

### 系统配置

```typescript
export interface SystemConfig {
  version: string;
  system: {
    host: string;
    port: number;
    language: 'zh' | 'en';
    theme: 'light' | 'dark' | 'system';
    logging: LoggingConfig;
  };
  security: SecurityConfig;
  servers: Record<string, ServerConfig>;
  observability: ObservabilityConfig;
}
```

### 安全配置

```typescript
export interface SecurityConfig {
  allowedNetworks: string[];
  maxConcurrentConnections: number;
  connectionTimeout: number;
  idleConnectionTimeout: number;
  sessionTimeout: number;
  sessionFlushInterval: number;
  maxConnections: number;
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

### Q: 如何配置会话超时？

A: 在配置文件的 `security.sessionTimeout` 字段设置，单位为毫秒：

```json
{
  "security": {
    "sessionTimeout": 3600000
  }
}
```

最小值为 60000（1 分钟），默认值为 1800000（30 分钟）。

### Q: 会话数据存储在哪里？

A: 会话数据存储在 `~/.mcp-hub-lite/sessions/` 目录下，每个会话一个 JSON 文件，还有一个 `index.json` 索引文件。

## 相关文件清单

| 文件路径                   | 描述             |
| -------------------------- | ---------------- |
| `config/config-manager.ts` | 配置管理器       |
| `config/config.schema.ts`  | 配置 Schema 定义 |

## 变更记录 (Changelog)

### 2026-02-15

- 添加安全配置文档（sessionTimeout 等）
- 添加完整配置示例
- 添加配置选项说明表格
- 添加会话持久化相关配置说明

### 2026-01-19

- 初始化 Config 模块文档
