[根目录](../CLAUDE.md) > **shared**

# Shared 模块

## 模块职责

Shared 模块包含前后端共享的代码和类型定义，确保前后端使用一致的数据模型和类型。

## 目录结构

```
shared/
├── models/              # 共享数据模型
│   └── session.model.ts # 会话数据模型
└── types/               # 共享类型定义
    └── session.types.ts # 会话相关类型
```

## 核心文件

### Session Model (`models/session.model.ts`)

**职责**: 定义会话状态和存储的数据模型

**主要接口**:

- `SessionState` - 会话状态接口
- `SessionStore` - 会话存储接口

**主要函数**:

- `createEmptySessionStore()` - 创建空的会话存储
- `validateSessionStore()` - 验证和规范化会话存储数据

**依赖**:

- `zod` - 数据验证库

### Session Types (`types/session.types.ts`)

**职责**: 定义前端使用的会话相关类型

**主要接口**:

- `SessionInfo` - 用于前端显示的会话信息接口

**依赖**:

- `models/session.model.ts` - 会话数据模型

## 依赖关系

```
shared/
├── models/session.model.ts
│   └── depends on: zod
└── types/session.types.ts
    └── depends on: models/session.model.ts
```

## 使用方式

### 后端导入

```typescript
import { SessionState, SessionStore } from '@shared-models/session.model.js';
```

### 前端导入

```typescript
import type { SessionState } from '@shared-types/session.types';
```

## 测试与质量

### 单元测试

**状态**: 已实现

**测试覆盖**:

- 会话模型 Zod Schema 验证
- 会话存储验证
- 类型定义验证

**测试文件**:

- `tests/unit/services/session-manager.test.ts` - 包含会话模型相关测试

## 变更记录 (Changelog)

### 2026-02-16

- 创建 Shared 模块
- 将会话模型从 `src/models/session.model.ts` 移动到 `shared/models/session.model.ts`
- 创建会话类型定义 `shared/types/session.types.ts`
- 更新所有相关引用和文档
