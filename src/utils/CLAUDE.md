[根目录](../../CLAUDE.md) > [src](../) > **utils**

# Utils 模块

## 模块职责

Utils 模块包含通用工具函数和实用程序，是应用的基础工具层。

## 目录结构

```
utils/
├── logger.ts                  # 日志工具
├── log-rotator.ts            # 日志轮转
├── port-checker.ts            # 端口检查
├── mcp-error-handler.ts       # MCP 错误处理
├── custom-stdio-transport.ts   # 自定义 Stdio 传输
├── transports/               # 传输协议实现
│   ├── transport.interface.ts   # 传输接口
│   ├── transport-factory.ts   # 传输工厂
│   ├── sse-transport.ts       # SSE 传输
│   └── streamable-http-transport.ts  # HTTP 流传输
```

## 核心工具

### Logger (`logger.ts`)

**职责**: 结构化日志输出

**日志级别**:

- `debug` - 调试信息
- `info` - 一般信息
- `warn` - 警告信息
- `error` - 错误信息

**使用示例**:

```typescript
import { logger } from './utils/logger.js';

logger.info('Server started', { port: 7788 });
logger.error('Connection failed', { error: err.message });
logger.debug('Tool called', { toolName, args });
```

### LogRotator (`log-rotator.ts`)

**职责**: 日志文件轮转管理

**主要方法**:

- `rotateLogs()` - 执行日志轮转
- `getCurrentLogFilePath()` - 获取当前日志文件路径

**配置参数**:

- `logDir` - 日志目录
- `logPrefix` - 日志文件前缀
- `maxAge` - 最大保留时间（如 "7d"）

### PortChecker (`port-checker.ts`)

**职责**: 端口可用性检查

**主要方法**:

- `isPortAvailable(port, host)` - 检查端口是否可用
- `findAvailablePort(startPort, host)` - 查找可用端口

### McpErrorHandler (`mcp-error-handler.ts`)

**职责**: MCP 错误处理和转换

**主要方法**:

- `toMCPError(error)` - 将内部错误转换为 MCP 标准错误
- `mapErrorCode(code)` - 映射错误码到 MCP 标准格式

## 传输协议

### Transport Interface (`transports/transport.interface.ts`)

**基础接口**:

```typescript
export interface McpTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendRequest(method: string, params?: any): Promise<any>;
  onEvent(event: string, handler: (data: any) => void): void;
  isConnected(): boolean;
}
```

### SSE Transport (`transports/sse-transport.ts`)

**职责**: Server-Sent Events 传输实现

**适用场景**: 远程 HTTP MCP 服务器

### Streamable HTTP Transport (`transports/streamable-http-transport.ts`)

**职责**: HTTP 流传输实现

**适用场景**: 支持流式响应的 HTTP MCP 服务器

### Stdio Transport (`transports/stdio-transport.ts`)

**职责**: 自定义标准输入输出传输

**适用场景**: 本地进程 MCP 服务器

### Transport Factory (`transports/transport-factory.ts`)

**职责**: 根据配置创建对应的 Transport 实例

**支持的传输类型**:

- `stdio` - 标准 I/O 传输
- `sse` - SSE 传输
- `streamable-http` - HTTP 流传输

## 依赖关系

```
utils/
├── logger.ts              # 无依赖
├── log-rotator.ts        # 无依赖
├── port-checker.ts        # 无依赖
├── mcp-error-handler.ts    # 无依赖
└── transports/
    ├── transport.interface.ts      # 无依赖
    ├── transport-factory.ts      # 依赖其他 transport
    ├── sse-transport.ts        # 依赖 transport.interface.ts
    ├── streamable-http-transport.ts  # 依赖 transport.interface.ts
    └── stdio-transport.ts
        └── depends on: @modelcontextprotocol/sdk
```

## 测试与质量

### 单元测试

**状态**: 部分实现

**建议测试**:

- logger 功能测试
- port-checker 功能测试
- transport 功能测试

## 常见问题 (FAQ)

### Q: 如何添加自定义传输协议？

A: 实现 `McpTransport` 接口，然后在 `transport-factory.ts` 中注册。

### Q: 日志轮转如何配置？

A: 在配置文件中设置 `logging.rotation` 相关参数，或使用环境变量覆盖。

## 相关文件清单

| 文件路径                                        | 描述              |
| ----------------------------------------------- | ----------------- |
| `utils/logger.ts`                               | 日志工具          |
| `utils/log-rotator.ts`                          | 日志轮转          |
| `utils/port-checker.ts`                         | 端口检查          |
| `utils/mcp-error-handler.ts`                    | MCP 错误处理      |
| `utils/transports/stdio-transport.ts`           | 自定义 Stdio 传输 |
| `utils/transports/transport.interface.ts`       | 传输接口          |
| `utils/transports/transport-factory.ts`         | 传输工厂          |
| `utils/transports/sse-transport.ts`             | SSE 传输          |
| `utils/transports/streamable-http-transport.ts` | HTTP 流传输       |

## 变更记录 (Changelog)

### 2026-01-19

- 初始化 Utils 模块文档
