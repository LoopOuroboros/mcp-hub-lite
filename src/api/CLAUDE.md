[根目录](../../CLAUDE.md) > [src](../) > **api**

# API 模块

## 模块职责

API 模块负责处理所有 HTTP 请求，包括 MCP JSON-RPC 2.0 协和其他 Web API 接口。

## 目录结构

```
api/
├── mcp/                     # MCP 协议处理
│   └── gateway.ts           # MCP Gateway 网关路由
├── web/                     # Web API 路由
│   ├── servers.ts            # 服务器管理 API
│   ├── search.ts             # 搜索 API
│   ├── health.ts            # 健康检查 API
│   ├── mcp-status.ts        # MCP 状态 API
│   ├── config.ts            # 配置管理 API
│   ├── logs.ts             # 日志 API
│   ├── hub-tools.ts         # 系统工具 API
│   └── clients.ts           # 客户端管理 API
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
- `cwd` - 当前工作目录
- `project` - 项目名称
- `ip` - 客户端 IP
- `userAgent` - 用户代理信息

## Web API 接口

### 服务器管理 API (`api/web/servers.ts`)

| 路径 | 方法 | 描述 |
|-------|------|------|
| `/web/servers` | GET | 获取所有服务器配置 |
| `/web/servers` | POST | 添加新服务器 |
| `/web/servers/:id` | PUT | 更新服务器配置 |
| `/web/servers/:id` | DELETE | 删除服务器 |

### 搜索 API (`api/web/search.ts`)

| 路径 | 方法 | 描述 |
|-------|------|------|
| `/web/search` | GET | 搜索工具 |

**查询参数**:
- `q` - 搜索关键词
- `limit` - 结果限制数量

### 健康检查 API (`api/web/health.ts`)

| 路径 | 方法 | 描述 |
|-------|------|------|
| `/health` | GET | 系统健康检查 |

### MCP 状态 API (`api/web/mcp-status.ts`)

| 路径 | 方法 | 描述 |
|-------|------|------|
| `/web/mcp/status` | GET | 获取所有 MCP 服务器状态 |
| `/web/mcp/servers/:id/connect` | POST | 连接 MCP 服务器 |
| `/web/mcp/servers/:id/disconnect` | POST | 断开 MCP 服务器 |
| `/web/mcp/servers/:id/tools` | GET | 获取服务器工具列表 |
| `/web/mcp/servers/:id/resources` | GET | 获取服务器资源列表 |

### 配置管理 API (`api/web/config.ts`)

| 路径 | 方法 | 描述 |
|-------|------|------|
| `/web/config` | GET | 获取系统配置 |
| `/web/config` | PUT | 更新系统配置 |

### 日志 API (`api/web/logs.ts`)

| 路径 | 方法 | 描述 |
|-------|------|------|
| `/web/servers/:id/logs` | GET | 获取服务器日志 |
| `/web/servers/:id/logs` | DELETE | 清除服务器日志 |

### 系统工具 API (`api/web/hub-tools.ts`)

**系统工具接口**：

| 路径 | 方法 | 描述 |
|-------|------|------|
| `/web/hub-tools/system` | GET | 列出系统工具 |
| `/web/hub-tools/system/:toolName/call` | POST | 调用系统工具 |
| `/web/hub-tools/servers` | GET | 列出所有连接的服务器 |
| `/web/hub-tools/servers/find` | GET | 查找匹配模式的服务器 |
| `/web/hub-tools/servers/:serverId/tools` | GET | 列出特定服务器的所有工具 |
| `/web/hub-tools/servers/:serverId/tools/find` | GET | 在特定服务器中查找工具 |
| `/web/hub-tools/servers/:serverId/tools/:toolName` | GET | 获取特定工具详情 |
| `/web/hub-tools/servers/:serverId/tools/:toolName/call` | POST[ | 调用特定工具 |
| `/web/hub-tools/tools` | GET | 列出所有服务器的所有工具 |
| `/web/hub-tools/tools/find` | GET | 查找所有服务器中匹配模式的工具 |

**支持的系统工具**：
- `list-servers` - 列出所有连接的服务器
- `find-servers` - 查找匹配模式的服务器
- `list-all-tools-in-server` - 列出特定服务器的所有工具
- `find-tools-in-server` - 在特定服务器中查找匹配模式的工具
- `get-tool` - 获取特定工具的完整 schema
- `call-tool` - 调用特定服务器上的工具
- `find-tools` - 在所有服务器中查找匹配模式的工具

### 客户端管理 API (`api/web/clients.ts`)

| 路径 | 方法 | 描述 |
|-------|------|------|
| `/web/clients` | GET | 获取所有连接的客户端 |
| `/web/clients/:sessionId` | GET | 获取特定客户端信息 |

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
  cwd?: string;
  project?: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
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

## 相关文件清单

| 文件路径 | 描述 |
|---------|------|
| `api/mcp/gateway.ts` | MCP Gateway 路由 |
| `api/web/servers.ts` | 服务器管理 API |
| `api/web/search.ts` | 搜索 API |
| `api/web/health.ts` | 健康检查 API |
| `api/web/mcp-status.ts` | MCP 状态 API |
| `api/web/config.ts` | 配置管理 API |
| `api/web/logs.ts` | 日志 API |
| `api/web/hub-tools.ts` | 系统工具 API |
| `api/web/clients.ts` | 客户端管理 API |
| `api/ws/events.ts` | WebSocket 事件处理 |
| `api/ws/ws-handler.ts` | WebSocket 处理器 |

## 变更记录 (Changelog)

### 2026-02-05
- 更新 API 模块文档
- 添加 WebSocket 接口文档
- 添加客户端管理 API 文档
- 添加会话管理相关文档

### 2026-01-20
- 添加 HubTools API 接口文档
- 优化 HubTools 调用逻辑，使用 serverId 替代 serverName，避免查找开销

### 2026-01-19
- 初始化 API 模块文档
