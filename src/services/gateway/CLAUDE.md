[根目录](../../../CLAUDE.md) > [src](../../) > [services](../) > **gateway**

# Gateway 子模块

## 模块职责

Gateway 子模块负责处理 MCP (Model Context Protocol) 网关的核心逻辑，包括请求处理、工具路由、资源管理等。该模块实现了 MCP 协议的服务器端，为多个后端 MCP 服务器提供统一的代理接口。

## 目录结构

```typescript
gateway/
├── index.ts                    # 统一导出
├── gateway.service.ts          # Gateway 服务主类
├── global-transport.ts        # Transport 工具函数（stateful + stateless 双模式）
├── session-manager.ts        # 会话管理器
├── types.ts                   # 类型定义
├── log-formatter.ts           # 日志格式化工具
├── tool-list-generator.ts     # 工具列表生成器
└── request-handlers/          # 请求处理器
    ├── index.ts
    ├── resources-handler.ts
    ├── call-tool-handler.ts
    ├── initialize-handler.ts
    ├── initialize.constants.ts
    └── system-tools-handler.ts
```

## 核心架构

### 双模式会话支持（v1.3.1+）

MCP Gateway 支持两种会话模式，通过配置和请求头灵活切换：

| 模式                 | 适用客户端              | 行为                                                      |
| -------------------- | ----------------------- | --------------------------------------------------------- |
| **stateful**（默认） | ClaudeCode 等标准客户端 | 会话持久化、SSE 流、通知推送、SDK PING 存活探测           |
| **stateless**        | CherryStudio 等         | Per-request transport，无会话持久化，无 SSE，GET 返回 405 |

**决策优先级**：请求头 `x-mcp-session-mode` > UA 关键词匹配 `sessionModeRules` > 默认 `defaultSessionMode`（`"stateful"`）

**UA 匹配规则**（`system.session.sessionModeRules`）：

- `stateful` 数组：匹配这些 UA 关键词（忽略大小写）→ 使用 stateful 模式
- `stateless` 数组：匹配这些 UA 关键词（忽略大小写）→ 使用 stateless 模式
- 未命中任何规则时使用 `defaultSessionMode`

**stateless 模式**（恢复 v1.3.0 行为）：

- 每次 POST 创建新的 transport+server 对，用完即 GC
- `createPerRequestTransport()` 工厂函数（`global-transport.ts`）

**stateful 模式**（当前默认行为）：

- 每个客户端会话（`mcp-session-id`）拥有独立的 `StreamableHTTPServerTransport` + `McpServer` 对
- SDK stateful 模式：`sessionIdGenerator` 生成 session ID，客户端后续请求携带该 header
- `SessionManager` 管理会话生命周期、通知广播（3s debounce）、SSE 引用计数、陈旧清理（超时时间由 `security.idleConnectionTimeout` 配置决定）
- GET /mcp 支持 SSE 长连接接收通知推送
- 通知为纯信号（不含数据），客户端收到后自行重新请求完整列表

**工作流程**:

1. 客户端 POST /mcp（无 sessionId）→ 创建新 transport+server → SDK 生成 sessionId
2. 客户端后续 POST/GET/DELETE /mcp（带 sessionId）→ SessionManager 路由到已有 transport
3. GET /mcp → 建立 SSE 流，接收 `notifications/*/list_changed` 通知
4. DELETE /mcp → SDK 清理会话 → SessionManager 移除

### 请求处理器

**Initialize Handler (`initialize-handler.ts`)**:

- 处理 `initialize` 请求和 `initialized` 通知
- 返回网关的协议版本、服务器信息和能力声明（包括 `tools`、`resources`、`logging`）
- 记录客户端连接信息用于调试

**Resources Handler (`resources-handler.ts`)**:

- 处理资源相关的 MCP 请求
- 聚合所有连接服务器的资源列表
- 支持资源读取操作

**Call Tool Handler (`call-tool-handler.ts`)**:

- 处理工具调用请求
- 通过全局缓存 `getOrBuildGatewayToolMap()` 获取路由映射（不再使用 per-request toolMap）
- 从 wrapped args 提取 `serverName`/`toolName`/`toolArgs`/`requestOptions`
- 统一通过 `hubToolsService.callTool()` → `InstanceSelector` 路由，确保实例选择策略一致
- 处理系统工具调用（如 `list_servers`, `find_tools` 等）

**Tool List Generator (`tool-list-generator.ts`)**:

- 维护双层全局缓存（原始数据层 + 名称决议层）
- `gatherRawToolData()` — 从全局状态采集聚合工具数据，保留 serverIndex
- `resolveToolNames()` — 纯计算，名称碰撞决议，包装 inputSchema 为统一调用契约
- 聚合工具 schema 包装为 `{ serverName, toolName, toolArgs, requestOptions }` 结构
- 导出: `getOrBuildGatewayToolMap/List`, `rebuildFromScratch`, `addToCache`, `removeFromCache`
- 事件驱动更新: `TOOLS_UPDATED`/`SERVER_DISCONNECTED` → 全量重建, `AGGREGATED_TOOLS_CHANGED` → 增量更新

**System Tools Handler (`system-tools-handler.ts`)**:

- 注册和管理 MCP 系统工具
- 提供服务器发现、工具搜索等核心功能

## 依赖关系

- **内部依赖**:
  - `@services/mcp-connection-manager.ts` - MCP 连接管理
  - `@services/hub-manager.service.ts` - 服务器管理
  - `@services/system-tool-handler.ts` - 系统工具处理
  - `@utils/` - 工具函数和日志

- **外部依赖**:
  - `@modelcontextprotocol/sdk` - MCP 协议 SDK
  - `fastify` - HTTP 服务器框架

## 数据模型

### GatewayTool

```typescript
interface GatewayTool {
  name: string; // 前缀化工具名称 (serverName_serverIndex_toolName)
  description?: string; // 工具描述
  inputSchema?: any; // 输入参数 Schema
}
```

### ToolMapEntry

```typescript
interface ToolMapEntry {
  serverName: string; // 目标服务器名称
  serverIndex: number; // 服务器实例索引
  realToolName: string; // 实际工具名称
}
```

## 测试与质量

### 单元测试

- **测试覆盖**: 请求处理器、工具路由、错误处理
- **测试文件**: `tests/unit/services/gateway/`

### 集成测试

- **测试覆盖**: MCP 协议兼容性、多客户端并发、状态隔离
- **测试文件**: `tests/integration/gateway/`

## 相关文件清单

| 文件路径                                   | 描述                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `gateway.service.ts`                       | Gateway 服务主类                                                                                               |
| `global-transport.ts`                      | Transport 工具函数（setupTransportLogging + createPerRequestTransport 双模式）                                 |
| `session-manager.ts`                       | 会话管理器（状态管理、通知广播、SSE 跟踪、PING 存活探测、陈旧清理，超时参考 `security.idleConnectionTimeout`） |
| `request-handlers/initialize-handler.ts`   | Initialize 请求处理器                                                                                          |
| `request-handlers/resources-handler.ts`    | 资源请求处理器（含 templates/list 空列表）                                                                     |
| `request-handlers/call-tool-handler.ts`    | 工具调用处理器                                                                                                 |
| `request-handlers/system-tools-handler.ts` | 系统工具处理器                                                                                                 |
| `tool-list-generator.ts`                   | 工具列表生成器                                                                                                 |
| `log-formatter.ts`                         | 日志格式化工具                                                                                                 |
| `types.ts`                                 | 类型定义                                                                                                       |

## MCP Notification Push (v1.3.1+)

网关支持向 MCP 客户端推送 `notifications/resources/list_changed` 和 `notifications/tools/list_changed` 通知信号（纯信号不含数据，客户端收到后自行重新请求完整列表）。

### 架构变更

- **Stateful Session Transport**: 采用 SDK 标准的 stateful 模式。每个客户端会话拥有独立的 `StreamableHTTPServerTransport` + `McpServer` 对，通过 `mcp-session-id` header 标识。SDK 负责会话 ID 生成、SSE 流建立和通知格式化。
- **SessionManager**: 管理所有活跃会话（`Map<sessionId, SessionState>`），支持会话查找、广播通知（3s debounce 去重）、SSE 活跃引用计数、SDK PING 存活探测（30s 冷却）、服务关闭。
- **`all('/mcp')`**: Fastify 统一路由。无 `mcp-session-id` 的 POST 创建新会话；有 sessionId 的 POST/GET/DELETE 路由到已有会话 transport。GET 请求自动追踪 `activeSseCount`。

### 通知触发条件

网关聚合资源分两类（见 `resource-generator.ts`）：

- **Category 1** `hub://servers/{name}` — 服务器元数据，按 ServerName 唯一
- **Category 2** `hub://servers/{name}/{idx}/{mcpPath}` — 实例级 MCP 资源转发，每实例唯一路径

工具按 ServerName 聚合（同 ServerName 多实例工具去重），实例数在 0↔1 边界之外的变化不改变工具列表。

事件映射详见 `gateway.service.ts` 中 `initNotifications()` 方法。
