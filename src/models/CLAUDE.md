[根目录](../../CLAUDE.md) > [src](../) > **models**

# Models 模块

## 模块职责

Models 模块定义应用的数据模型和类型系统，是整个应用的类型基础。

## 目录结构

```
models/
├── types.ts              # 全局类型定义
├── server.model.ts       # 服务器模型
├── event.model.ts        # 事件模型
└── system-tools.constants.ts # 系统工具常量
```

## 核心类型定义

### 全局类型 (`types.ts`)

**CMD 错误码定义**:

```typescript
namespace CMDErrors {
  // 系统级错误 (1000-1999)
  export const SystemErrors = {
    DATABASE_CONNECTION_FAILED: 1001,
    MEMORY_INSUFFICIENT: 1002,
    NETWORK_UNREACHABLE: 1003,
    DISK_FULL: 1004,
    SERVICE_UNAVAILABLE: 1005,
    INTERNAL_SERVER_ERROR: 1500
  } as const;

  // 安全错误 (2000-2999)
  export const SecurityErrors = {
    UNAUTHORIZED: 2001,
    FORBIDDEN: 2003,
    TOKEN_EXPIRED: 2004,
    INVALID_CREDENTIALS: 2005,
    ACCESS_DENIED: 2006,
    RATE_LIMIT_EXCEEDED: 2007
  } as const;

  // 业务逻辑错误 (3000-3999)
  export const BusinessErrors = {
    VALIDATION_FAILED: 3001,
    RESOURCE_NOT_FOUND: 3004,
    RESOURCE_ALREADY_EXISTS: 3009,
    INVALID_OPERATION: 3009,
    GROUP_CONSTRAINT_VIOLATION: 3010,
    SERVER_STATUS_CONFLICT: 3011,
    CONFIGURATION_INVALID: 3012
  } as const;

  // API错误 (4000-4999)
  export const APIErrors = {
    INVALID_REQUEST_FORMAT: 4000,
    MISSING_REQUIRED_PARAMETER: 4001,
    INVALID_PARAMETER_VALUE: 4002,
    UNSUPPORTED_MEDIA_TYPE: 4003,
    BAD_REQUEST: 4000
  } as const;

  // MCP协议错误
  export const MCPProtocolErrors = {
    MCP_SERVER_UNREACHABLE: -32001,
    MCP_REQUEST_TIMEOUT: -32002,
    MCP_INVALID_RESPONSE: -32003,
    MCP_TOOL_NOT_FOUND: -32801,
    MCP_EXECUTION_FAILED: -32802,
    MCP_INITIALIZATION_FAILED: -32803
    // ... 更多错误码
  } as const;
}
```

**CMD 响应类型**:

```typescript
// 成功响应
export type CMDSuccess<T = unknown> = {
  code: 200 | 201 | 204;
  message: string;
  data: T;
  timestamp: string;
  requestId?: string;
};

// 错误响应
export type CMDError<T = null> = {
  code: AllErrorCodes;
  message: string;
  data: null;
  timestamp: string;
  requestId?: string;
  error?: {
    category: 'SYSTEM' | 'SECURITY' | 'BUSINESS' | 'API' | 'MCP_PROTOCOL';
    severity: 'FATAL' | 'ERROR' | 'WARN' | 'INFO';
    stack?: string;
    context?: Record<string, unknown>;
    httpStatus?: number;
  };
};
```

### 服务器模型 (`server.model.ts`)

**McpServer 接口**:

```typescript
export interface McpServer {
  id: string;
  name: string;
  description?: string;
  endpoint: string;
  transport: 'http-stream' | 'stdio' | 'sse';
  status: 'online' | 'offline' | 'error' | 'starting' | 'stopping';
  tags: Record<string, string>;
  tools: McpTool[];
  config: object;
  managedProcess: ManagedProcessConfig | null;
  pid: number | null;
  cpuUsage: number;
  memoryUsage: number;
  uptime: number;
  lastHeartbeat: Date;
  healthCheckUrl: string | null;
  capabilities: string[];
}
```

### 会话模型

**会话状态 Schema** (已移动到 `shared/models/session.model.ts`):

```typescript
export const SessionStateSchema = z.object({
  sessionId: z.string(),
  clientName: z.string().optional(),
  clientVersion: z.string().optional(),
  cwd: z.string().optional(),
  project: z.string().optional(),
  createdAt: z.number(),
  lastAccessedAt: z.number(),
  metadata: z.record(z.string(), z.any()).default({})
});

export type SessionState = z.infer<typeof SessionStateSchema>;
```

**会话存储 Schema**:

```typescript
export const SessionStoreSchema = z.object({
  version: z.string().default('1.0.0'),
  sessions: z.record(z.string(), SessionStateSchema).default({})
});

export type SessionStore = z.infer<typeof SessionStoreSchema>;
```

**辅助函数**:

- `createEmptySessionStore()` - 创建空的会话存储
- `validateSessionStore(data)` - 验证并规范化会话存储数据

### 事件模型 (`event.model.ts`)

**事件类型定义**:

```typescript
export enum EventTypes {
  SERVER_ADDED = 'server:added',
  SERVER_UPDATED = 'server:updated',
  SERVER_DELETED = 'server:deleted',
  SERVER_INSTANCE_ADDED = 'server:instance:added',
  SERVER_INSTANCE_UPDATED = 'server:instance:updated',
  SERVER_INSTANCE_DELETED = 'server:instance:deleted',
  SERVER_CONNECTED = 'server:connected',
  SERVER_DISCONNECTED = 'server:disconnected',
  SERVER_STATUS_CHANGE = 'server:status:change',
  TOOLS_UPDATED = 'tools:updated',
  RESOURCES_UPDATED = 'resources:updated',
  TOOL_CALL_STARTED = 'tool:call:started',
  TOOL_CALL_COMPLETED = 'tool:call:completed',
  TOOL_CALL_ERROR = 'tool:call:error',
  CONFIGURATION_UPDATED = 'configuration:updated'
}
```

### 系统工具常量 (`system-tools.constants.ts`)

定义系统内置工具的常量配置。

## 依赖关系

```
models/
├── types.ts                   # 基础类型，无依赖
├── server.model.ts            # 依赖 types.ts
├── event.model.ts             # 依赖 types.ts
└── system-tools.constants.ts  # 依赖 types.ts
```

## 验证规则

### 通用验证

- 所有 ID 字段：必须是有效的字符串格式
- 所有时间字段：必须是有效的 Date 对象或 ISO 8601 字符串
- 所有数值字段：必须是有效的数字且非负数（除非特别说明）

### 特定验证

- `McpServer.name`：1-100 字符
- `McpServer.endpoint`：有效的 URL 格式
- 会话状态使用 Zod Schema 进行严格验证
- 会话存储在加载和保存时都会进行验证

## 会话状态数据结构

### SessionState 字段说明

| 字段             | 类型                    | 可选 | 说明                   |
| ---------------- | ----------------------- | ---- | ---------------------- |
| `sessionId`      | string                  | 否   | 会话唯一标识符         |
| `clientName`     | string                  | 是   | 客户端名称             |
| `clientVersion`  | string                  | 是   | 客户端版本             |
| `cwd`            | string                  | 是   | 客户端当前工作目录     |
| `project`        | string                  | 是   | 项目名称               |
| `createdAt`      | number                  | 否   | 创建时间戳（毫秒）     |
| `lastAccessedAt` | number                  | 否   | 最后访问时间戳（毫秒） |
| `metadata`       | Record<string, unknown> | 否   | 自定义元数据           |

### SessionStore 存储结构

```typescript
{
  version: "1.0.0",
  sessions: {
    "session-id-1": {
      sessionId: "session-id-1",
      clientName: "Claude",
      clientVersion: "1.0",
      cwd: "/path/to/project",
      project: "mcp-hub-lite",
      createdAt: 1708000000000,
      lastAccessedAt: 1708003600000,
      metadata: {}
    }
  }
}
```

## 测试与质量

### 单元测试

**状态**: 部分实现

**测试覆盖**:

- 会话模型 Zod Schema 验证
- 会话存储验证

**建议测试**:

- 类型验证测试
- Schema 验证测试
- 边界条件测试
- 会话状态迁移测试

**测试文件**:

- `tests/unit/services/session-manager.test.ts` - 包含会话模型相关测试

## 常见问题 (FAQ)

### Q: 为什么使用分层错误码？

A: 分层错误码（系统-安全-业务-API-MCP）便于快速定位问题类型和来源，提高调试效率。

### Q: 工具状态转换规则是什么？

A:

```
available -> unavailable
available -> error
unavailable -> available
unavailable -> error
error -> available
```

### Q: 会话状态如何持久化？

A: 会话状态通过以下流程持久化：

1. 会话状态在内存中维护
2. 状态变更时标记为"脏"
3. 5 秒后批量刷新所有脏会话到磁盘
4. 每个会话保存为独立的 JSON 文件
5. 同时维护一个索引文件记录所有会话 ID

### Q: 如何处理无效的会话状态？

A: 加载会话时会使用 Zod Schema 进行验证，无效的会话会被跳过并记录警告日志，不会导致整体加载失败。

## 相关文件清单

| 文件路径                           | 描述         |
| ---------------------------------- | ------------ |
| `models/types.ts`                  | 全局类型定义 |
| `models/server.model.ts`           | 服务器模型   |
| `models/event.model.ts`            | 事件模型     |
| `shared/models/session.model.ts`   | 会话模型     |
| `models/system-tools.constants.ts` | 系统工具常量 |
