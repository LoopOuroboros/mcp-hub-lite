[根目录](../../CLAUDE.md) > [src](../) > **services**

# Services 模块

## 模块职责

Services 模块包含核心业务逻辑，是应用的业务层实现，负责处理服务器管理、网关代理、搜索等核心功能。

## 目录结构

```
services/
├── hub-manager.service.ts      # MCP 服务器管理器
├── gateway.service.ts         # MCP Gateway 网关服务
├── mcp-connection-manager.ts  # MCP 连接管理器
├── hub-tools.service.ts       # 系统工具服务
├── log-storage.service.ts     # 日志存储服务
├── event-bus.service.ts       # 事件总线服务
├── system-tool-handler.ts     # 系统工具处理器
├── gateway/                   # Gateway 子模块
│   ├── index.ts
│   ├── gateway.service.ts
│   ├── global-transport.ts   # 全局无状态 transport/server
│   ├── types.ts
│   ├── log-formatter.ts
│   ├── tool-list-generator.ts
│   └── request-handlers/
│       ├── index.ts
│       ├── resources-handler.ts
│       ├── call-tool-handler.ts
│       ├── initialize-handler.ts
│       └── system-tools-handler.ts
├── connection/                # Connection 子模块
│   ├── index.ts
│   ├── connection-manager.ts
│   ├── types.ts
│   └── tool-cache.ts
└── hub-tools/                 # Hub Tools 子模块
    ├── index.ts
    ├── types.ts
    ├── server-selector.ts
    ├── instance-selector.ts
    ├── system-tool-definitions.ts
    ├── resource-generator.ts
    └── use-guide.md
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

### GlobalTransport (`gateway/global-transport.ts`)

**职责**: 全局共享无状态 MCP transport/server 实例

**功能特性**:

- SDK 原生无状态模式
- 全局单一 transport/server 实例
- 无 sessionId 隔离，所有客户端共享同一实例
- 简化的架构设计

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
- `listServers()` - 获取服务器列表（仅返回已连接的服务器）
- `findServers(pattern, searchIn, caseSensitive)` - 查找服务器
- `listAllToolsInServer(serverId)` - 列出服务器所有工具
- `findToolsInServer(serverId, pattern, searchIn, caseSensitive)` - 查找服务器中的工具
- `getTool(serverId, toolName)` - 获取工具 schema
- `callSystemTool(toolName, toolArgs)` - 调用系统工具
- `callTool(serverId, toolName, toolArgs)` - 调用工具
- `listAllTools()` - 列出所有服务器的所有工具
- `findTools(pattern, searchIn, caseSensitive)` - 查找所有工具

**优化说明**: 使用 serverId 替代 serverName，直接使用服务器唯一标识符进行操作，避免了通过名称查找服务器的开销。

**重要更新**:

- `listServers()` 方法现在只返回实际已连接（Connected）的服务器，过滤掉 Disconnected 状态的服务器
- `getTool()` 方法现在支持处理 `MCP_HUB_LITE_SERVER`（mcp-hub-lite）特殊服务器，返回系统工具的完整 schema

**依赖**:

- `hubManager` - 服务器管理器
- `mcpConnectionManager` - MCP 连接管理器

### HubTools 子模块 (`hub-tools/`)

**职责**: 模块化的 Hub Tools 实现，提供系统工具定义、服务器选择和资源生成

**模块组成**:

- `index.ts` - 统一导出模块
- `types.ts` - 类型定义
- `server-selector.ts` - 服务器选择器（hasValidId, selectBestInstance, getServerDescription）
- `instance-selector.ts` - 实例选择器（支持随机、轮询、标签匹配唯一三种策略）
- `system-tool-definitions.ts` - 系统工具定义（getSystemTools）
- `resource-generator.ts` - 动态资源生成（generateDynamicResources, readResource）
- `use-guide.md` - 用户使用指南
- `developer-guide.md` - 开发者指南（包含 MCP_HUB_LITE_SERVER 处理规范）

**功能**:

- 动态资源列表生成，仅保留服务器元数据
- 系统工具定义与 MCP 协议集成
- 服务器实例选择逻辑
- 通用服务器描述获取（getServerDescription）
- 多实例服务器的智能实例选择策略

**新增方法**:

- `getServerDescription(serverConfig, serverName)` - 获取服务器描述，使用默认描述当配置中没有提供时
- `InstanceSelector.selectInstance()` - 基于配置策略选择最佳实例

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
├── hub-tools.service.ts
│   ├── depends on: hub-manager.service.ts
│   └── depends on: mcp-connection-manager.ts
│
├── hub-tools/ (submodule)
│   ├── depends on: hub-manager.service.ts
│   ├── depends on: mcp-connection-manager.ts
│   └── depends on: hub-tools.service.ts
│
├── log-storage.service.ts
│
└── event-bus.service.ts
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

## 测试与质量

### 单元测试

**状态**: 部分实现

**测试覆盖**:

- 服务器 CRUD 操作
- 错误处理
- 边界条件

**测试文件**:

- `tests/unit/services/hub-manager.test.ts`
- `tests/unit/services/hub-tools.service.test.ts`
- `tests/unit/services/hub-manager-service.test.ts`
- `tests/unit/services/gateway-logging.test.ts`

## 相关文件清单

| 文件路径                               | 描述                 |
| -------------------------------------- | -------------------- |
| `services/hub-manager.service.ts`      | 服务器管理器         |
| `services/gateway.service.ts`          | Gateway 网关服务     |
| `services/gateway/global-transport.ts` | 全局无状态 transport |
| `services/mcp-connection-manager.ts`   | 连接管理器           |
| `services/hub-tools.service.ts`        | 系统工具服务         |
| `services/log-storage.service.ts`      | 日志存储服务         |
| `services/event-bus.service.ts`        | 事件总线服务         |
| `services/system-tool-handler.ts`      | 系统工具处理器       |
| `services/gateway/`                    | Gateway 子模块       |
| `services/connection/`                 | Connection 子模块    |
| `services/hub-tools/`                  | Hub Tools 子模块     |
