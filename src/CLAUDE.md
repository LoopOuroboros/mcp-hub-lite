[根目录](../CLAUDE.md) > **src**

# Backend Core 模块

## 模块职责

Backend Core 模块包含后端源代码，实现所有服务器端逻辑，包括 MCP 网关、服务器管理、工具搜索等核心功能。

## 目录结构

```
src/
├── api/                     # API 路由和协议处理器
├── services/                # 核心业务逻辑服务
├── models/                  # 数据模型和类型定义
├── config/                  # 配置管理和验证
├── utils/                   # 工具函数和通用实现
├── cli/                     # 命令行接口和命令处理
├── pid/                     # 进程 ID 管理和文件操作
├── server/                  # 服务器运行时和启动器
├── app.ts                   # Fastify 应用配置
├── index.ts                 # CLI 入口点
└── types/                   # 全局类型定义
```

## 入口与启动

### 主入口点

- **CLI 入口**: `src/index.ts` - 处理命令行参数，使用 Commander.js
- **后端服务入口**: `src/app.ts` - Fastify 应用配置
- **服务器启动器**: `src/server/runner.ts` - 启动 Fastify 服务器和 MCP 网关

### 启动命令

```bash
# 生产模式
npm start
# 或
mcp-hub-lite start

# 开发模式（前后端热重载）
npm run dev

# 前台运行（用于调试）
mcp-hub-lite start --foreground
```

## 对外接口

### MCP 协议接口

- **路径**: `/mcp/*`
- **协议**: HTTP-Stream (通过 EventSource 实现)
- **会话管理**: 基于 sessionId 的会话隔离
- **支持的操作**:
  - `initialize` - MCP 初始化握手
  - `tools/list` - 列出所有可用工具
  - `tools/call` - 调用工具
  - `resources/list` - 列出所有资源
  - `resources/read` - 读取资源

### Web API 接口

- **服务器管理**: `/web/servers`
- **搜索**: `/web/search`
- **健康检查**: `/health`
- **MCP 状态**: `/web/mcp/status`
- **配置管理**: `/web/config`
- **日志**: `/web/servers/:id/logs`
- **系统工具**: `/web/hub-tools`
- **客户端管理**: `/web/clients`
- **资源**: `/web/resources`

### WebSocket 接口

- **事件推送**: 实时事件通知
- **服务器状态变化**: 连接/断开通知
- **工具调用结果**: 异步结果推送
- **日志更新**: 实时日志流

## 关键依赖与配置

### 内部依赖

- `src/services/` - 业务逻辑服务
- `src/models/` - 数据模型
- `src/config/` - 配置管理
- `src/utils/` - 工具函数

### 外部依赖

- **Fastify**: 高性能 HTTP 服务器框架
- **@modelcontextprotocol/sdk**: 官方 MCP 协议支持
- **Zod**: 数据验证和 Schema 定义
- **Commander**: CLI 命令行解析
- **@fastify/websocket**: WebSocket 支持
- **EventSource**: SSE (Server-Sent Events) 支持

### 配置文件

- **主配置**: `.mcp-hub.json` - 服务器配置和安全设置
- **配置查找优先级**:
  1. 环境变量 `MCP_HUB_CONFIG_PATH`
  2. `~/.mcp-hub-lite/config/.mcp-hub.json`（用户主目录下的隐藏文件夹）

## 数据模型

### 服务器配置

```typescript
interface McpServerConfig {
  id?: string;
  name: string;
  type: 'stdio' | 'sse' | 'streamable-http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  timeout?: number;
  enabled?: boolean;
}
```

### 会话状态

```typescript
interface SessionState {
  sessionId: string;
  clientName?: string;
  clientVersion?: string;
  createdAt: number;
  lastAccessedAt: number;
  metadata: Record<string, unknown>;
}
```

### 服务器状态

```typescript
interface ServerStatus {
  id: string;
  status: {
    connected: boolean;
    error?: string;
    lastCheck: number;
    toolsCount: number;
    resourcesCount: number;
    pid?: number;
    startTime?: number;
    version?: string;
  };
}
```

## 测试与质量

### 测试结构

```
tests/
├── unit/                    # 单元测试
│   ├── server/              # 服务器运行时测试
│   ├── services/            # 服务测试
│   └── utils/              # 工具测试
├── integration/             # 集成测试
│   ├── api/                # API测试
│   └── gateway/            # Gateway测试
└── contract/               # 契约测试
    └── mcp-protocol/       # MCP协议契约测试
```

### 测试覆盖

- **单元测试**: 部分实现 (15个文件)
- **集成测试**: 部分实现 (3个文件)
- **契约测试**: 完整实现 (3个文件)

### 运行测试

```bash
# 运行所有测试
npm test

# 运行后端测试
npm run test:backend

# 生成覆盖率报告
npm run test:coverage
```

## 常见问题 (FAQ)

### Q: 如何添加新的 MCP 服务器？

A: 通过 Web API 或配置文件添加：

```bash
# 通过 API
curl -X POST http://localhost:7788/web/servers \
  -H "Content-Type: application/json" \
  -d '{"name": "my-server", "type": "stdio", "command": "npx my-mcp-server"}'

# 通过配置文件
# 在 .mcp-hub.json 中添加 servers 配置
```

### Q: 会话管理如何工作？

A: 会话状态完全在内存中管理：

- 基于 sessionId 的会话隔离
- 可配置的会话超时（默认 30 分钟）
- 服务重启后会话重置（无持久化）

### Q: 如何配置传输协议？

A: 支持三种传输协议：

- **stdio**: 本地进程，通过 `command` 和 `args` 配置
- **sse**: Server-Sent Events，通过 `url` 配置
- **streamable-http**: HTTP 流传输，通过 `url` 配置

### Q: 如何启用日志轮转？

A: 在配置文件中设置日志相关参数：

```json
{
  "system": {
    "logging": {
      "level": "info",
      "rotationAge": "7d"
    }
  }
}
```

## 相关文件清单

| 文件路径               | 描述             |
| ---------------------- | ---------------- |
| `src/index.ts`         | CLI 主入口       |
| `src/app.ts`           | Fastify 应用配置 |
| `src/server/runner.ts` | 服务器启动器     |
| `src/api/`             | API 路由模块     |
| `src/services/`        | 业务逻辑服务     |
| `src/models/`          | 数据模型         |
| `src/config/`          | 配置管理         |
| `src/utils/`           | 工具函数         |
