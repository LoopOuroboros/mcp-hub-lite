[根目录](../../CLAUDE.md) > [src](../) > **server**

# Server 模块

## 模块职责

Server 模块负责服务器运行时管理和启动逻辑，包含生产环境和开发环境的服务器启动器。

## 目录结构

```
server/
├── runner.ts      # 生产环境服务器启动器
└── dev-server.ts  # 开发环境服务器启动器（支持热重载）
```

## 核心文件

### Runner (`runner.ts`)

**职责**: 生产环境服务器启动和管理

**主要功能**:

- 启动 Fastify HTTP 服务器
- 初始化 MCP 网关服务
- 处理 stdio 模式启动（MCP 协议）
- 端口冲突检测
- PID 文件管理

**依赖**:

- `app.ts` - Fastify 应用配置
- `pid/manager.ts` - PID 文件管理
- `utils/port-checker.ts` - 端口检查工具

### Dev Server (`dev-server.ts`)

**职责**: 开发环境服务器启动（支持热重载）

**主要功能**:

- 监听文件变化自动重启
- 开发日志输出
- 热重载支持

**依赖**:

- `runner.ts` - 复用生产启动逻辑
- `tsx` - TypeScript 执行器

## 依赖关系

```
server/
├── runner.ts
│   ├── depends on: ../app.ts
│   ├── depends on: ../pid/manager.ts
│   └── depends on: ../utils/port-checker.ts
└── dev-server.ts
    └── depends on: ./runner.ts
```

## 入口与启动

**CLI 入口**: `src/index.ts` 调用 server 模块的启动函数

**启动命令**:

- 生产模式: `npm start` 或 `mcp-hub-lite start`
- 开发模式: `npm run dev` 或 `npm run dev:server`

## 测试与质量

目前 server 模块的测试覆盖较少，主要通过集成测试验证。

**相关测试**:

- `tests/integration/api/gateway.test.ts` - 网关集成测试
- `tests/server.test.ts` - 服务器基础测试

## 常见问题 (FAQ)

### Q: 如何调试服务器启动问题？

A: 使用 `--foreground` 参数启动服务器，查看详细日志：

```bash
mcp-hub-lite start --foreground
```

### Q: 开发模式和生产模式有什么区别？

A:

- **开发模式**: 支持热重载，详细的开发日志，不生成 PID 文件
- **生产模式**: 生成 PID 文件，后台运行，优化的日志级别

## 相关文件清单

| 文件路径               | 描述                 |
| ---------------------- | -------------------- |
| `server/runner.ts`     | 生产环境服务器启动器 |
| `server/dev-server.ts` | 开发环境服务器启动器 |
