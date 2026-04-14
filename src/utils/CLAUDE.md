[根目录](../../CLAUDE.md) > [src](../) > **utils**

# Utils 模块

## 模块职责

Utils 模块包含通用工具函数和实用程序，是应用的基础工具层。

## 目录结构

```
utils/
├── logger/                  # 日志模块（重构后）
│   ├── index.ts             # 统一导出
│   ├── logger.ts            # 主日志器（含 serverLog 方法）
│   ├── dev-logger.ts        # 开发模式日志
│   ├── log-formatter.ts     # 日志格式化（增强错误处理）
│   ├── log-output.ts        # 日志输出处理
│   ├── log-colors.ts        # 日志颜色
│   ├── log-context.ts       # 日志上下文
│   └── log-modules.ts       # 日志模块定义（独立文件）
├── transports/              # 传输协议实现
│   ├── transport.interface.ts   # 传输接口
│   ├── transport-factory.ts   # 传输工厂（支持 serverId/serverName）
│   ├── stdio-transport.ts   # Stdio 传输（含 LineBuffer）
│   ├── sse-transport.ts       # SSE 传输（支持 serverId/serverName）
│   └── streamable-http-transport.ts  # HTTP 流传输（支持 serverId/serverName）
├── index.ts                 # 统一导出
├── logger.ts                # 旧日志器（兼容用）
├── log-rotator.ts           # 日志轮转
├── json-utils.ts            # JSON 工具函数
├── format-utils.ts          # 格式化工具
├── port-checker.ts          # 端口检查
├── mcp-error-handler.ts     # MCP 错误处理
├── error-handler.ts         # 错误处理
├── tool-args-parser.ts      # 工具参数解析器
├── name-converter.ts        # 名称规范化工具（工具名称格式转换，支持跨格式工具名称匹配）
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
- `log-modules.ts` - 日志模块定义（独立文件，更好的代码组织）

**log-modules.ts 独立文件说明**:

将日志模块定义提取到独立文件的目的：

- 更好的代码组织和关注点分离
- 避免 circular import 问题
- 便于模块定义的维护和扩展

**新增的日志模块**:

- `CONFIG_CHANGES` - 配置变更追踪
- `SERVER_CONFIG_MANAGER` - 服务器配置管理
- `SERVER_SELECTOR` - 服务器选择器
- `GATEWAY_SERVICE` - 网关服务
- `HUB_TOOLS` - Hub 工具
- `SYSTEM_TOOL` - 系统工具
- `TOOL_LIST` - 工具列表
- `TOOL_LIST_GENERATOR` - 工具列表生成器
- `INITIALIZE_HANDLER` - 初始化处理器
- `SYSTEM_TOOLS_HANDLER` - 系统工具处理器
- `RESOURCES_HANDLER` - 资源处理器
- `TOOLS_HANDLER` - 工具处理器
- `HTTP_TRANSPORT` - HTTP 传输
- `STDIO_TRANSPORT` - Stdio 传输
- `SSE_TRANSPORT` - SSE 传输
- `PID_MANAGER` - PID 管理器
- `SERVER_API` - 服务器 API
- `MCP_STATUS` - MCP 状态
- `NOTIFICATIONS_MESSAGE` - 通知消息
- 以及 `dynamic(moduleName)` 方法用于动态创建模块

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
- `LOG_CALLER` - 控制调用者信息显示

**serverLog() 方法**:

**方法签名**:

```typescript
serverLog(
  level: LogLevel,
  serverName: string,
  message: string,
  context?: Omit<LogContext, 'serverName'>
): void
```

**用途**: 专门用于 MCP Server 日志记录，支持多行消息处理

**主要特性**:

- 自动分割包含换行符的消息，将每行作为单独的日志条目
- 支持 `\n` 和 `\r\n` 换行符
- 自动跳过空行
- serverName 参数用于标识日志来源
- 可选择附加上下文信息（pid、module、traceId、spanId 等）

**log-formatter.ts 增强**:

**错误格式化增强**:

- 处理空数组（返回空字符串）
- 处理单元素数组（自动解包）
- 处理多元素数组（格式化并连接）
- 处理空对象（返回 `[empty object]`）
- 处理仅包含非可枚举属性的对象
- 检测并跳过日志上下文对象（包含 `module`/`traceId`/`spanId`）

**服务器标识符支持**:

- 日志格式支持 `serverName` 上下文字段
- 默认值为 `mcp-hub`
- 彩色和纯文本格式都支持

**使用示例**:

```typescript
import { logger } from './utils/logger/index.js';
import { LOG_MODULES } from './utils/logger/log-modules.js';

// 基础使用
logger.info('Server started', { port: 7788 });
logger.error('Connection failed', { error: err.message });
logger.debug('Tool called', { toolName, args }, LOG_MODULES.GATEWAY);

// 使用动态模块
logger.info('Server connected', LOG_MODULES.dynamic('my-custom-server'));

// 使用 serverLog
logger.serverLog('info', 'my-server', 'Server started successfully');
logger.serverLog('error', 'my-server', 'Error occurred', { pid: 12345 });

// 多行消息会自动分割
logger.serverLog('info', 'my-server', 'Line 1\nLine 2\nLine 3');
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

**职责**: JSON 工具函数，配置获取器模式，包含多种调试设置获取器

**ConfigGetter 类型**:

```typescript
type ConfigGetter = () => {
  system: {
    logging: {
      jsonPretty: boolean;
      mcpCommDebug: boolean;
      sessionDebug: boolean;
      apiDebug: boolean; // 新增：API 调试日志配置
    };
  };
};
```

**主要方法**:

- `isDevModeEnabled()` - 检查开发模式
- `getJsonPrettySetting()` - 获取 JSON 美化设置
- `getMcpCommDebugSetting()` - 获取 MCP 通信调试设置
- `getSessionDebugSetting()` - 获取会话调试设置
- `getApiDebugSetting()` - 获取 API 调试设置（新增）
- `safeJsonStringify()` - 安全 JSON 序列化
- `prettifyJson()` - JSON 美化，支持换行处理
- `rawHeadersToObject()` - 将 Node.js rawHeaders 数组转换为对象
- `stringifyRawHeadersForLogging()` - 格式化 rawHeaders 用于日志输出

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

### NameConverter (`name-converter.ts`)

**职责**: 工具名称规范化，支持跨格式工具名称匹配

**主要方法**:

- `normalizeToolName(toolName)` - 将各种命名约定（snake_case、kebab-case、camelCase、空格分隔或大写）转换为标准化的小写下划线格式，用于一致的匹配

**功能特性**:

- 处理 snake_case → snake_case（保持不变）
- 处理 kebab-case → snake_case（连字符转下划线）
- 处理 camelCase → snake_case（插入下划线）
- 处理大写格式 → snake_case（转小写并处理分隔符）
- 处理空格分隔 → snake_case（空格转下划线）

**使用场景**:

- 系统工具调用时的工具名称匹配
- 跨不同MCP服务器的工具名称标准化
- 用户输入的工具名称与实际工具名称的模糊匹配

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

### LineBuffer (`transports/stdio-transport.ts`)

**职责**: 处理跨多个数据块的文本行缓冲

**与 ReadBuffer 的区别**:

- **ReadBuffer**: 专门用于 JSON-RPC 消息解析
- **LineBuffer**: 用于纯文本行缓冲（如 stderr 输出）

**主要方法**:

- `append(chunk: Buffer)` - 添加数据块到缓冲区
- `readLines(): string[]` - 读取所有完整行并移除它们，不完整的行保留在缓冲区中
- `clear()` - 清空缓冲区

**功能特性**:

- 支持 `\n` 和 `\r\n` 换行符
- 自动跳过空行
- 处理跨多个数据块的行

### Stdio Transport (`transports/stdio-transport.ts`)

**职责**: 自定义标准输入输出传输

**适用场景**: 本地进程 MCP 服务器

**关键特性**:

- 使用 `LineBuffer` 处理 stderr 输出的行缓冲
- serverId/serverName 上下文支持（serverId 优先）
- 集成 LogStorageService 日志存储
- Windows 批处理文件兼容性（npx/npm/pnpm/yarn/uvx）自动处理

**内部成员**:

- `_readBuffer` - JSON-RPC 消息缓冲区（ReadBuffer）
- `_stderrLineBuffer` - stderr 文本行缓冲区（LineBuffer）
- `_serverName` - 服务器名称（用于日志）
- `_serverId` - 服务器 ID（优先用于日志）

**serverId/serverName 优先级**:

1. 如果 `serverId` 存在时使用 serverId
2. 否则使用 serverName
3. 都不存在时使用 "Unknown Server"

### SSE Transport (`transports/sse-transport.ts`)

**职责**: Server-Sent Events 传输实现

**适用场景**: 远程 HTTP MCP 服务器

**关键特性**:

- serverId/serverName 上下文支持（serverId 优先）
- 自动重连（指数退避策略）
- 自定义 HTTP 头支持

### Streamable HTTP Transport (`transports/streamable-http-transport.ts`)

**职责**: HTTP 流传输实现

**适用场景**: 支持流式响应的 HTTP MCP 服务器

**关键特性**:

- serverId/serverName 上下文支持（serverId 优先）
- 可配置的请求超时
- 自定义 HTTP 头支持

### Transport Factory (`transports/transport-factory.ts`)

**职责**: 根据配置创建对应的 Transport 实例

**支持的传输类型**:

- `stdio` - 标准 I/O 传输
- `sse` - SSE 传输
- `streamable-http` - HTTP 流传输

**serverId/serverName 传递**:

- 所有传输创建时都会传递 serverId 和 serverName
- StdioTransport 同时传递 logStorage 选项

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
├── name-converter.ts       # 无依赖
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

| 文件路径                                        | 描述                          |
| ----------------------------------------------- | ----------------------------- |
| `utils/index.ts`                                | 统一导出                      |
| `utils/logger/`                                 | 日志模块目录                  |
| `utils/logger/index.ts`                         | 日志模块导出                  |
| `utils/logger/logger.ts`                        | 主日志器（含 serverLog 方法） |
| `utils/logger/dev-logger.ts`                    | 开发模式日志                  |
| `utils/logger/log-formatter.ts`                 | 日志格式化（增强错误处理）    |
| `utils/logger/log-output.ts`                    | 日志输出处理                  |
| `utils/logger/log-colors.ts`                    | 日志颜色                      |
| `utils/logger/log-context.ts`                   | 日志上下文                    |
| `utils/logger/log-modules.ts`                   | 日志模块定义（独立文件）      |
| `utils/json-utils.ts`                           | JSON 工具                     |
| `utils/format-utils.ts`                         | 格式化工具                    |
| `utils/logger.ts`                               | 旧日志器（兼容）              |
| `utils/log-rotator.ts`                          | 日志轮转                      |
| `utils/port-checker.ts`                         | 端口检查                      |
| `utils/mcp-error-handler.ts`                    | MCP 错误处理                  |
| `utils/error-handler.ts`                        | 错误处理                      |
| `utils/request-context.ts`                      | 请求上下文                    |
| `utils/tool-args-parser.ts`                     | 工具参数解析                  |
| `utils/name-converter.ts`                       | 名称规范化工具                |
| `utils/transports/stdio-transport.ts`           | Stdio 传输（含 LineBuffer）   |
| `utils/transports/transport.interface.ts`       | 传输接口                      |
| `utils/transports/transport-factory.ts`         | 传输工厂（支持 serverId）     |
| `utils/transports/sse-transport.ts`             | SSE 传输（支持 serverId）     |
| `utils/transports/streamable-http-transport.ts` | HTTP 流传输（支持 serverId）  |
