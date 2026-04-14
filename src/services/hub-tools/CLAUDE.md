[根目录](../../../CLAUDE.md) > [src](../../) > [services](../) > **hub-tools**

# Hub Tools 子模块

## 模块职责

Hub Tools 子模块负责提供系统工具和服务器管理工具的统一接口，实现 MCP 网关的核心功能。该模块包含系统工具定义、服务器选择逻辑、实例选择策略和资源生成功能。

## 目录结构

```
hub-tools/
├── index.ts                    # 统一导出
├── types.ts                   # 类型定义
├── server-selector.ts         # 服务器选择器
├── instance-selector.ts       # 实例选择器
├── system-tool-definitions.ts # 系统工具定义
├── resource-generator.ts      # 动态资源生成器
├── use-guide.md               # 用户使用指南
└── developer-guide.md         # 开发者指南（包含 MCP_HUB_LITE_SERVER 处理规范）
```

## 核心组件

### Index (`index.ts`)

**职责**: 统一导出模块功能

**导出内容**:

- `HubToolsService` - 原始服务类（向后兼容）
- `hubToolsService` - 服务实例（向后兼容）
- 类型定义和工具函数

### Types (`types.ts`)

**职责**: 定义 Hub Tools 模块相关的类型

**主要类型**:

- `RequestOptions` - 请求选项类型
- `ServerInstanceInfo` - 服务器实例信息类型
- `ValidServer` - 有效服务器类型

### Server Selector (`server-selector.ts`)

**职责**: 服务器选择和描述获取

**主要功能**:

- `hasValidId(server)` - 检查服务器是否有有效的 ID
- `selectBestInstance(serverName, requestOptions)` - 选择最佳服务器实例
- `getServerDescription(serverConfig, serverName)` - 获取服务器描述（使用默认描述当配置中没有提供时）

**关键特性**:

- 支持通过 `requestOptions.sessionId` 或 `requestOptions.tags` 进行实例选择
- 提供通用的服务器描述获取逻辑，避免重复代码
- 与实例选择器集成，支持多实例服务器的智能选择

### Instance Selector (`instance-selector.ts`)

**职责**: 实现多实例服务器的实例选择策略

**支持的策略**:

- **随机 (Random)**: 随机选择可用实例
- **轮询 (Round Robin)**: 循环选择实例
- **标签匹配唯一 (Tag Match Unique)**: 根据标签精确匹配唯一实例

**主要方法**:

- `selectInstance(instances, strategy, tags)` - 基于配置策略选择最佳实例
- 支持会话级别的实例粘性（通过 sessionId）

**应用场景**:

- 多实例服务器的负载均衡
- 基于标签的实例路由
- 会话级别的实例一致性

### System Tool Definitions (`system-tool-definitions.ts`)

**职责**: 定义系统工具的完整 schema

**提供的系统工具**:

- `list-servers` - 列出所有连接的服务器
- `list-tools-in-server` - 列出特定服务器的所有工具
- `get-tool` - 获取特定工具的完整 schema
- `call-tool` - 调用特定服务器上的工具
- `update-server-description` - 更新特定 MCP 服务器的描述

**关键特性**:

- 基于 `SYSTEM_TOOL_NAMES` 常量数组生成工具列表，确保一致性
- 提供完整的输入参数 schema 和工具注解
- 支持 `requestOptions` 参数用于实例选择

### Resource Generator (`resource-generator.ts`)

**职责**: 动态生成 MCP 资源列表和内容读取

**主要功能**:

- `generateDynamicResources()` - 生成动态资源列表，仅保留服务器元数据
- `readResource(uri)` - 读取特定资源的内容

**资源 URI 格式**:

- `hub://use-guide` - 使用指南
- `hub://servers/{serverName}` - 服务器元数据
- `hub://servers/{serverName}/tools` - 服务器工具列表
- `hub://servers/{serverName}/resources` - 服务器资源列表

### Use Guide (`use-guide.md`)

**职责**: 提供用户使用指南

**主要内容**:

- MCP 网关的渐进式发现工作流
- 系统工具参考和使用示例
- 最佳实践和故障排除指南
- 完整的使用示例（获取当前时间）

### Developer Guide (`developer-guide.md`)

**职责**: 提供开发者指南和关键约定

**关键约定**:

- **MCP_HUB_LITE_SERVER 处理**: 所有处理服务器名称的方法必须特殊处理 `mcp-hub-lite` 虚拟服务器
- **添加新系统工具的步骤**: 从常量定义到实现的完整流程
- **测试清单**: 确保系统工具和常规 MCP 服务器都正常工作
- **常见陷阱**: 避免忘记特殊处理、错误使用实例选择等

**MCP_HUB_LITE_SERVER 特殊处理模式**:

```typescript
async someMethod(args: SomeParams): Promise<SomeResult> {
  // Handle MCP Hub Lite server FIRST
  if (typeof args.serverName === 'string' && args.serverName === MCP_HUB_LITE_SERVER) {
    // System tool handling logic here
    return systemToolResult;
  }

  // Regular MCP server handling
  const serverInfo = selectBestInstance(args.serverName, args.requestOptions);
  // ... rest of the implementation
}
```

## 依赖关系

```
hub-tools/
├── index.ts
│   └── exports: all other modules
├── server-selector.ts
│   └── depends on: instance-selector.ts
├── instance-selector.ts
│   └── no dependencies
├── system-tool-definitions.ts
│   └── depends on: @models/system-tools.constants.ts
├── resource-generator.ts
│   └── depends on: server-selector.ts, system-tool-definitions.ts
└── guides
    └── documentation only
```

## 集成方式

Hub Tools 子模块主要被以下组件使用：

- **HubToolsService (`hub-tools.service.ts`)**: 主服务类使用所有子模块功能
- **SystemToolHandler (`system-tool-handler.ts`)**: 系统工具处理器使用工具定义和资源生成
- **Gateway Request Handlers**: 请求处理器使用服务器选择和实例选择功能

## 测试与质量

### 单元测试

**状态**: 部分实现

**测试覆盖**:

- 服务器选择逻辑
- 实例选择策略
- 系统工具定义
- 资源生成逻辑

**相关测试文件**:

- `tests/unit/services/hub-tools.service.test.ts`

### 集成测试

**状态**: 通过主服务集成测试覆盖

## 常见问题 (FAQ)

### Q: 为什么需要特殊处理 MCP_HUB_LITE_SERVER？

A: `mcp-hub-lite` 是一个虚拟服务器，不对应任何实际连接的 MCP 服务器。它提供网关自身的系统工具，因此不能通过常规的服务器实例选择逻辑处理。

### Q: 如何添加新的系统工具？

A: 遵循开发者指南中的四步流程：

1. 在 `system-tools.constants.ts` 中添加工具常量
2. 在 `system-tool-definitions.ts` 中添加工具定义
3. 在 `hub-tools.service.ts` 中添加实现
4. 确保正确处理 `MCP_HUB_LITE_SERVER` 特殊情况

### Q: 实例选择策略如何工作？

A: 实例选择器支持三种策略：

- **随机**: 适用于简单的负载均衡
- **轮询**: 适用于需要均匀分布的场景
- **标签匹配**: 适用于需要基于特定条件路由的场景

## 相关文件清单

| 文件路径                               | 描述                         |
| -------------------------------------- | ---------------------------- |
| `hub-tools/index.ts`                   | 统一导出                     |
| `hub-tools/types.ts`                   | 类型定义                     |
| `hub-tools/server-selector.ts`         | 服务器选择器                 |
| `hub-tools/instance-selector.ts`       | 实例选择器                   |
| `hub-tools/system-tool-definitions.ts` | 系统工具定义                 |
| `hub-tools/resource-generator.ts`      | 动态资源生成器               |
| `hub-tools/use-guide.md`               | 用户使用指南                 |
| `hub-tools/developer-guide.md`         | 开发者指南                   |
| `../hub-tools.service.ts`              | 主服务类（使用此模块）       |
| `../system-tool-handler.ts`            | 系统工具处理器（使用此模块） |
