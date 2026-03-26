[根目录](../../../CLAUDE.md) > [frontend](../../) > [src](../) > **types**

# Types 模块

## 模块职责

Types 模块包含前端应用共享的 TypeScript 类型定义，用于消除组件间的类型定义重复。

## 目录结构

```
types/
└── server-detail.ts  # 服务器详情相关的共享类型
```

## 类型定义

### server-detail.ts

**文件路径**: `frontend/src/types/server-detail.ts`

**类型列表**:

#### InstanceConfigOverrides

实例配置覆盖接口，定义了可以在实例级别覆盖的配置项。

```typescript
interface InstanceConfigOverrides {
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  displayName?: string;
  enabled?: boolean;
}
```

**使用位置**:

- `InstanceConfig.vue` - 实例配置组件
- `ServerDetail.vue` - 服务器详情协调器

#### InstanceWithStatus

扩展的实例接口，包含状态信息。继承自 `ServerInstanceConfig`。

```typescript
interface InstanceWithStatus extends ServerInstanceConfig {
  status?: string;
  pid?: number;
  transportType?: string;
}
```

**使用位置**:

- `InstanceCardList.vue` - 实例卡片列表组件
- `ServerDetail.vue` - 服务器详情协调器

## 使用指南

### 导入类型

```typescript
import type { InstanceWithStatus, InstanceConfigOverrides } from '@/types/server-detail';
```

### 在组件中使用

```typescript
// InstanceCardList.vue
import type { InstanceWithStatus } from '@/types/server-detail';

interface Props {
  instances: InstanceWithStatus[];
  selectedIndex: number | null;
  serverName: string;
}
```

```typescript
// InstanceConfig.vue
import type { InstanceConfigOverrides } from '@/types/server-detail';

interface Props {
  templateConfig: ServerTemplate;
  instanceConfig: InstanceConfigOverrides;
  serverName: string;
}
```

## 重构历史

- **2026-03-26**: 创建此模块，从以下组件中提取重复的类型定义：
  - `ServerDetail.vue` (L240-247, L286-290)
  - `InstanceCardList.vue` (L162-166)
  - `InstanceConfig.vue` (L367-374)

## 相关文件清单

| 文件路径                          | 描述                         |
| --------------------------------- | ---------------------------- |
| `types/server-detail.ts`          | 服务器详情相关共享类型       |
| `components/ServerDetail.vue`     | 使用这些类型的协调器组件     |
| `components/InstanceCardList.vue` | 使用 InstanceWithStatus      |
| `components/InstanceConfig.vue`   | 使用 InstanceConfigOverrides |
