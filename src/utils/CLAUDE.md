[根目录](../../CLAUDE.md) > [src](../) > **utils**

# Utils 模块

## 模块职责

Utils 模块包含通用工具函数和实用程序，是应用的基础工具层。

## 目录结构

```
utils/
├── logger/                  # 日志模块（重构后）
│   ├── index.ts             # 统一导出
│   ├── logger.ts            # 主日志器
│   ├── dev-logger.ts        # 开发模式日志
│   ├── log-formatter.ts     # 日志格式化
│   ├── log-output.ts        # 日志输出处理
│   ├── log-colors.ts        # 日志颜色
│   ├── log-context.ts       # 日志上下文
│   └── log-modules.ts       # 日志模块定义
├── transports/              # 传输协议实现
│   ├── transport.interface.ts   # 传输接口
│   ├── transport-factory.ts   # 传输工厂
│   ├── stdio-transport.ts   # Stdio 传输
│   ├── sse-transport.ts       # SSE 传输
│   └── streamable-http-transport.ts  # HTTP 流传输
├── index.ts                 # 统一导出
├── logger.ts                # 旧日志器（兼容用）
├── log-rotator.ts           # 日志轮转
├── json-utils.ts            # JSON 工具函数
├── format-utils.ts          # 格式化工具
├── port-checker.ts          # 端口检查
├── mcp-error-handler.ts     # MCP 错误处理
├── error-handler.ts         # 错误处理
├── request-context.ts       # 请求上下文
└── tool-args-parser.ts      # 工具参数解析器
```

## 核心工具

### Logger 模块 (`logger/`)

**职责**: 结构化日志输出，模块化的日志系统

**模块组成**:

- `index.ts` - 统一导出
- `logger.ts` - 主日志器实现
- `dev-logger.ts` - 开发模式日志配置
- `log-formatter.ts` - 日志格式化（包含调用者信息提取）
- `log-output.ts` - 日志输出处理（MCP 消息格式化）
- `log-colors.ts` - 日志颜色配置
- `log-context.ts` - 日志上下文
- `log-modules.ts` - 日志模块定义（PascalCase）

**日志级别**:

- `debug` - 调试信息
- `info` - 一般信息
- `warn` - 警告信息
- `error` - 错误信息

**环境变量控制**:

- `LOG_LEVEL` - 日志级别覆盖
- `SESSION_DEBUG` - 会话调试日志
- `MCP_COMM_DEBUG` - MCP 通信调试日志
- `DEV_LOG_FILE` - 开发日志文件输出
- `LOG_JSON_PRETTY` - JSON 输出美化

**使用示例**:

```typescript
import { logger } from './utils/logger/index.js';

logger.info('Server started', { port: 7788 });
logger.error('Connection failed', { error: err.message });
logger.debug('Tool called', { toolName, args }, LOG_MODULES.GATEWAY);
```

### LogRotator (`log-rotator.ts`)

**职责**: 日志文件轮转管理，支持时间戳命名格式

**主要方法**:

- `rotateLogs()` - 执行日志轮转
- `getCurrentLogFilePath()` - 获取当前日志文件路径（向后兼容）
- `createNewLogFilePath()` - 创建新的日志文件路径（时间戳格式）
- `getLatestLogFilePath()` - 获取最新的日志文件
- `extractDateFromFilename()` - 从文件名提取日期（支持新旧格式）

**日志文件命名**:

- 新格式: `{name}.YYYYMMDD_HHmmSSZZZ.log`（时间戳格式）
- 旧格式: `{name}.YYYY-MM-DD.log`（仍支持读取）

**配置参数**:

- `logDir` - 日志目录
- `logPrefix` - 日志文件前缀
- `maxAge` - 最大保留时间（如 "7d"）

### JsonUtils (`json-utils.ts`)

**职责**: JSON 工具函数，配置获取器模式

**主要方法**:

- `isDevModeEnabled()` - 检查开发模式
- `getJsonPrettySetting()` - 获取 JSON 美化设置
- `getMcpCommDebugSetting()` - 获取 MCP 通信调试设置
- `getSessionDebugSetting()` - 获取会话调试设置
- `safeJsonStringify()` - 安全 JSON 序列化
- `prettifyJson()` - JSON 美化，支持换行处理

### FormatUtils (`format-utils.ts`)

**职责**: 格式化工具函数

**主要方法**:

- 格式化服务器状态
- 格式化时间戳
- 格式化大小

### RequestContext (`request-context.ts`)

**职责**: 请求上下文处理

**主要方法**:

- 提取和管理请求上下文
- 会话 ID 提取和生成

### ErrorHandler (`error-handler.ts`)

**职责**: 通用错误处理

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
├── logger/                # 日志模块
│   ├── index.ts          # 无依赖
│   ├── logger.ts         # 无依赖
│   ├── dev-logger.ts     # 依赖 logger.ts
│   ├── log-formatter.ts  # 无依赖
│   ├── log-output.ts     # 无依赖
│   ├── log-colors.ts     # 无依赖
│   ├── log-context.ts    # 无依赖
│   └── log-modules.ts    # 无依赖
├── json-utils.ts         # 无依赖
├── format-utils.ts       # 无依赖
├── log-rotator.ts        # 无依赖
├── port-checker.ts        # 无依赖
├── mcp-error-handler.ts    # 无依赖
├── error-handler.ts       # 无依赖
├── request-context.ts     # 无依赖
├── tool-args-parser.ts    # 无依赖
└── transports/
    ├── transport.interface.ts      # 无依赖
    ├── transport-factory.ts      # 依赖其他 transport
    ├── stdio-transport.ts      # 依赖 @modelcontextprotocol/sdk
    ├── sse-transport.ts        # 依赖 transport.interface.ts
    └── streamable-http-transport.ts  # 依赖 transport.interface.ts
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

| 文件路径                                        | 描述             |
| ----------------------------------------------- | ---------------- |
| `utils/index.ts`                                | 统一导出         |
| `utils/logger/`                                 | 日志模块目录     |
| `utils/logger/index.ts`                         | 日志模块导出     |
| `utils/logger/logger.ts`                        | 主日志器         |
| `utils/logger/dev-logger.ts`                    | 开发模式日志     |
| `utils/logger/log-formatter.ts`                 | 日志格式化       |
| `utils/logger/log-output.ts`                    | 日志输出处理     |
| `utils/logger/log-colors.ts`                    | 日志颜色         |
| `utils/logger/log-context.ts`                   | 日志上下文       |
| `utils/logger/log-modules.ts`                   | 日志模块定义     |
| `utils/json-utils.ts`                           | JSON 工具        |
| `utils/format-utils.ts`                         | 格式化工具       |
| `utils/logger.ts`                               | 旧日志器（兼容） |
| `utils/log-rotator.ts`                          | 日志轮转         |
| `utils/port-checker.ts`                         | 端口检查         |
| `utils/mcp-error-handler.ts`                    | MCP 错误处理     |
| `utils/error-handler.ts`                        | 错误处理         |
| `utils/request-context.ts`                      | 请求上下文       |
| `utils/tool-args-parser.ts`                     | 工具参数解析     |
| `utils/transports/stdio-transport.ts`           | Stdio 传输       |
| `utils/transports/transport.interface.ts`       | 传输接口         |
| `utils/transports/transport-factory.ts`         | 传输工厂         |
| `utils/transports/sse-transport.ts`             | SSE 传输         |
| `utils/transports/streamable-http-transport.ts` | HTTP 流传输      |
