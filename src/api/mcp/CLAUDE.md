[根目录](../../../CLAUDE.md) > [src](../../) > [api](../) > **mcp**

# MCP API 模块

## 模块职责

MCP API 模块负责处理所有 MCP (Model Context Protocol) 协议相关的 HTTP 请求，提供 MCP Gateway 的入口点。

## 目录结构

```typescript
mcp/
├── gateway.ts                 # MCP Gateway 路由处理器（Per-Request 模式）
└── debug-response-wrapper.ts  # 调试响应包装器
```

## 核心功能

### Gateway 路由 (`gateway.ts`)

**路径**: `/mcp/*`

**协议支持**: HTTP-Stream (通过 EventSource 实现)

**架构**: **Per-Request Transport 模式**（v1.1.0+）

- 每个 HTTP 请求创建独立的 transport/server 实例
- 确保多客户端连接状态隔离
- 解决 "Failed to reconnect to mcp-hub-lite" 连接错误

**支持的操作**:

- `initialize` - MCP 初始化握手
- `tools/list` - 列出所有可用工具
- `tools/call` - 调用工具
- `resources/list` - 列出所有资源
- `resources/read` - 读取资源

### 调试响应包装器 (`debug-response-wrapper.ts`)

- 包装 HTTP 响应对象以支持调试日志记录
- 在开发模式下记录详细的请求/响应信息

## 依赖关系

- **内部依赖**:
  - `@services/gateway/global-transport.ts` - Transport 工厂函数
  - `@utils/logger/` - 日志系统
  - `@utils/json-utils.ts` - JSON 工具函数

- **外部依赖**:
  - `fastify` - HTTP 服务器框架
  - `@modelcontextprotocol/sdk` - MCP 协议 SDK

## 环境变量

| 变量名           | 描述                  |
| ---------------- | --------------------- |
| `MCP_COMM_DEBUG` | 启用 MCP 通信调试日志 |

## 相关文件清单

| 文件路径                    | 描述                   |
| --------------------------- | ---------------------- |
| `gateway.ts`                | MCP Gateway 路由处理器 |
| `debug-response-wrapper.ts` | 调试响应包装器         |
