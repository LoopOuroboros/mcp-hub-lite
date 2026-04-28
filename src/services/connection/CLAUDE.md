[根目录](../../../CLAUDE.md) > [src](../../) > [services](../) > **connection**

# Connection 子模块

## 模块职责

Connection 子模块负责 MCP (Model Context Protocol) 服务器连接管理，提供统一的接口用于工具和资源操作。该模块处理完整的 MCP 服务器连接生命周期，包括连接建立、客户端管理、工具/资源缓存、事件处理和错误恢复。

## 目录结构

```
connection/
├── index.ts              # 统一导出
├── types.ts             # 类型定义
├── connection-manager.ts # 连接管理器主类
└── tool-cache.ts        # 工具缓存实现
```

## 核心组件

### Index (`index.ts`)

**职责**: 统一导出模块功能

**导出内容**:

- `McpConnectionManager` - 连接管理器类
- `mcpConnectionManager` - 连接管理器实例
- `ServerStatus` - 服务器状态类型

### Types (`types.ts`)

**职责**: 定义连接管理相关的类型

**主要类型**:

- `ServerStatus` - 服务器连接状态和元数据接口

**ServerStatus 接口**:

```typescript
interface ServerStatus {
  connected: boolean; // 是否已连接
  error?: string; // 错误信息（如果连接失败）
  lastCheck: number; // 最后状态检查时间戳（毫秒）
  toolsCount: number; // 可用工具数量
  resourcesCount: number; // 可用资源数量
  pid?: number; // stdio 服务器的进程 ID
  startTime?: number; // 服务器启动时间戳（毫秒）
  version?: string; // 从 MCP 协议获取的服务器版本
  hash?: string; // 服务器实例的唯一标识符哈希
}
```

### Connection Manager (`connection-manager.ts`)

**职责**: MCP 服务器连接管理的核心实现

**主要功能**:

- **连接管理**: 支持多种传输协议（stdio, SSE, HTTP）的连接建立和断开
- **客户端管理**: 管理 MCP SDK 客户端实例和传输层
- **缓存优化**: 工具和资源缓存，支持复合键和服务器名称两种访问模式
- **事件处理**: 发布连接状态变化、工具更新、资源更新等事件
- **错误恢复**: 全面的错误处理和状态跟踪
- **双向通信**: 支持工具执行的双向通信

**核心方法**:

#### 连接相关

- `connect(serverName, serverIndex, server)` - 连接到 MCP 服务器
- `disconnect(serverName, serverIndex)` - 断开服务器连接
- `disconnectAll()` - 断开所有服务器连接

#### 工具管理

- `refreshTools(serverName, serverIndex)` - 刷新工具缓存
- `getTools(serverName, serverIndex)` - 获取缓存的工具
- `getToolsByName(name)` - 通过服务器名称获取工具
- `getTool(serverName, toolName)` - 获取特定工具
- `getAllTools()` - 获取所有工具
- `getAllToolsByServerName()` - 获取所有服务器名称级别的工具

#### 资源管理

- `refreshResources(serverName, serverIndex)` - 刷新资源缓存
- `getResources(serverName, serverIndex)` - 获取缓存的资源
- `getResourcesByName(name)` - 通过服务器名称获取资源
- `readResource(serverName, serverIndex, uri)` - 读取特定资源
- `getAllResources()` - 获取所有资源（按服务器分组）

#### 状态查询

- `getStatus(serverName, serverIndex)` - 获取服务器状态
- `getStatusByName(name)` - 通过服务器名称获取状态（向后兼容）
- `getClient(name, index)` - 获取 MCP 客户端实例

#### 工具调用

- `callTool(serverName, serverIndex, toolName, args)` - 调用工具

**复合键系统**:

- 使用 `serverName-serverIndex` 格式的复合键进行内部管理
- 支持多实例服务器的独立连接管理
- 提供服务器名称到复合键的映射

**事件发布**:

- `SERVER_CONNECTED` - 服务器连接成功
- `SERVER_DISCONNECTED` - 服务器断开连接
- `SERVER_STATUS_CHANGE` - 服务器状态变化
- `TOOLS_UPDATED` - 工具列表更新
- `RESOURCES_UPDATED` - 资源列表更新

**传输协议支持**:

- **stdio**: 本地进程 MCP 服务器
- **SSE**: Server-Sent Events 远程服务器（单向）
- **streamable-http/http**: HTTP 流传输远程服务器（双向）

**特殊处理**:

- SSE 传输是单向的，跳过工具/资源刷新以提高性能
- 自动处理服务器删除事件，自动断开相关实例
- 支持 MCP 通信调试日志（通过 `MCP_COMM_DEBUG` 环境变量）

### Tool Cache (`tool-cache.ts`)

**职责**: 工具缓存的底层实现

**主要功能**:

- 复合键级别的工具缓存
- 服务器名称级别的工具缓存（聚合多个实例）
- 名称映射管理
- 缓存清理和查询

**关键特性**:

- 同时维护复合键和服务器名称两种缓存视图
- 确保数据一致性
- 优化不同访问模式的性能

## 依赖关系

```
connection/
├── index.ts
│   └── exports: connection-manager.ts, types.ts
├── types.ts
│   └── no dependencies
├── connection-manager.ts
│   ├── depends on: @modelcontextprotocol/sdk
│   ├── depends on: @utils/transports/transport-factory.ts
│   ├── depends on: @utils/logger.js
│   ├── depends on: @utils/json-utils.js
│   ├── depends on: @services/log-storage.service.js
│   ├── depends on: @services/event-bus.service.js
│   ├── depends on: @services/hub-manager.service.js
│   ├── depends on: @models/system-tools.constants.js
│   ├── depends on: @config/config.schema.js
│   ├── depends on: @shared-models/server.model.js
│   ├── depends on: @config/config-manager.js
│   └── depends on: ./tool-cache.ts
└── tool-cache.ts
    └── no external dependencies
```

## 集成方式

Connection 子模块主要被以下组件使用：

- **HubManagerService (`hub-manager.service.ts`)**: 服务器管理服务使用连接管理器进行服务器连接控制
- **HubToolsService (`hub-tools.service.ts`)**: 系统工具服务使用连接管理器进行工具调用和资源访问
- **Gateway Service (`gateway.service.ts`)**: 网关服务使用连接管理器进行工具路由和调用
- **API 路由 (`api/web/mcp-status.ts`)**: MCP 状态 API 使用连接管理器获取服务器状态

## 测试与质量

### 单元测试

**状态**: 部分实现

**测试覆盖**:

- 连接建立和断开
- 工具缓存管理
- 资源缓存管理
- 状态查询
- 错误处理

**相关测试文件**:

- `tests/unit/services/connection-manager.test.ts` (待添加)

### 集成测试

**状态**: 通过主服务集成测试覆盖

**相关测试文件**:

- `tests/integration/gateway/mcp-connection.test.ts`

## 相关文件清单

| 文件路径                           | 描述                       |
| ---------------------------------- | -------------------------- |
| `connection/index.ts`              | 统一导出                   |
| `connection/types.ts`              | 类型定义                   |
| `connection/connection-manager.ts` | 连接管理器主类             |
| `connection/tool-cache.ts`         | 工具缓存实现               |
| `../hub-manager.service.ts`        | 服务器管理器（使用此模块） |
| `../hub-tools.service.ts`          | 系统工具服务（使用此模块） |
| `../gateway.service.ts`            | 网关服务（使用此模块）     |
| `../../api/web/mcp-status.ts`      | MCP 状态 API（使用此模块） |
