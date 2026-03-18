[根目录](../../CLAUDE.md) > [src](../) > **pid**

# PID 模块

## 模块职责

PID 模块负责进程 ID 管理和文件操作，用于跟踪 MCP Hub Lite 服务的运行状态。

## 目录结构

```
pid/
├── types.ts    # PID 相关类型定义
├── manager.ts  # PID 管理器主类
└── file.ts     # PID 文件操作工具
```

## 核心文件

### Types (`types.ts`)

**职责**: 定义 PID 模块相关的类型

**主要类型**:

- `PidInfo` - PID 信息接口
- `PidFileOptions` - PID 文件选项

### Manager (`manager.ts`)

**职责**: PID 管理器，提供高级 PID 操作接口

**主要方法**:

- `getPid()` - 获取当前 PID
- `isRunning()` - 检查进程是否正在运行
- `writePid(pid)` - 写入 PID 到文件
- `removePid()` - 删除 PID 文件
- `pidFileExists()` - 检查 PID 文件是否存在

**依赖**:

- `file.ts` - 底层文件操作

### File (`file.ts`)

**职责**: PID 文件的底层读写操作

**主要功能**:

- PID 文件路径管理
- 文件读写操作
- 文件权限处理

## 依赖关系

```
pid/
├── manager.ts
│   └── depends on: ./file.ts
├── types.ts
└── file.ts
```

## 入口与启动

PID 模块主要被以下模块使用：

- `src/index.ts` - CLI 入口，用于服务器状态管理
- `src/server/runner.ts` - 服务器启动器，用于写入 PID 文件

## 测试与质量

PID 模块目前没有专门的单元测试，主要通过集成测试验证其功能。

**相关测试**:

- `tests/server.test.ts` - 服务器测试中包含 PID 相关验证

## 常见问题 (FAQ)

### Q: PID 文件存储在哪里？

A: PID 文件默认存储在项目根目录下，文件名为 `.mcp-hub.pid`。

### Q: 如何处理僵尸 PID 文件？

A: 当检测到 PID 文件存在但进程不存在时，系统会自动清理僵尸 PID 文件。

## 相关文件清单

| 文件路径         | 描述         |
| ---------------- | ------------ |
| `pid/types.ts`   | PID 类型定义 |
| `pid/manager.ts` | PID 管理器   |
| `pid/file.ts`    | PID 文件操作 |
