[根目录](../../CLAUDE.md) > [tests](../) > **contract**

# 契约测试模块文档

## 模块职责

契约测试模块负责验证 MCP Hub Lite 与外部 MCP 服务器之间的协议兼容性。

## 核心功能

- **MCP 协议契约验证**: 确保 MCP Hub Lite 完全符合 MCP JSON-RPC 2.0 协议规范
- **向后兼容性测试**: 验证新版本不会破坏现有 MCP 服务器集成
- **边界条件测试**: 测试协议边缘情况和错误处理
- **性能基准测试**: 验证协议处理性能指标

## 测试结构

```
contract/
├── mcp-protocol/           # MCP 协议契约测试
│   ├── tools-list.test.ts   # 工具列表契约测试
│   ├── tools-call.test.ts   # 工具调用契约测试
│   └── initialize.test.ts   # 初始化契约测试
├── error-handling/         # 错误处理契约测试
└── performance/            # 性能契约测试
```

## 关键测试文件

### Initialize Test (`mcp-protocol/initialize.test.ts`)

**被测模块**: `src/api/mcp/gateway.ts`

**测试覆盖**:
- MCP 初始化握手协议
- 客户端信息交换
- 服务器能力声明
- 协议版本协商

**运行**:
```bash
npx vitest tests/contract/mcp-protocol/initialize.test.ts
```

### Tools List Test (`mcp-protocol/tools-list.test.ts`)

**被测模块**: `src/api/mcp/gateway.ts`

**测试覆盖**:
- 工具列表 API 的输入输出格式
- 工具 Schema 验证
- 分页处理
- 错误响应格式

**运行**:
```bash
npx vitest tests/contract/mcp-protocol/tools-list.test.ts
```

### Tools Call Test (`mcp-protocol/tools-call.test.ts`)

**被测模块**: `src/api/mcp/gateway.ts`

**测试覆盖**:
- 工具调用 API 的参数传递
- 流式响应处理
- 错误码标准化
- 超时处理

**运行**:
```bash
npx vitest tests/contract/mcp-protocol/tools-call.test.ts
```

## 依赖关系

- **上游依赖**:
  - `src/api/mcp/` - MCP API 实现
  - `src/models/` - 数据模型定义
- **下游依赖**: 无

## 测试运行

```bash
# 运行所有契约测试
npx vitest tests/contract/

# 运行 MCP 协议测试
npx vitest tests/contract/mcp-protocol/

# 生成契约测试报告
npx vitest --coverage tests/contract/
```

## 覆盖率要求

- 协议格式覆盖率: 100%
- 错误码覆盖率: 100%
- 边界条件覆盖率: >= 95%

## 相关文件清单

| 文件路径 | 描述 |
|---------|------|
| `mcp-protocol/initialize.test.ts` | 初始化协议契约测试 |
| `mcp-protocol/tools-list.test.ts` | 工具列表协议契约测试 |
| `mcp-protocol/tools-call.test.ts` | 工具调用协议契约测试 |

## 变更记录 (Changelog)

### 2026-01-29
- 添加导航面包屑
- 完善契约测试模块文档
- 添加每个测试文件的详细说明

### 2026-01-19
- 初始化契约测试模块文档
