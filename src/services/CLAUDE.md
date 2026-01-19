[根目录](../../CLAUDE.md) > [src](../) > **services**

# Services 模块

## 模块职责

Services 模块包含核心业务逻辑，是应用的业务层实现，负责处理服务器管理、网关代理、搜索等核心功能。

## 目录结构

```
services/
├── hub-manager.service.ts      # MCP 服务器管理器
├── gateway.service.ts         # MCP Gateway 网关服务
├── simple-search.service.ts   # 简化搜索服务
├── mcp-connection-manager.ts # MCP 连接管理器
└── log-storage.service.ts      # 日志存储服务
```

## 核心服务

### HubManagerService (`hub-manager.service.ts`)

**职责**: MCP 服务器的 CRUD 管理

**主要方法**:
- `getAllServers()` - 获取所有服务器
- `getServerById(id)` - 根据 ID 获取服务器
- `addServer(server)` - 添加新服务器
- `updateServer(id, updates)` - 更新服务器配置
- `removeServer(id)` - 删除服务器

**依赖**:
- `configManager` - 配置管理器

### GatewayService (`gateway.service.ts`)

**职责**: MCP Gateway 网关服务，聚合多个 MCP 服务器的工具

**主要方法**:
- `start()` - 启动 stdio 模式的 Gateway
- `createConnectionServer()` - 创建新的连接服务器实例

**功能**:
- 工具名称前缀化（服务器名称_工具名称）
- 工具调用路由到对应的服务器
- MCP 错误码映射

**依赖**:
- `mcpConnectionManager` - MCP 连接管理器
- `hubManager` - 服务器管理器
- `@modelcontextprotocol/sdk` - MCP SDK

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

### McpConnectionManager (`mcp-connection-manager.ts`)

**职责**: MCP 连接管理和工具调用

**主要方法**:
- `connectServer(serverId)` - 连接到服务器
- `disconnectServer(serverId)` - 断开服务器连接
- `getAllTools()` - 获取所有连接服务器的工具
- `callTool(serverId, toolName, args)` - 调用工具
- `listResources(serverId)` - 列出服务器资源
- `readResource(serverId, uri)` - 读取资源

**支持的传输协议**:
- `stdio` - 标准输入输出
- `sse` - Server-Sent Events
- `streamable-http` - HTTP 流传输

### LogStorageService (`log-storage.service.ts`)

**职责**: 日志存储和管理

**主要方法**:
- `addLog(serverId, logEntry)` - 添加日志
- `getLogs(serverId, limit)` - 获取日志
- `clearLogs(serverId)` - 清除日志

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
├── simple-search.service.ts
│   └── depends on: mcp-connection-manager.ts
│
├── mcp-connection-manager.ts
│   ├── depends on: hub-manager.service.ts
│   └── depends on: utils/transports/
│
└── log-storage.service.ts
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

**文件**: `tests/unit/services/hub-manager.test.ts`

**测试覆盖**:
- 服务器 CRUD 操作
- 错误处理
- 边界条件

## 常见问题 (FAQ)

### Q: 为什么选择直接遍历搜索？

A: 基于项目定位（独立开发者、轻量级），直接遍历在 50-200 工具规模下性能足够，且避免过度工程化。

### Q: 如何添加新的传输协议？

A: 在 `utils/transports/` 目录下实现新的 Transport 类，然后在 `mcp-connection-manager.ts` 中注册。

## 相关文件清单

| 文件路径 | 描述 |
|---------|------|
| `services/hub-manager.service.ts` | 服务器管理器 |
| `services/gateway.service.ts` | Gateway 网关服务 |
| `services/simple-search.service.ts` | 搜索服务 |
| `services/mcp-connection-manager.ts` | 连接管理器 |
| `services/log-storage.service.ts` | 日志存储服务 |

## 变更记录 (Changelog)

### 2026-01-19
- 初始化 Services 模块文档
