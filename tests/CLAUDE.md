[根目录](../CLAUDE.md) > **tests**

# Tests 模块

## 模块职责

Tests 模块包含完整的测试套件，包括单元测试、集成测试和契约测试，确保代码质量和功能正确性。

## 目录结构

```
tests/
├── unit/                    # 单元测试
│   ├── server/              # 服务器运行时测试
│   ├── services/            # 服务测试
│   ├── utils/              # 工具测试
│   └── frontend/           # 前端组件和Store测试
├── integration/             # 集成测试
│   ├── api/                # API测试
│   └── gateway/            # Gateway测试
├── contract/               # 契约测试
│   └── mcp-protocol/       # MCP协议契约测试
├── setup.ts                # 测试设置
├── helpers/                # 测试辅助函数
└── types/                  # 测试类型定义
```

## 测试类型

### 单元测试 (Unit Tests)

**目标**: 测试代码中的最小可测试单元（函数、类、模块）

**覆盖范围**:
- 服务器运行时 (`server/runner.test.ts`)
- 服务层 (`services/hub-manager-service.test.ts`, `services/session-manager.test.ts`)
- 工具层 (`utils/logger.test.ts`, `utils/config.test.ts`)
- 前端组件 (`frontend/components/dashboard.test.ts`, `frontend/components/tool-card.test.ts`)

**状态**: 部分实现 (15个文件)

### 集成测试 (Integration Tests)

**目标**: 测试多个组件之间的交互

**覆盖范围**:
- API 集成 (`api/gateway.test.ts`)
- Gateway 集成 (`gateway/fault-tolerance.test.ts`, `gateway/mcp-connection.test.ts`)

**状态**: 部分实现 (3个文件)

### 契约测试 (Contract Tests)

**目标**: 验证 MCP Hub Lite 与外部 MCP 服务器之间的协议兼容性

**覆盖范围**:
- MCP 初始化协议 (`mcp-protocol/initialize.test.ts`)
- 工具列表协议 (`mcp-protocol/tools-list.test.ts`)
- 工具调用协议 (`mcp-protocol/tools-call.test.ts`)

**状态**: 完整实现 (3个文件)

## 测试框架

### 后端测试

- **Vitest**: 单元测试框架
- **@vitest/coverage-v8**: 代码覆盖率工具
- **配置文件**: `vitest.config.ts`

### 前端测试

- **Vitest**: 单元测试框架
- **@vue/test-utils**: Vue 组件测试工具
- **jsdom**: DOM 环境模拟
- **配置文件**: `vitest.frontend.config.ts`

## 运行测试

### 快速开始

```bash
# 运行所有测试（静默模式 + 生成摘要）
npm test

# 使用 Vitest 直接运行（开发模式，带颜色输出）
npx vitest

# 单独运行后端测试
npm run test:backend

# 单独运行前端测试
npm run test:frontend
```

### 静默模式

```bash
# 在静默模式下运行后端测试（输出到日志文件）
npm run test:backend:silent

# 在静默模式下运行前端测试（输出到日志文件）
npm run test:frontend:silent

# 生成测试结果摘要（读取日志文件生成摘要）
npm run test:summary
```

### 覆盖率报告

```bash
# 运行测试并生成覆盖率报告
npm run test:coverage
```

## 测试结果查看

`npm test` 采用静默模式运行，测试输出重定向到日志文件：

1. **运行完整测试**: 执行 `npm test`（静默模式）
2. **生成摘要**: 测试完成后自动生成 `logs/test-summary.log`
3. **查看结果**: 摘要包含测试文件统计、用例统计、失败详情等

**日志文件**:
- `logs/test-summary.log` - 测试摘要汇总
- `logs/test-backend.log` - 后端测试详细输出
- `logs/test-frontend.log` - 前端测试详细输出

**查看实时输出（带颜色）**:
```bash
# 开发模式带热重载
npx vitest

# 单独运行后端/前端测试
npm run test:backend
npm run test:frontend
```

## 测试覆盖

| 类型 | 状态 | 文件数 |
| ---- | ---- | ------ |
| 单元测试 | 部分实现 | 15 |
| 集成测试 | 部分实现 | 3 |
| 契约测试 | 完整实现 | 3 |

## 质量要求

### 代码修改验证流程

**每轮代码修改结束后，必须按顺序执行以下验证步骤**:

1. **编译检查**: 执行 `npm run build` 进行完整的编译和类型检查
2. **测试验证**: 执行 `npm run test` 运行所有测试（自动包含结果摘要）

查看测试结果摘要：`cat logs/test-summary.log`

### 覆盖率目标

- **单元测试**: >= 80%
- **集成测试**: >= 70%
- **契约测试**: 100%

## 常见问题 (FAQ)

### Q: 如何运行特定测试文件？

A:
```bash
# 运行特定后端测试文件
npx vitest tests/unit/services/hub-manager-service.test.ts

# 运行特定前端测试文件
npx vitest tests/unit/frontend/components/dashboard.test.ts --config vitest.frontend.config.ts
```

### Q: 如何调试失败的测试？

A: 添加 `.only` 到测试函数，或使用 `--inspect` 参数运行测试：

```typescript
// 只运行这个测试
test.only('should handle error', () => {
  // test code
});
```

### Q: 如何添加新的测试？

A:
1. 在相应的测试目录创建新的测试文件（如 `*.test.ts`）
2. 导入被测模块
3. 编写测试用例
4. 确保测试覆盖边界条件和错误情况

### Q: 前端测试需要什么特殊配置？

A: 前端测试需要使用 `vitest.frontend.config.ts` 配置文件，该文件配置了 jsdom 环境和 Vue Test Utils。

## 相关文件清单

| 文件路径 | 描述 |
| -------- | ---- |
| `vitest.config.ts` | 后端测试配置 |
| `vitest.frontend.config.ts` | 前端测试配置 |
| `tests/setup.ts` | 测试全局设置 |
| `tests/helpers/` | 测试辅助函数 |
| `logs/test-summary.log` | 测试结果摘要 |

## 变更记录 (Changelog)

### 2026-02-16

- 更新 Tests 模块文档
- 完善测试运行说明
- 添加测试覆盖目标
- 更新质量要求

### 2026-02-15

- 完善测试结构文档
- 添加契约测试说明
- 更新测试运行命令

### 2026-02-05

- 初始化 Tests 模块文档