[根目录](../../../CLAUDE.md) > [frontend](../../) > [src](../) > **stores**

# Stores 模块

## 模块职责

Stores 模块使用 Pinia 实现前端状态管理，是前端的数据中心。

## 目录结构

```
stores/
├── server.ts              # 服务器状态管理
├── system.ts              # 系统状态管理
├── tool-calls.ts          # 工具调用状态管理
└── websocket.ts           # WebSocket 状态管理
```

## 核心 Store

### Server Store (`server.ts`)

**职责**: 管理 MCP 服务器的状态和操作

**State**:

```typescript
{
  servers: Server[]              // 服务器列表
  loading: boolean               // 加载状态
  error: string | null          // 错误信息
  selectedServerId: string | null  // 选中的服务器 ID
}
```

**Computed**:

- `selectedServer` - 当前选中的服务器
- `stats` - 统计信息（总数、运行数、错误数）

**Actions**:

- `fetchServers()` - 获取所有服务器
- `addServer(serverData)` - 添加新服务器
- `updateServer(id, serverData)` - 更新服务器
- `startServer(id)` - 启动服务器（支持服务器ID或实例ID）
- `stopServer(id)` - 停止服务器（支持服务器ID或实例ID）
- `deleteServer(id)` - 删除服务器
- `selectServer(id)` - 选择服务器
- `fetchTools(serverId)` - 获取服务器工具
- `fetchResources(serverId)` - 获取服务器资源
- `fetchLogs(serverId)` - 获取服务器日志
- `clearLogs(serverId)` - 清除日志
- `addServerInstance(serverName)` - 添加服务器实例
- `updateServerInstance(serverName, index, updates)` - 更新服务器实例
- `removeServerInstance(serverName, index)` - 删除服务器实例
- `addInstanceLocal(serverName, instanceData)` - 本地添加实例（供 WebSocket 跨客户端同步）
- `updateInstanceLocal(serverName, index, updates)` - 本地更新实例（供 WebSocket 跨客户端同步）
- `removeInstanceLocal(serverName, index)` - 本地删除实例（供 WebSocket 跨客户端同步）

**v1.1 聚合服务器模型**:

- **架构变更**: 为每个服务器名称创建一个聚合的 Server 对象，包含所有实例
- **instances 数组**: 每个 Server 对象包含 `instances[]` 数组，存储该服务器的所有实例及其状态
- **聚合状态计算**:
  - 任何实例在线 → 整体状态为 "online"
  - 任何实例错误 → 整体状态为 "error"
  - 否则为 "offline"
- **聚合计数**: 跨所有实例聚合工具和资源总数
- **向后兼容**: `instance` 字段保留为可选，用于单实例场景

### System Store (`system.ts`)

**职责**: 管理系统配置和状态

**State**:

```typescript
{
  config: SystemConfig; // 系统配置
  loading: boolean; // 加载状态
  error: string | null; // 错误信息
}
```

**SystemConfig 接口**:

```typescript
{
  system: {
    host: string;
    port: number;
    language: string;
    theme: string;
    logging: {
      level: string;
      rotationAge: string;
      jsonPretty: boolean;
      mcpCommDebug: boolean;
      apiDebug: boolean;
    };
  };
  security: {
    allowedNetworks: string[];
    maxConcurrentConnections: number;
    connectionTimeout: number;
    idleConnectionTimeout: number;
    maxConnections: number;
  };
}
```

**Actions**:

- `fetchConfig()` - 获取系统配置
- `updateConfig(updates)` - 更新系统配置

**工具函数**:

- `deepMerge(target, source)` - 深度合并配置对象

### Tool Calls Store (`tool-calls.ts`)

**职责**: 管理工具调用进度、结果和错误

**State**:

```typescript
{
  calls: Map<string, ToolCall>; // 工具调用映射
}
```

**ToolCall 接口**:

```typescript
{
  requestId: string;
  serverId: string;
  serverName: string;
  toolName: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'error';
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  progress?: number; // 0-100
}
```

**Computed**:

- `runningCalls` - 运行中的工具调用列表

**Actions**:

- `updateCall(call)` - 添加或更新调用
- `getCall(requestId)` - 获取特定调用
- `completeCall(requestId, result, error)` - 完成调用
- `handleToolCallStarted(data)` - 处理工具调用开始事件
- `handleToolCallCompleted(data)` - 处理工具调用完成事件
- `handleToolCallError(data)` - 处理工具调用错误事件

**依赖**:

- `@shared-types/websocket.types` - WebSocket 事件类型

### WebSocket Store (`websocket.ts`)

**职责**: 管理 WebSocket 连接和与后端的事件处理

**State**:

```typescript
{
  connected: boolean; // 连接状态
  wsClient: WebSocketClient | null; // WebSocket 客户端实例
}
```

**Actions**:

- `connect()` - 连接 WebSocket
- `disconnect()` - 断开 WebSocket
- `fetchLogs(serverId, limit, since)` - 获取历史日志
- `handleServerMessage(message)` - 处理服务器消息

**支持的事件类型**:

- `SERVER_STATUS` - 服务器状态变化
- `LOG` - 日志更新
- `TOOLS` - 工具更新
- `RESOURCES` - 资源更新
- `SERVER_ADDED` - 服务器添加
- `SERVER_UPDATED` - 服务器更新
- `SERVER_DELETED` - 服务器删除
- `SERVER_CONNECTED` - 服务器连接
- `SERVER_DISCONNECTED` - 服务器断开
- `TOOL_CALL_STARTED` - 工具调用开始
- `TOOL_CALL_COMPLETED` - 工具调用完成
- `TOOL_CALL_ERROR` - 工具调用错误
- `CONFIGURATION_UPDATED` - 配置更新
- `CLIENT_CONNECTED` - 客户端连接
- `CLIENT_DISCONNECTED` - 客户端断开
- `PONG` - 心跳响应

**生命周期**:

- `onMounted` - 组件挂载时自动连接
- `onBeforeUnmount` - 组件卸载前自动断开

**依赖**:

- `@utils/websocket` - WebSocket 客户端
- `@stores/server` - 服务器 Store
- `@stores/tool-calls` - 工具调用 Store
- `@stores/system` - 系统 Store
- `@shared-types/websocket.types` - WebSocket 类型定义

## 数据模型

### Server Config

```typescript
export interface ServerConfig {
  transport: 'stdio' | 'sse' | 'streamable-http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  timeout?: number;
  enabled?: boolean;
}
```

### Log Entry

```typescript
export interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}
```

### Server

```typescript
export interface Server {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error' | 'starting';
  type: 'local' | 'remote';
  config: ServerRuntimeConfig;
  instance?: ServerInstanceConfig; // 单实例（向后兼容）
  instances?: (ServerInstanceConfig & { status: ServerStatus })[]; // 多实例数组
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
```

## 依赖关系

```
stores/
├── server.ts
│   └── depends on: utils/http.ts
├── system.ts
│   └── depends on: utils/http.ts
├── tool-calls.ts
│   └── depends on: @shared-types/websocket.types
└── websocket.ts
    ├── depends on: utils/websocket.ts
    ├── depends on: @stores/server
    ├── depends on: @stores/tool-calls
    ├── depends on: @stores/system
    └── depends on: @shared-types/websocket.types
```

## 测试与质量

### 单元测试

**状态**: 已实现 Server Store 基础测试

**已实现测试**:

- Store 初始化测试（空服务器数组、加载状态、错误状态）
- 计算属性测试（stats 统计信息、选中服务器）
- Action 功能测试（fetchServers、addServer、updateServerStatus）
- 错误处理测试（网络错误处理）

**建议测试**:

- 完整的 Action 测试覆盖（startServer、stopServer、deleteServer 等）
- System Store 测试
- Tool Calls Store 测试
- WebSocket Store 测试
- WebSocket 相关功能测试
- 复杂场景的集成测试

## 常见问题 (FAQ)

### Q: 如何添加新的 Store？

A: 使用 Pinia 的 `defineStore` 创建新的状态管理文件。

### Q: 如何在组件中使用 Store？

A: 使用 `useServerStore()` 等获取 store 实例。

### Q: Store 之间如何交互？

A: 通过在一个 Store 中导入并使用其他 Store，如 WebSocket Store 中使用 Server Store、Tool Calls Store 等。

### Q: 如何处理 WebSocket 事件？

A: WebSocket Store 自动连接并处理事件，通过调用其他 Store 的方法来更新状态。

## 相关文件清单

| 文件路径               | 描述               |
| ---------------------- | ------------------ |
| `stores/server.ts`     | 服务器状态管理     |
| `stores/system.ts`     | 系统状态管理       |
| `stores/tool-calls.ts` | 工具调用状态管理   |
| `stores/websocket.ts`  | WebSocket 状态管理 |
