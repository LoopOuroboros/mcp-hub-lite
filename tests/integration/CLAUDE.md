[根目录](../../CLAUDE.md) > [tests](../) > **integration**

# Integration Tests 模块

## 模块职责

Integration Tests 模块包含集成测试，用于测试多个组件之间的交互。

## 目录结构

```
integration/
├── api/                   # API 集成测试
│   └── gateway.test.ts
└── gateway/               # Gateway 集成测试
    ├── fault-tolerance.test.ts
    └── mcp-connection.test.ts
```

## 测试文件

### Gateway API Test (`api/gateway.test.ts`)

**被测模块**: `src/api/mcp/gateway.ts`

**测试覆盖**:
- MCP Gateway 初始化流程
- 工具列表获取
- 工具调用功能
- 错误处理

**运行**:
```bash
npx vitest tests/integration/api/gateway.test.ts
```

### Fault Tolerance Test (`gateway/fault-tolerance.test.ts`)

**被测模块**: `src/services/gateway.service.ts`

**测试覆盖**:
- 单个服务器故障不影响其他服务器
- 网关容错机制
- 错误恢复

**运行**:
```bash
npx vitest tests/integration/gateway/fault-tolerance.test.ts
```

### MCP Connection Test (`gateway/mcp-connection.test.ts`)

**被测模块**: `src/services/mcp-connection-manager.ts`

**测试覆盖**:
- MCP 连接建立和断开
- 多服务器并发连接
- 连接状态管理

**运行**:
```bash
npx vitest tests/integration/gateway/mcp-connection.test.ts
```

## 测试框架

- **Vitest**: 集成测试框架
- **@vitest/coverage-v8**: 代码覆盖率工具

## 测试配置

配置文件: `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      all: true
    }
  }
});
```

## 依赖关系

```
integration/
├── api/
│   └── gateway.test.ts
│       └── tests: src/api/mcp/gateway.ts
└── gateway/
    ├── fault-tolerance.test.ts
    │   └── tests: src/services/gateway.service.ts
    │
    └── mcp-connection.test.ts
        └── tests: src/services/mcp-connection-manager.ts
```

## 测试覆盖目标

| 模块 | 目标覆盖率 | 当前状态 |
|-------|-----------|---------|
| `api/` | 70% | 部分实现 |
| `services/gateway` | 75% | 部分实现 |

## 常见问题 (FAQ)

### Q: 如何运行所有集成测试？

A: `npx vitest tests/integration/`

### Q: 如何生成覆盖率报告？

A: `npx vitest --coverage tests/integration/`

### Q: 集成测试和单元测试的区别？

A: 集成测试测试多个组件之间的交互，需要模拟或使用真实的依赖组件。

### Q: 如何处理测试数据？

A: 使用 `beforeEach` 和 `afterEach` 钩子设置和清理测试环境。

## 相关文件清单

| 文件路径 | 描述 |
|---------|------|
| `integration/api/gateway.test.ts` | Gateway API 测试 |
| `integration/gateway/fault-tolerance.test.ts` | 容错测试 |
| `integration/gateway/mcp-connection.test.ts` | MCP 连接测试 |

## 变更记录 (Changelog)

### 2026-01-20
- 更新 Integration Tests 模块文档

### 2026-01-19
- 初始化 Integration Tests 模块文档
