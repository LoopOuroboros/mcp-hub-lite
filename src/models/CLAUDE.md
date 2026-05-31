[根目录](../../CLAUDE.md) > [src](../) > **models**

# Models 模块

## 模块职责

Models 模块定义应用的数据模型和类型基础，主要通过 re-export 从 `shared/models/` 暴露共享类型，以及定义系统工具常量。

## 目录结构

```
models/
├── server.model.ts              # Re-export 共享服务器模型类型
├── system-tools.constants.ts    # 系统工具常量定义
└── CLAUDE.md
```

## 核心定义

### 服务器模型 (`server.model.ts`)

Re-export `InstanceSelectionStrategy` 枚举从 shared models:

```typescript
export { InstanceSelectionStrategy } from '@shared-models/server.model.js';
```

`InstanceSelectionStrategy` 枚举值在 `shared/models/server.model.ts` 中定义：`RANDOM`, `ROUND_ROBIN`, `TAG_MATCH_UNIQUE`。

### 系统工具常量 (`system-tools.constants.ts`)

定义系统内置工具的常量配置，包括：

**系统工具名称常量**:

- `LIST_SERVERS_TOOL` = `'list_servers'`
- `LIST_TOOLS_TOOL` = `'list_tools'`
- `GET_TOOL_TOOL` = `'get_tool'`
- `CALL_TOOL_TOOL` = `'call_tool'`
- `UPDATE_SERVER_DESCRIPTION_TOOL` = `'update_server_description'`
- `LIST_TAGS_TOOL` = `'list_tags'`
- `SEARCH_TOOLS_TOOL` = `'search_tools'`

**系统工具参数类型**: `ListServersParams`, `ListToolsInServerParams`, `GetToolParams`, `CallToolParams`, `UpdateServerDescriptionParams`, `ListTagsParams`, `SearchToolsParams`

**综合类型**: `SystemToolArgs`（联合类型）, `SystemToolName`（系统工具名类型）, `SYSTEM_TOOL_NAMES`（所有系统工具名数组）

**Gateway 服务器名**: Re-export `MCP_HUB_LITE_SERVER` from `@shared-models/constants.js`

## 依赖关系

```
models/
├── server.model.ts              # 依赖 @shared-models/server.model.js
└── system-tools.constants.ts    # 依赖 @shared-models/constants.js
```

## 相关文件清单

| 文件路径                           | 描述               |
| ---------------------------------- | ------------------ |
| `models/server.model.ts`           | 共享模型 re-export |
| `models/system-tools.constants.ts` | 系统工具常量定义   |
