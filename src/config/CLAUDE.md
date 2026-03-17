[根目录](../../CLAUDE.md) > [src](../) > **config**

# Config 模块

## 模块职责

Config 模块负责配置文件的加载、验证、更新和环境变量管理，是应用的配置中心。采用模块化结构，将配置管理拆分为多个专注的子模块，遵循单一职责原则。

## 目录结构

```
config/
├── config-manager.ts         # 配置管理器（薄包装器）
├── config.schema.ts          # 配置 Schema 定义
├── config-loader.ts          # 配置加载器
├── config-saver.ts           # 配置保存器
├── server-config-manager.ts  # 服务器配置管理器
├── config-change-logger.ts   # 配置变更记录器
└── type-converter.ts         # 类型转换器
```

## 核心模块

### ConfigManager (`config-manager.ts`)

**职责**: 配置管理器的薄包装器，提供统一的配置访问接口

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

**依赖**:

- `config-loader.ts` - 配置加载
- `config-saver.ts` - 配置保存
- `server-config-manager.ts` - 服务器配置管理
- `config-change-logger.ts` - 配置变更记录

### ConfigLoader (`config-loader.ts`)

**职责**: 配置文件加载和解析，包含验证和兼容性处理

**主要功能**:

- 从文件系统加载配置
- JSON 解析和验证
- 类型转换（如 'http' 到 'streamable-http'）
- Zod Schema 验证
- 验证失败时回退到默认配置
- 服务器配置按名称排序

**主要方法**:

- `loadConfig(configPath)` - 从指定路径加载配置

**依赖**:

- `config.schema.ts` - 配置 Schema
- `type-converter.ts` - 类型转换

### ConfigSaver (`config-saver.ts`)

**职责**: 配置文件保存和原子写入

**主要功能**:

- 原子性配置写入（先写临时文件再重命名）
- 目录自动创建
- JSON 格式化输出
- 错误处理和重试

**主要方法**:

- `saveConfig(configPath, config)` - 保存配置到指定路径

### ServerConfigManager (`server-config-manager.ts`)

**职责**: 服务器配置的 CRUD 操作和实例管理

**主要功能**:

- 服务器配置的添加、更新、删除
- 服务器实例管理
- 配置验证和规范化
- 唯一实例 ID 生成
- 批量服务器添加

**主要方法**:

- `addServers(servers, currentServers, serverInstances)` - 批量添加服务器
- `addServer(name, config, currentServers, serverInstances)` - 添加单个服务器
- `updateServer(name, updates, currentServers)` - 更新服务器
- `removeServer(name, currentServers, serverInstances)` - 删除服务器
- `generateInstanceId(serverName)` - 生成唯一实例 ID

**依赖**:

- `config.schema.ts` - 配置 Schema
- `type-converter.ts` - 类型转换

### ConfigChangeLogger (`config-change-logger.ts`)

**职责**: 配置变更的比较和日志记录，用于审计目的

**主要功能**:

- 深度比较两个配置对象
- 记录所有字段级别的变更
- 格式化变更输出
- 审计日志

**主要方法**:

- `logConfigChanges(oldConfig, newConfig)` - 记录配置变更

### TypeConverter (`type-converter.ts`)

**职责**: 配置类型转换，确保向后兼容性

**主要功能**:

- 传输类型转换（'http' → 'streamable-http'）
- 配置规范化
- 向后兼容性处理

**主要方法**:

- `convertHttpToStreamableHttp(config)` - 转换 HTTP 类型为 StreamableHttp

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

| 配置项                     | 类型     | 默认值                                                           | 说明                                          |
| -------------------------- | -------- | ---------------------------------------------------------------- | --------------------------------------------- |
| `allowedNetworks`          | string[] | `['127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12']` | 允许访问的网络列表                            |
| `maxConcurrentConnections` | number   | `50`                                                             | 最大并发连接数 (1-1000)                       |
| `connectionTimeout`        | number   | `30000`                                                          | 连接超时（毫秒，最小 1000）                   |
| `idleConnectionTimeout`    | number   | `300000`                                                         | 空闲连接超时（毫秒，最小 30000）              |
| `sessionTimeout`           | number   | `1800000`                                                        | 会话超时（毫秒，最小 60000，默认 30 分钟）    |
| `sessionFlushInterval`     | number   | `900000`                                                         | 会话刷盘间隔（毫秒，最小 1000，默认 15 分钟） |
| `maxConnections`           | number   | `50`                                                             | 最大连接数 (1-1000)                           |

### 服务器配置 (servers)

服务器配置以服务器名称为 key，每个服务器包含以下配置：

| 配置项         | 类型                                            | 默认值    | 说明                                            |
| -------------- | ----------------------------------------------- | --------- | ----------------------------------------------- |
| `command`      | string                                          | -         | 启动命令（stdio 类型必需）                      |
| `args`         | string[]                                        | `[]`      | 命令参数                                        |
| `env`          | Record&lt;string, string&gt;                          | -         | 环境变量                                        |
| `enabled`      | boolean                                         | `true`    | 是否启用                                        |
| `tags`         | Record&lt;string, string&gt;                          | -         | 配置标签                                        |
| `type`         | 'stdio' \| 'sse' \| 'streamable-http' \| 'http' | `'stdio'` | 传输类型                                        |
| `timeout`      | number                                          | `60000`   | 超时时间（毫秒）                                |
| `url`          | string                                          | -         | 服务器 URL（sse/streamable-http/http 类型必需） |
| `allowedTools` | string[]                                        | `[]`      | 允许的工具列表                                  |

## 依赖关系

```
config/
├── config-manager.ts
│   ├── depends on: config-loader.ts
│   ├── depends on: config-saver.ts
│   ├── depends on: server-config-manager.ts
│   ├── depends on: config-change-logger.ts
│   └── depends on: config.schema.ts (Zod Schema)
│
├── config-loader.ts
│   ├── depends on: config.schema.ts
│   └── depends on: type-converter.ts
│
├── config-saver.ts
│
├── server-config-manager.ts
│   ├── depends on: config.schema.ts
│   └── depends on: type-converter.ts
│
├── config-change-logger.ts
│
├── type-converter.ts
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

| 文件路径                       | 描述                 |
| ------------------------------ | -------------------- |
| `config/config-manager.ts`     | 配置管理器（薄包装） |
| `config/config.schema.ts`      | 配置 Schema 定义     |
| `config/config-loader.ts`      | 配置加载器           |
| `config/config-saver.ts`       | 配置保存器           |
| `config/server-config-manager.ts` | 服务器配置管理器   |
| `config/config-change-logger.ts` | 配置变更记录器     |
| `config/type-converter.ts`     | 类型转换器           |
