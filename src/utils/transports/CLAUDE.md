[根目录](../../../CLAUDE.md) > [src](../../) > [utils](../) > **transports**

# Transports 子模块

## 模块职责

Transports 子模块负责实现 MCP (Model Context Protocol) 协议的各种传输协议，提供统一的接口用于与不同类型的 MCP 服务器通信。该模块支持标准输入输出、Server-Sent Events 和 HTTP 流传输等多种通信方式。

## 目录结构

```
transports/
├── transport.interface.ts        # 传输协议配置接口定义
├── transport-factory.ts         # 传输工厂（根据配置创建对应传输实例）
├── stdio-transport.ts           # Stdio 传输实现（含 LineBuffer）
├── sse-transport.ts             # SSE 传输实现（支持 serverId/serverName）
└── streamable-http-transport.ts # HTTP 流传输实现（支持 serverId/serverName）
```

## 核心组件

### Transport Interface (`transport.interface.ts`)

**职责**: 定义传输协议的配置接口

**主要接口**:

- `StdioTransportConfig` - STDIO 传输配置
- `SseTransportConfig` - SSE 传输配置
- `StreamableHttpTransportConfig` - Streamable HTTP 传输配置
- `ServerTransportConfig` - 通用服务器传输配置（联合类型）

### Transport Factory (`transport-factory.ts`)

**职责**: 根据服务器配置创建对应的 Transport 实例

**主要功能**:

- **自动传输类型识别**: 根据服务器配置的 `type` 字段自动选择合适的传输协议
- **配置验证和转换**: 验证配置完整性并转换为传输层所需的格式
- **Python 环境优化**: 自动为 Python 相关命令设置 `PYTHONUTF8=1` 环境变量
- **复合键支持**: 支持 `serverName-serverIndex` 复合键用于日志存储集成
- **向后兼容**: 支持 `http` 类型自动转换为 `streamable-http`
- **OAuth Provider 创建**: 对 Streamable HTTP 传输自动创建 `McpOAuthClientProvider`（支持 `options.authProvider` 复用）
- **回调服务器端口**: 使用随机可用端口（`callbackPort: 0`），动态分配

**支持的传输类型**:

- `stdio` - 标准 I/O 传输（本地进程）
- `sse` - Server-Sent Events 传输（单向远程通信）
- `streamable-http` - HTTP 流传输（双向远程通信）
- `http` - HTTP 传输（兼容模式，自动转为 streamable-http）

**serverId/serverName 传递**:

- 所有传输创建时都会传递 serverName 和可选的 compositeKey
- StdioTransport 同时传递 logStorage 选项用于日志集成

### Stdio Transport (`stdio-transport.ts`)

**职责**: 自定义标准输入输出传输实现

**适用场景**: 本地进程 MCP 服务器

**关键特性**:

- **官方 SDK 封装**: 基于官方 MCP SDK 的 `StdioClientTransport` 进行封装
- **跨平台兼容性**: 支持 Windows 批处理文件（npx/npm/pnpm/yarn/uvx）
- **独立 stderr 处理**: 使用 PassThrough 流独立处理 stderr 输出
- **日志集成**: 自动将 stderr 输出记录到日志系统
- **复合键支持**: 支持 `serverName-serverIndex` 复合键用于精确的日志标识
- **进程生命周期管理**: 正确处理进程启动、通信和优雅关闭

**内部成员**:

- `_transport` - 底层 MCP SDK 传输实例
- `_serverName` - 服务器名称（用于日志）
- `_compositeKey` - 复合键（serverName-serverIndex，用于精确标识）
- `_logStorage` - 日志存储服务集成
- `_stderrStream` - stderr 数据流

### SSE Transport (`sse-transport.ts` → SDK `SSEClientTransport`)

**职责**: Server-Sent Events 传输实现（双向通信）

**适用场景**: 远程 SSE MCP 服务器

**关键特性**:

- **SDK 官方实现**: 使用 `@modelcontextprotocol/sdk/client/sse.js` 的 `SSEClientTransport`
- **双向通信**: SSE GET 接收服务器推送 + HTTP POST 发送客户端请求
- **自动端点发现**: 从 SSE `endpoint` 事件自动获取 POST URL
- **OAuth 支持**: 通过 `authProvider` 支持认证流程
- **代理支持**: 通过自定义 `fetch` + ProxyAgent 支持代理连接

**实现说明**:

- `TransportFactory` 中 `case 'sse'` 分支直接实例化 SDK `SSEClientTransport`
- 自研 `SseTransport` 类保留在 `sse-transport.ts` 但不再被工厂引用
- headers 同时设置到 `requestInit`（POST）和 `eventSourceInit`（SSE GET）

### Streamable HTTP Transport (`streamable-http-transport.ts`)

**职责**: HTTP 流传输实现

**适用场景**: 支持流式响应的 HTTP MCP 服务器（双向通信）

**关键特性**:

- **双向通信**: 支持完整的双向 MCP 协议通信
- **HTTP POST + SSE**: 使用 HTTP POST 发送请求，SSE 接收流式响应
- **超时控制**: 可配置的请求超时机制
- **自定义 HTTP 头**: 支持认证、授权等自定义 HTTP 头
- **代理支持**: 支持通过代理服务器连接
- **复合键支持**: 支持 serverName 和 compositeKey 用于日志上下文
- **错误详细日志**: 提供详细的错误信息和调试日志
- **OAuth 认证支持**: 自动创建 OAuth Provider（RFC 9728），支持浏览器弹窗认证流程
- **authProvider 传递**: 构造函数接受可选 `authProvider` 参数，传递给 SDK 的 `StreamableHTTPClientTransport`

**协议细节**:

- **出站消息**: 通过 HTTP POST 请求发送 JSON-RPC 2.0 格式负载
- **入站消息**: 通过 HTTP GET 请求使用 Server-Sent Events (SSE) 接收流式响应
- **内容类型**: 自动设置 `Content-Type: application/json`

## 依赖关系

```
transports/
├── transport.interface.ts        # 无依赖
├── transport-factory.ts         # 依赖所有具体传输实现
├── stdio-transport.ts           # 依赖 @modelcontextprotocol/sdk
├── sse-transport.ts             # 依赖 @modelcontextprotocol/sdk, eventsource
└── streamable-http-transport.ts # 依赖 @modelcontextprotocol/sdk, undici
```

## 集成方式

Transports 子模块主要被以下组件使用：

- **McpConnectionManager (`mcp-connection-manager.ts`)**: 连接管理器使用传输工厂创建传输实例
- **HubManagerService (`hub-manager.service.ts`)**: 服务器管理器间接使用传输层进行服务器连接

## 测试与质量

### 单元测试

**状态**: 部分实现

**建议测试**:

- 传输工厂的配置验证和转换
- Stdio 传输的跨平台兼容性
- SSE 传输的自动重连逻辑
- HTTP 传输的超时和错误处理

## 相关文件清单

| 文件路径                                  | 描述             |
| ----------------------------------------- | ---------------- |
| `transports/transport.interface.ts`       | 传输协议配置接口 |
| `transports/transport-factory.ts`         | 传输工厂         |
| `transports/stdio-transport.ts`           | Stdio 传输实现   |
| `transports/sse-transport.ts`             | SSE 传输实现     |
| `transports/streamable-http-transport.ts` | HTTP 流传输实现  |
