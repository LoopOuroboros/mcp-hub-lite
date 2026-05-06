[根目录](../../CLAUDE.md) > [src](../) > **server**

# Server 模块

## 模块职责

Server 模块负责服务器运行时管理和启动逻辑，包含生产环境和开发环境的服务器启动器，以及共享的启动工具函数。

## 目录结构

```
server/
├── runner.ts       # 生产环境服务器启动器
├── dev-server.ts   # 开发环境服务器启动器（支持热重载）
└── startup.ts      # 共享启动逻辑（连接任务收集和执行）
```

## 核心文件

### Runner (`runner.ts`)

**职责**: 生产环境服务器启动和管理

**主要功能**:

- 启动 Fastify HTTP 服务器
- 端口冲突检测和错误处理
- PID 文件管理
- 触发 MCP 服务器连接任务

**依赖**:

- `app.ts` - Fastify 应用配置
- `pid/manager.ts` - PID 文件管理
- `utils/port-checker.ts` - 端口检查工具
- `startup.ts` - 共享启动逻辑

### Dev Server (`dev-server.ts`)

**职责**: 开发环境服务器启动（支持热重载）

**主要功能**:

- 开发日志输出（debug 级别）
- 开发日志文件输出
- PID 文件管理
- 触发 MCP 服务器连接任务
- **端口自动递增**：默认端口被占用时自动尝试 port+1（最多 10 次），不做硬失败退出

**依赖**:

- `app.ts` - Fastify 应用配置
- `pid/manager.ts` - PID 文件管理
- `startup.ts` - 共享启动逻辑

### Startup (`startup.ts`)

**职责**: 共享启动逻辑，提供连接任务收集和执行的公共函数

**主要功能**:

- `collectConnectTasks()` - 从配置收集所有服务器连接任务，自动创建缺失的实例
- `executeConnectTasks()` - 按顺序执行连接任务（带延迟，fire-and-forget 模式）

**ConnectTask 接口**:

```typescript
interface ConnectTask {
  serverName: string; // 服务器名称
  instanceId: string; // 实例 ID
  instanceIndex: number; // 实例索引
  connectFn: () => Promise<boolean>; // 连接函数
}
```

## 依赖关系

```
server/
├── runner.ts
│   ├── depends on: ../app.ts
│   ├── depends on: ../pid/manager.ts
│   ├── depends on: ../utils/port-checker.ts
│   └── depends on: ./startup.ts
├── dev-server.ts
│   ├── depends on: ../app.ts
│   ├── depends on: ../pid/manager.ts
│   └── depends on: ./startup.ts
└── startup.ts
    ├── depends on: ../config/config-manager.js
    ├── depends on: ../config/config-migrator.js
    ├── depends on: ../services/mcp-connection-manager.js
    └── depends on: ../utils/logger.js
```

## 入口与启动

**CLI 入口**: `src/index.ts` 调用 server 模块的启动函数

**启动命令**:

- 生产模式: `npm start` 或 `mcp-hub-lite start`
- 开发模式: `npm run dev` 或 `npm run dev:server`

**启动时序**:

1. 构建 Fastify 应用
2. 端口可用性检查（生产模式）
3. `app.listen()` 开始监听
4. 写入 PID 文件
5. 触发连接任务（首个立即执行，后续按配置延迟顺序执行）

## 测试与质量

目前 server 模块的测试覆盖较少，主要通过集成测试验证。

**相关测试**:

- `tests/integration/api/gateway.test.ts` - 网关集成测试
- `tests/server.test.ts` - 服务器基础测试

## 相关文件清单

| 文件路径               | 描述                 |
| ---------------------- | -------------------- |
| `server/runner.ts`     | 生产环境服务器启动器 |
| `server/dev-server.ts` | 开发环境服务器启动器 |
| `server/startup.ts`    | 共享启动逻辑模块     |
