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

## 相关文件清单

| 文件路径                           | 描述         |
| ---------------------------------- | ------------ |
| `models/types.ts`                  | 全局类型定义 |
| `models/server.model.ts`           | 服务器模型   |
| `models/event.model.ts`            | 事件模型     |
| `models/system-tools.constants.ts` | 系统工具常量 |
