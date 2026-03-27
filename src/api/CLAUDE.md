[根目录](../../CLAUDE.md) > [src](../) > **api**

# API 模块

## 模块职责

API 模块负责处理所有 HTTP 请求，包括 MCP JSON-RPC 2.0 协议、其他 Web API 接口和 WebSocket。

## 目录结构

```
api/
├── mcp/                     # MCP 协议处理
│   ├── gateway.ts           # MCP Gateway 网关路由（薄包装器）
│   ├── sse-stream-manager.ts  # SSE 流管理器
│   ├── session-context-extractor.ts  # 会话上下文提取器
│   └── debug-response-wrapper.ts  # 调试响应包装器
├── web/                     # Web API 路由
│   ├── servers.ts            # 服务器管理 API
│   ├── search.ts             # 搜索 API
│   ├── health.ts            # 健康检查 API
│   ├── mcp-status.ts        # MCP 状态 API
│   ├── config.ts            # 配置管理 API
│   ├── logs.ts             # 日志 API
│   ├── hub-tools.ts         # 系统工具 API
│   ├── resources.ts          # 资源 API
│   └── sessions.ts          # 会话管理 API
└── ws/                      # WebSocket 路由
    ├── events.ts           # WebSocket 事件处理
    └── ws-handler.ts        # WebSocket 处理器
```

## MCP 协议接口

### Gateway 路由 (`api/mcp/gateway.ts`)

**路径**: `/mcp/*`

**支持的协议**: HTTP-Stream (通过 EventSource 实现)

**会话管理**: 基于 sessionId 的会话隔离，支持多客户端独立连接

**功能**:

- `initialize` - MCP 初始化握手
- `tools/list` - 列出所有可用工具
- `tools/call` - 调用工具
- `resources/list` - 列出所有资源
- `resources/read` - 读取资源

**会话上下文**:

- `sessionId` - 会话标识符，用于区分不同客户端连接
- `clientName` - 客户端名称
- `ip` - 客户端 IP
- `userAgent` - 用户代理信息

## Web API 接口

### 服务器管理 API (`api/web/servers.ts`)

**服务器模板管理**:

| 路径                      | 方法   | 描述                 |
| ------------------------- | ------ | -------------------- |
| `/web/servers`            | GET    | 获取所有服务器配置   |
| `/web/servers`            | POST   | 添加新服务器         |
| `/web/servers/:name`      | PUT    | 更新服务器模板配置   |
| `/web/servers/:name`      | DELETE | 删除服务器           |
| `/web/servers/name/:name` | GET    | 获取指定名称的服务器 |
| `/web/servers/batch`      | POST   | 批量导入服务器       |

**服务器实例管理（新增 v1.1）**:

| 路径                                           | 方法   | 描述                             |
| ---------------------------------------------- | ------ | -------------------------------- |
| `/web/server-instances`                        | GET    | 获取所有服务器实例               |
| `/web/server-instances/:name`                  | GET    | 获取指定服务器的所有实例         |
| `/web/server-instances/:name`                  | POST   | 为指定服务器添加新实例           |
| `/web/server-instances/:name/:index`           | PUT    | 更新指定服务器的实例（部分更新） |
| `/web/server-instances/:name/:index`           | DELETE | 删除指定服务器的实例             |
| `/web/server-instances/:name/reassign-indexes` | POST   | 重新分配服务器实例索引           |

**ServerInstanceUpdateSchema 使用说明**:

- 用于实例的部分更新（PATCH 语义）
- 所有字段都是可选的
- 不包含默认值，避免覆盖现有配置
- 支持更新 displayName、enabled、env、args 等字段

**索引类型支持**:

- 服务器实例索引在存储和接口定义中使用 `number` 类型
- API 操作（如更新、删除实例）支持传入 `string` 或 `number` 类型的索引参数
- 字符串索引会在运行时自动转换为数字进行处理
- 保持向后兼容性，现有代码无需修改

### 搜索 API (`api/web/search.ts`)

| 路径          | 方法 | 描述     |
| ------------- | ---- | -------- |
| `/web/search` | GET  | 搜索工具 |

**查询参数**:

- `q` - 搜索关键词
- `limit` - 结果限制数量

### 健康检查 API (`api/web/health.ts`)

| 路径      | 方法 | 描述         |
| --------- | ---- | ------------ |
| `/health` | GET  | 系统健康检查 |

### MCP 状态 API (`api/web/mcp-status.ts`)

| 路径                              | 方法 | 描述                                                          |
| --------------------------------- | ---- | ------------------------------------------------------------- |
| `/web/mcp/status`                 | GET  | 获取所有配置的 MCP 服务器状态（包括无实例的 disabled 服务器） |
| `/web/mcp/servers/:id/connect`    | POST | 连接 MCP 服务器                                               |
| `/web/mcp/servers/:id/disconnect` | POST | 断开 MCP 服务器                                               |
| `/web/mcp/servers/:id/tools`      | GET  | 获取服务器工具列表                                            |
| `/web/mcp/servers/:id/resources`  | GET  | 获取服务器资源列表                                            |

**`/web/mcp/status` API 变更说明**：

- 返回所有配置的服务器，包括没有实例的 disabled 服务器
- 对于无实例的服务器，返回默认的 `connected: false` 状态
- 服务器 ID 使用服务器名称作为标识

### 配置管理 API (`api/web/config.ts`)

| 路径                  | 方法  | 描述               |
| --------------------- | ----- | ------------------ |
| `/web/config`         | GET   | 获取系统配置       |
| `/web/config`         | PUT   | 更新系统配置       |
| `/web/config/export`  | POST  | 导出配置           |
| `/web/config/import`  | POST  | 导入配置           |
| `/web/config/servers` | PATCH | 批量更新服务器配置 |

### 日志 API (`api/web/logs.ts`)

| 路径                    | 方法   | 描述           |
| ----------------------- | ------ | -------------- |
| `/web/servers/:id/logs` | GET    | 获取服务器日志 |
| `/web/servers/:id/logs` | DELETE | 清除服务器日志 |

### 系统工具 API (`api/web/hub-tools.ts`)

**系统工具接口**：

| 路径                                                    | 方法 | 描述                           |
| ------------------------------------------------------- | ---- | ------------------------------ |
| `/web/hub-tools/system`                                 | GET  | 列出系统工具                   |
| `/web/hub-tools/system/:toolName/call`                  | POST | 调用系统工具                   |
| `/web/hub-tools/servers`                                | GET  | 列出所有连接的服务器           |
| `/web/hub-tools/servers/find`                           | GET  | 查找匹配模式的服务器           |
| `/web/hub-tools/servers/:serverId/tools`                | GET  | 列出特定服务器的所有工具       |
| `/web/hub-tools/servers/:serverId/tools/find`           | GET  | 在特定服务器中查找工具         |
| `/web/hub-tools/servers/:serverId/tools/:toolName`      | GET  | 获取特定工具详情               |
| `/web/hub-tools/servers/:serverId/tools/:toolName/call` | POST | 调用特定工具                   |
| `/web/hub-tools/tools`                                  | GET  | 列出所有服务器的所有工具       |
| `/web/hub-tools/tools/find`                             | GET  | 查找所有服务器中匹配模式的工具 |

**支持的系统工具**：

- `list-servers` - 列出所有连接的服务器
- `find-servers` - 查找匹配模式的服务器
- `list-all-tools-in-server` - 列出特定服务器的所有工具
- `find-tools-in-server` - 在特定服务器中查找匹配模式的工具
- `get-tool` - 获取特定工具的完整 schema
- `call-tool` - 调用特定服务器上的工具
- `find-tools` - 在所有服务器中查找匹配模式的工具

### 资源 API (`api/web/resources.ts`)

| 路径             | 方法 | 描述         |
| ---------------- | ---- | ------------ |
| `/web/resources` | GET  | 获取资源列表 |

### 会话管理 API (`api/web/sessions.ts`)

| 路径                       | 方法   | 描述               |
| -------------------------- | ------ | ------------------ |
| `/web/sessions`            | GET    | 列出所有持久化会话 |
| `/web/sessions/:sessionId` | GET    | 获取会话详情       |
| `/web/sessions/:sessionId` | DELETE | 删除会话           |

**响应格式**:

```typescript
// GET /web/sessions
{
  success: true,
  data: SessionState[],
  count: number
}

// GET /web/sessions/:sessionId
{
  success: true,
  data: SessionState
}

// DELETE /web/sessions/:sessionId
{
  success: true,
  message: 'Session deleted successfully'
}
```

### WebSocket 接口 (`api/ws/events.ts`, `api/ws/ws-handler.ts`)

**功能**:

- 实时事件推送
- 服务器状态变化通知
- 工具调用结果通知
- 日志更新通知

## 依赖关系

- **内部依赖**:
  - `src/services/` - 业务逻辑服务
  - `src/models/` - 数据模型
  - `src/utils/` - 工具函数

- **外部依赖**:
  - `fastify` - HTTP 服务器框架
  - `@fastify/websocket` - WebSocket 支持
  - `@modelcontextprotocol/sdk` - MCP 协议 SDK

## 数据模型

### 服务器配置响应

```typescript
interface McpServerConfig {
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

### 服务器状态响应

```typescript
interface ServerStatus {
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
  };
}
```

### 客户端上下文

```typescript
interface ClientContext {
  sessionId: string;
  clientName?: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
}
```

### 会话状态

```typescript
interface SessionState {
  sessionId: string;
  clientName?: string;
  clientVersion?: string;
  createdAt: number;
  lastAccessedAt: number;
  metadata: Record<string, unknown>;
}
```

## 测试与质量

### 集成测试

**文件**: `tests/integration/api/gateway.test.ts`

**测试覆盖**:

- MCP Gateway 初始化流程
- 工具列表获取
- 工具调用功能
- 错误处理

## 常见问题 (FAQ)

### Q: 如何添加新的 API 端点？

A: 在 `api/web/` 目录下创建新的路由文件，然后在 `src/app.ts` 中注册。

### Q: MCP 协议如何处理流式响应？

A: 使用 SSE (Server-Sent Events) 传输机制，通过 SSE 传输实现。

### Q: 会话 ID 如何生成？

A: 会话 ID 生成优先级：

1. 查询参数中的 `sessionId`
2. 从 initialize 请求的客户端信息生成
3. 匹配现有的 clientName 查找已存在的会话
4. 生成新的唯一会话 ID

### Q: 如何使用会话管理 API？

A:

- 列出所有会话：`GET /web/sessions`
- 获取特定会话：`GET /web/sessions/{sessionId}`
- 删除会话：`DELETE /web/sessions/{sessionId}`

删除会话会同时关闭该会话的活跃连接并从磁盘持久化存储中移除。

## 相关文件清单

| 文件路径                | 描述                        |
| ----------------------- | --------------------------- |
| `api/mcp/gateway.ts`    | MCP Gateway 路由            |
| `api/web/servers.ts`    | 服务器管理 API（v1.1 格式） |
| `api/web/search.ts`     | 搜索 API                    |
| `api/web/health.ts`     | 健康检查 API                |
| `api/web/mcp-status.ts` | MCP 状态 API                |
| `api/web/config.ts`     | 配置管理 API                |
| `api/web/logs.ts`       | 日志 API                    |
| `api/web/hub-tools.ts`  | 系统工具 API                |
| `api/web/resources.ts`  | 资源 API                    |
| `api/web/sessions.ts`   | 会话管理 API                |
| `api/ws/events.ts`      | WebSocket 事件处理          |
| `api/ws/ws-handler.ts`  | WebSocket 处理器            |
