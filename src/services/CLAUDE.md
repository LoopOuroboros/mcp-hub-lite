[根目录](../../CLAUDE.md) > [src](../) > **services**

# Services 模块

## 模块职责

Services 模块包含核心业务逻辑，是应用的业务层实现，负责处理服务器管理、网关代理、搜索、会话管理等核心功能。

## 目录结构

```
services/
├── hub-manager.service.ts      # MCP 服务器管理器
├── gateway.service.ts         # MCP Gateway 网关服务
├── simple-search.service.ts   # 简化搜索服务
├── mcp-connection-manager.ts # MCP 连接管理器
├── mcp-session-manager.ts    # MCP 会话管理器（支持持久化）
├── hub-tools.service.ts       # 系统工具服务
├── log-storage.service.ts      # 日志存储服务
├── event-bus.service.ts      # 事件总线服务
├── client-tracker.service.ts  # 客户端追踪服务
└── search/                    # 搜索服务子模块
    ├── search-core.service.ts
    ├── search-scorer.ts
    ├── search-cache.ts
    └── types.ts
```

## 核心服务

### HubManagerService (`hub-manager.service.ts`)

**职责**: MCP 服务器的 CRUD 管理

**主要方法**:

- `getAllServers()` - 获取所有服务器
- `getServerById(id)` - 根据 ID 获取服务器
- `getServerByName(name)` - 根据名称获取服务器
- `addServer(name, config)` - 添加新服务器
- `addServerInstance(name, instance)` - 添加服务器实例
- `updateServer(name, updates)` - 更新服务器配置
- `updateServerInstance(name, index, updates)` - 更新服务器实例
- `removeServer(name)` - 删除服务器
- `removeServerInstance(name, index)` - 删除服务器实例
- `addServersWithoutAutoStart(servers)` - 批量添加服务器（不自动启动）
- `addServerInstancesWithoutConnect(serverNames)` - 批量创建服务器实例（不自动连接）
- `connectServerInstances(serverNames)` - 并发连接多个服务器实例

**依赖**:

- `configManager` - 配置管理器

### GatewayService (`gateway.service.ts`)

**职责**: MCP Gateway 网关服务，聚合多个 MCP 服务器的工具

**主要方法**:

- `start()` - 启动 stdio 模式的 Gateway
- `createConnectionServer()` - 创建新的连接服务器实例
- `generateGatewayToolsList(tool)` - 生成网关工具列表

**功能**:

- 工具名称前缀化（服务器名称\_工具名称）
- 工具调用路由到对应的服务器
- MCP 错误码映射

**依赖**:

- `mcpConnectionManager` - MCP 连接管理器
- `hubManager` - 服务器管理器
- `@modelcontextprotocol/sdk` - MCP SDK

### McpConnectionManager (`mcp-connection-manager.ts`)

**职责**: MCP 连接管理和工具调用

**主要方法**:

- `connect(server)` - 连接到服务器
- `disconnect(serverId)` - 断开服务器连接
- `disconnectAll()` - 断开所有连接
- `refreshTools(serverId)` - 刷新服务器工具列表
- `refreshResources(serverId)` - 刷新服务器资源列表
- `getStatus(serverId)` - 获取服务器状态
- `getTools(serverId)` - 获取服务器工具
- `getAllTools()` - 获取所有服务器工具
- `getToolCacheEntries()` - 获取工具缓存条目
- `getServerIdByName(name)` - 根据服务器名称获取 ID
- `getClientByName(name)` - 根据服务器名称获取客户端
- `callToolByName(name, toolName, args)` - 通过服务器名称调用工具
- `getStatusByName(name)` - 通过服务器名称获取状态
- `getToolsByName(name)` - 通过服务器名称获取工具
- `getResourcesByName(name)` - 通过服务器名称获取资源
- `callTool(serverId, toolName, args)` - 调用工具
- `getToolsByServerName(serverName)` - 获取服务器名称级别的工具
- `getAllToolsByServerName()` - 获取所有服务器名称的工具

**支持的传输协议**:

- `stdio` - 标准输入输出
- `sse` - Server-Sent Events
- `streamable-http` / `http` - HTTP 流传输

### McpSessionManager (`mcp-session-manager.ts`)

**职责**: MCP 会话管理器，基于 sessionId 管理会话状态，支持持久化

**主要方法**:

- `getSession(sessionId, requireInitialize)` - 获取或创建会话
- `getAllSessionStates()` - 获取所有持久化会话状态
- `getSessionState(sessionId)` - 获取特定会话状态
- `deleteSession(sessionId)` - 删除会话
- `updateSessionMetadata(sessionId, metadata)` - 更新会话元数据
- `restoreSessions()` - 从磁盘恢复会话
- `flushDirtySessions()` - 刷新脏会话到磁盘

**功能特性**:

- 基于 sessionId 的会话隔离
- 共享服务器实例以优化性能
- 自动清理过期会话（可配置超时，默认 30 分钟）
- 会话状态持久化到磁盘（`~/.mcp-hub-lite/sessions/`）
- 服务重启后自动恢复会话状态
- 脏数据追踪，5 秒批量刷新，减少 I/O
- 优雅关闭处理，确保数据不丢失
- 可配置的会话超时（通过 `config.security.sessionTimeout`）

**会话存储结构**:

```
~/.mcp-hub-lite/
└── sessions/
    ├── index.json          # 会话索引
    └── {sessionId}.json    # 单个会话状态
```

**调试环境变量**:

- `SESSION_DEBUG` - 启用会话调试日志

### HubToolsService (`hub-tools.service.ts`)

**职责**: 提供系统工具和服务器管理工具的统一接口

**主要系统工具**:

- `list-servers` - 列出所有连接的服务器
- `find-servers` - 查找匹配模式的服务器
- `list-all-tools-in-server` - 列出特定服务器的所有工具
- `find-tools-in-server` - 在特定服务器中查找匹配模式的工具
- `get-tool` - 获取特定工具的完整 schema
- `call-tool` - 调用特定服务器上的工具
- `find-tools` - 在所有服务器中查找匹配模式的工具

**主要方法**:

- `getSystemTools()` - 获取系统工具列表
- `listServers()` - 获取服务器列表
- `findServers(pattern, searchIn, caseSensitive)` - 查找服务器
- `listAllToolsInServer(serverId)` - 列出服务器所有工具
- `findToolsInServer(serverId, pattern, searchIn, caseSensitive)` - 查找服务器中的工具
- `getTool(serverId, toolName)` - 获取工具 schema
- `callSystemTool(toolName, toolArgs)` - 调用系统工具
- `callTool(serverId, toolName, toolArgs)` - 调用工具
- `listAllTools()` - 列出所有服务器的所有工具
- `findTools(pattern, searchIn, caseSensitive)` - 查找所有工具

**优化说明**: 使用 serverId 替代 serverName，直接使用服务器唯一标识符进行操作，避免了通过名称查找服务器的开销。

**依赖**:

- `hubManager` - 服务器管理器
- `mcpConnectionManager` - MCP 连接管理器

### SimpleSearchService (`simple-search.service.ts`)

**职责**: 简化搜索实现，基于字符串匹配

**主要方法**:

- `searchTools(query, filters)` - 搜索工具

**搜索策略**:

- 直接遍历工具列表
- 字符串包含匹配（大小写不敏感）
- 支持名称、描述、标签搜索

**性能目标**:

- 适用规模：50-200 个工具
- 响应时间：<100ms

### SearchCoreService (`search/search-core.service.ts`)

**职责**: 核心搜索服务，支持模糊搜索和评分

**主要方法**:

- `search(query, options)` - 执行搜索

**功能**:

- 模糊搜索算法
- 评分机制
- 缓存支持
- 事件驱动缓存失效

### LogStorageService (`log-storage.service.ts`)

**职责**: 日志存储和管理

**主要方法**:

- `append(serverId, level, message)` - 添加日志
- `getLogs(serverId, limit)` - 获取日志
- `clearLogs(serverId)` - 清除日志

### EventBusService (`event-bus.service.ts`)

**职责**: 事件总线，用于模块间通信

**事件类型**:

- `SERVER_ADDED` - 服务器添加
- `SERVER_UPDATED` - 服务器更新
- `SERVER_DELETED` - 服务器删除
- `SERVER_INSTANCE_ADDED` - 服务器实例添加
- `SERVER_INSTANCE_UPDATED` - 服务器实例更新
- `SERVER_INSTANCE_DELETED` - 服务器实例删除
- `SERVER_CONNECTED` - 服务器连接
- `SERVER_DISCONNECTED` - 服务器断开
- `SERVER_STATUS_CHANGE` - 服务器状态变化
- `TOOLS_UPDATED` - 工具更新
- `RESOURCES_UPDATED` - 资源更新
- `TOOL_CALL_STARTED` - 工具调用开始
- `TOOL_CALL_COMPLETED` - 工具调用完成
- `TOOL_CALL_ERROR` - 工具调用错误
- `CONFIGURATION_UPDATED` - 配置更新

### ClientTrackerService (`client-tracker.service.ts`)

**职责**: 客户端追踪服务

**主要方法**:

- `updateClient(clientContext)` - 更新客户端信息
- `getClients()` - 获取所有客户端
- `getClient(sessionId)` - 获取特定客户端
- `updateClientRoots(sessionId, roots)` - 更新客户端 roots
- `removeClient(sessionId)` - 删除客户端

## 依赖关系

```
services/
├── hub-manager.service.ts
│   └── depends on: config/config-manager.ts
│
├── gateway.service.ts
│   ├── depends on: mcp-connection-manager.ts
│   ├── depends on: hub-manager.service.ts
│   └── depends on: @modelcontextprotocol/sdk
│
├── mcp-connection-manager.ts
│   ├── depends on: hub-manager.service.ts
│   └── depends on: utils/transports/
│
├── mcp-session-manager.ts
│   ├── depends on: gateway.service.ts
│   ├── depends on: config/config-manager.ts
│   ├── depends on: models/session.model.ts
│   ├── depends on: client-tracker.service.ts
│   └── depends on: utils/transports/
│
├── hub-tools.service.ts
│   ├── depends on: hub-manager.service.ts
│   └── depends on: mcp-connection-manager.ts
│
├── log-storage.service.ts
│
├── event-bus.service.ts
│
└── client-tracker.service.ts
```

## 数据模型

### 工具缓存项

```typescript
interface CachedTool {
  serverId: string;
  name: string;
  description?: string;
  inputSchema?: any;
}
```

### 连接状态

```typescript
enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}
```

### 会话状态

```typescript
interface SessionState {
  sessionId: string;
  clientName?: string;
  clientVersion?: string;
  cwd?: string;
  project?: string;
  createdAt: number;
  lastAccessedAt: number;
  metadata: Record<string, unknown>;
}
```

## 测试与质量

### 单元测试

**状态**: 部分实现

**测试覆盖**:

- 服务器 CRUD 操作
- 错误处理
- 边界条件
- 会话管理器功能
- 搜索服务

**测试文件**:

- `tests/unit/services/session-manager.test.ts`
- `tests/unit/services/hub-manager.test.ts`
- `tests/unit/services/hub-tools.service.test.ts`
- `tests/unit/services/hub-manager-service.test.ts`
- `tests/unit/services/gateway-logging.test.ts`
- `tests/unit/services/search/search-cache.test.ts`
- `tests/unit/services/search/search-core.service.test.ts`
- `tests/unit/services/search/search-scorer.test.ts`

## 常见问题 (FAQ)

### Q: 为什么选择直接遍历搜索？

A: 基于项目定位（独立开发者、轻量级），直接遍历在 50-200 工具规模下性能足够，且避免过度工程化。

### Q: 如何添加新的传输协议？

A: 在 `utils/transports/` 目录下实现新的 Transport 类，然后在 `mcp-connection-manager.ts` 中注册。

### Q: 会话持久化如何工作？

A: 会话状态在以下情况会被持久化：
1. 会话创建或访问时标记为"脏"
2. 脏会话会在 5 秒后批量刷新到磁盘
3. 服务关闭前会强制刷新所有脏会话
4. 服务启动时会自动从 `~/.mcp-hub-lite/sessions/` 恢复会话

### Q: 如何配置会话超时？

A: 通过配置文件中的 `security.sessionTimeout` 字段设置，单位为毫秒，默认 30 分钟（1800000ms）。

## 相关文件清单

| 文件路径                             | 描述             |
| ------------------------------------ | ---------------- |
| `services/hub-manager.service.ts`    | 服务器管理器     |
| `services/gateway.service.ts`        | Gateway 网关服务 |
| `services/simple-search.service.ts`  | 搜索服务         |
| `services/mcp-connection-manager.ts` | 连接管理器       |
| `services/mcp-session-manager.ts`    | 会话管理器（支持持久化） |
| `services/hub-tools.service.ts`      | 系统工具服务     |
| `services/log-storage.service.ts`    | 日志存储服务     |
| `services/event-bus.service.ts`      | 事件总线服务     |
| `services/client-tracker.service.ts` | 客户端追踪服务   |
| `services/search/search-core.service.ts` | 核心搜索服务   |
| `services/search/search-scorer.ts`   | 搜索评分服务     |
| `services/search/search-cache.ts`    | 搜索缓存服务     |

## 变更记录 (Changelog)

### 2026-02-15

- 更新 McpSessionManager 文档，添加持久化功能说明
- 添加会话存储结构说明
- 添加会话管理 API 文档
- 更新依赖关系图

### 2026-02-05

- 更新 Services 模块文档
- 添加会话管理器文档
- 添加事件总线文档
- 添加客户端追踪服务文档

### 2026-01-20

- 添加 HubToolsService 文档
- 优化 HubTools 调用逻辑，使用 serverId 替代 serverName，避免查找开销

### 2026-01-19

- 初始化 Services 模块文档
