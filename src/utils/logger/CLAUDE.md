[根目录](../../../../CLAUDE.md) > [src](../../) > [utils](../) > **logger**

# Logger 子模块

## 模块职责

Logger 子模块提供结构化的日志输出和模块化的日志系统，是应用的基础日志层。该模块包含主日志器、开发模式日志、日志格式化、日志输出处理等功能。

## 目录结构

```
logger/
├── index.ts             # 统一导出
├── logger.ts            # 主日志器（含 serverLog 方法）
├── dev-logger.ts        # 开发模式日志
├── log-formatter.ts     # 日志格式化（增强错误处理）
├── log-output.ts        # 日志输出处理（MCP 消息格式化）
├── log-colors.ts        # 日志颜色配置
├── log-context.ts       # 日志上下文
└── log-modules.ts       # 日志模块定义（独立文件）
```

## 核心组件

### Index (`index.ts`)

**职责**: 统一导出所有日志功能

**导出内容**:

- `logger` - 主日志器实例
- `LOG_MODULES` - 日志模块常量
- 所有日志相关类型和工具函数

### Logger (`logger.ts`)

**职责**: 主日志器实现，提供基础的日志记录功能

**主要方法**:

- `info(message, context?, module?)` - 信息级别日志
- `debug(message, context?, module?)` - 调试级别日志
- `warn(message, context?, module?)` - 警告级别日志
- `error(message, context?, module?)` - 错误级别日志
- `serverLog(level, serverName, message, context?)` - 专门用于 MCP Server 日志记录

**serverLog 方法特性**:

- 自动分割包含换行符的消息，将每行作为单独的日志条目
- 支持 `\n` 和 `\r\n` 换行符
- 自动跳过空行
- serverName 参数用于标识日志来源
- 可选择附加上下文信息（pid、module、traceId、spanId 等）

### Dev Logger (`dev-logger.ts`)

**职责**: 开发模式日志配置

**主要功能**:

- 配置开发环境下的日志行为
- 启用详细的调试日志
- 配置日志输出目标（控制台、文件等）

### Log Formatter (`log-formatter.ts`)

**职责**: 日志格式化，包含调用者信息提取和错误处理增强

**增强的错误格式化**:

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

### Log Output (`log-output.ts`)

**职责**: 日志输出处理，特别是 MCP 消息格式化

**主要功能**:

- 将日志消息格式化为 MCP 协议兼容的格式
- 处理 MCP 通知和消息的日志记录
- 支持 JSON 格式美化输出

### Log Colors (`log-colors.ts`)

**职责**: 日志颜色配置

**主要功能**:

- 定义不同日志级别的颜色方案
- 支持彩色和纯文本输出模式
- 提供跨平台的颜色兼容性

### Log Context (`log-context.ts`)

**职责**: 日志上下文管理

**主要功能**:

- 管理日志上下文信息（traceId、spanId、sessionId 等）
- 提供上下文传递和继承机制
- 支持异步上下文存储

### Log Modules (`log-modules.ts`)

**职责**: 日志模块定义（独立文件，更好的代码组织）

**目的**:

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

## 环境变量控制

- `LOG_LEVEL` - 日志级别覆盖
- `SESSION_DEBUG` - 会话调试日志
- `MCP_COMM_DEBUG` - MCP 通信调试日志
- `DEV_LOG_FILE` - 开发日志文件输出
- `LOG_JSON_PRETTY` - JSON 输出美化
- `LOG_CALLER` - 控制调用者信息显示

## 使用示例

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

## 依赖关系

```
logger/
├── index.ts          # 无依赖
├── logger.ts         # 无依赖
├── dev-logger.ts     # 依赖 logger.ts
├── log-formatter.ts  # 无依赖
├── log-output.ts     # 无依赖
├── log-colors.ts     # 无依赖
├── log-context.ts    # 无依赖
└── log-modules.ts    # 无依赖
```

## 测试与质量

### 单元测试

**状态**: 部分实现

**建议测试**:

- logger 功能测试
- serverLog 方法测试
- 日志格式化测试
- 环境变量覆盖测试

## 常见问题 (FAQ)

### Q: 如何添加自定义日志模块？

A: 使用 `LOG_MODULES.dynamic('my-module-name')` 创建动态模块，或在 `log-modules.ts` 中添加新的模块常量。

### Q: 如何控制日志级别？

A: 通过环境变量 `LOG_LEVEL` 或在配置文件中设置 `system.logging.level` 字段。

### Q: serverLog 和普通日志方法有什么区别？

A: `serverLog` 专门用于 MCP 服务器日志，支持多行消息自动分割、serverName 标识和特定的上下文处理。

## 相关文件清单

| 文件路径                  | 描述                          |
| ------------------------- | ----------------------------- |
| `logger/index.ts`         | 统一导出                      |
| `logger/logger.ts`        | 主日志器（含 serverLog 方法） |
| `logger/dev-logger.ts`    | 开发模式日志                  |
| `logger/log-formatter.ts` | 日志格式化（增强错误处理）    |
| `logger/log-output.ts`    | 日志输出处理                  |
| `logger/log-colors.ts`    | 日志颜色                      |
| `logger/log-context.ts`   | 日志上下文                    |
| `logger/log-modules.ts`   | 日志模块定义（独立文件）      |
