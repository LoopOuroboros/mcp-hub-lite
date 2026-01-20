[根目录](../../CLAUDE.md) > [tests](../) > **unit**

# Unit Tests 模块

## 模块职责

Unit Tests 模块包含单元测试，用于测试代码中的最小可测试单元（函数、类、模块）。

## 目录结构

```
unit/
├── services/              # 服务层单元测试
│   ├── hub-manager.test.ts
│   ├── hub-tools.service.test.ts
│   └── search/            # 搜索服务单元测试
│       ├── search-cache.test.ts
│       ├── search-core.service.test.ts
│       └── search-scorer.test.ts
└── utils/                 # 工具层单元测试
    └── config.test.ts
```

## 测试文件

### Hub Manager Test (`services/hub-manager.test.ts`)

**被测模块**: `src/services/hub-manager.service.ts`

**测试覆盖**:
- 服务器 CRUD 操作
- 错误处理
- 边界条件

**运行**:
```bash
npx vitest tests/unit/services/hub-manager.test.ts
```

### Hub Tools Service Test (`services/hub-tools.service.test.ts`)

**被测模块**: `src/services/hub-tools.service.ts`

**测试覆盖**:
- 系统工具列表获取
- 服务器列表和查找
- 工具列表和查找
- 工具调用

**运行**:
```bash
npx vitest tests/unit/services/hub-tools.service.test.ts
```

### Search Cache Test (`services/search/search-cache.test.ts`)

**被测模块**: `src/services/search/search-cache.ts`

**测试覆盖**:
- 缓存存储和检索
- 缓存过期
- 缓存清除

**运行**:
```bash
npx vitest tests/unit/services/search/search-cache.test.ts
```

### Search Core Service Test (`services/search/search-core.service.test.ts`)

**被测模块**: `src/services/search/search-core.service.ts`

**测试覆盖**:
- 模糊搜索功能
- 过滤器应用
- 分页处理

**运行**:
```bash
npx vitest tests/unit/services/search/search-core.service.test.ts
```

### Search Scorer Test (`services/search/search-scorer.test.ts`)

**被测模块**: `src/services/search/search-scorer.ts`

**测试覆盖**:
- 工具名称匹配评分
- 工具描述匹配评分
- 标签匹配评分

**运行**:
```bash
npx vitest tests/unit/services/search/search-scorer.test.ts
```

### Config Test (`utils/config.test.ts`)

**被测模块**: `src/config/config-manager.ts`

**测试覆盖**:
- 配置加载和解析
- Schema 验证
- 环境变量覆盖
- 配置更新操作

**运行**:
```bash
npx vitest tests/unit/utils/config.test.ts
```

## 测试框架

- **Vitest**: 单元测试框架
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
unit/
├── services/
│   ├── hub-manager.test.ts
│   │   └── tests: src/services/hub-manager.service.ts
│   ├── hub-tools.service.test.ts
│   │   └── tests: src/services/hub-tools.service.ts
│   └── search/
│       ├── search-cache.test.ts
│       │   └── tests: src/services/search/search-cache.ts
│       ├── search-core.service.test.ts
│       │   └── tests: src/services/search/search-core.service.ts
│       └── search-scorer.test.ts
│           └── tests: src/services/search/search-scorer.ts
└── utils/
    └── config.test.ts
        └── tests: src/config/config-manager.ts
```

## 测试覆盖目标

| 模块 | 目标覆盖率 | 当前状态 |
|-------|-----------|---------|
| `services/hub-manager` | 80% | 部分实现 |
| `services/hub-tools` | 80% | 部分实现 |
| `services/search/*` | 80% | 已实现 |
| `utils/config` | 80% | 已实现 |
| `models/*` | 80% | 待实现 |
| `api/*` | 70% | 待实现 |
| `cli/*` | 70.0% | 待实现 |
| `pid/*` | 70% | 待实现 |
| `utils/logger` | 70% | 待实现 |
| `utils/port-checker` | 70% | 待实现 |

## 常见问题 (FAQ)

### Q: 如何运行所有单元测试？

A: `npx vitest tests/unit/`

### Q: 如何生成覆盖率报告？

A: `npx vitest --coverage tests/unit/`

### Q: 如何运行特定测试文件？

A: `npx vitest <文件路径>`

### Q: 如何调试失败的测试？

A: 添加 `.only` 到测试函数，或使用 `--inspect` 参数运行测试。

## 相关文件清单

| 文件路径 | 描述 |
|---------|------|
| `unit/services/hub-manager.test.ts` | Hub Manager 服务测试 |
| `unit/services/hub-tools.service.test.ts` | Hub Tools 服务测试 |
| `unit/services/search/search-cache.test.ts` | 搜索缓存测试 |
| `unit/services/search/search-core.service.test.ts` | 搜索核心服务测试 |
| `unit/services/search/search-scorer.test.ts` | 搜索评分器测试 |
| `unit/utils/config.test.ts` | 配置管理器测试 |

## 变更记录 (Changelog)

### 2026-01-20
- 更新 Unit Tests 模块文档
- 添加搜索服务测试文档

### 2026-01-19
- 初始化 Unit Tests 模块文档
