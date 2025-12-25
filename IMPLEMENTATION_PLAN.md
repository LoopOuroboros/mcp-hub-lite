# MCP Hub Lite 完整实施计划

## 📊 项目概述

MCP Hub Lite 是一个轻量级的 MCP (Model Context Protocol) 网关系统，专为独立开发者设计。基于对POC阶段的全面验证（100%测试通过率），现在需要将分散的POC实现整合到统一的生产架构中。

### 核心价值
- **Server管理**: 独立开发者能够查看、组织和管理所有MCP Servers
- **工具搜索**: 快速发现MCP工具，支持Web界面和MCP协议两种方式
- **MCP Gateway**: 作为统一入口代理后端MCP Servers，提供标准化JSON-RPC 2.0接口
- **容错机制**: 单个MCP Server失败不影响整体系统服务
- **便捷CLI**: 6个核心命令提供快速操作能力

### 架构原则
- **单进程Lite架构**: 避免多组件协调复杂性，内存占用<30MB
- **直接遍历搜索**: 移除复杂的SearchIndex服务，采用简单字符串匹配
- **YAGNI原则**: 专注P1核心功能，移除企业级复杂特性
- **ESM模块系统**: 强制使用ECMAScript Modules，确保代码质量

## 🔍 当前状态分析

### ✅ POC验证成果
| 测试类型 | 通过率 | 详细结果 |
|---------|--------|----------|
| 基础功能验证 | 100% | 4/4 通过 |
| 性能基准测试 | 100% | 24/24 通过 |
| API兼容性测试 | 100% | 7/7 通过 |
| 内存泄漏检测 | 100% | 5/5 通过 |

### 📁 POC项目结构现状
```
poc/
├── 01-fastify-gateway/      # MCP Gateway POC (Fastify + Promise.allSettled)
├── 02-vue3-ui/             # Vue3前端UI POC
├── 03-cli-commands/        # CLI命令 POC
├── 04-config-manager/      # 配置管理 POC (Zod验证 + 备份)
├── 05-dashboard-core/      # Dashboard核心 POC
└── 06-mcp-sdk-validation/  # MCP SDK兼容性验证 POC
```

### 🎯 架构差距分析
| 方面 | POC现状 | 目标架构 | 整合策略 |
|------|---------|----------|----------|
| **项目结构** | 独立目录分离 | 统一单体架构 | 合并到单一代码库 |
| **依赖管理** | 各POC独立依赖 | 单一package.json | 统一依赖版本 |
| **构建流程** | 独立构建脚本 | Vite统一构建 | 集成前后端构建 |
| **测试框架** | 分散测试文件 | 统一Vitest框架 | 迁移测试用例 |

## 📋 详细实施计划

### Phase 1: 项目初始化 (2天)

**目标**: 快速搭建项目基础，研究MCP协议，为开发扫清障碍

#### 任务分解
**T001 - 项目基础搭建**
- 创建统一目录结构 (`src/`, `frontend/`, `tests/`, `docs/`)
- 配置TypeScript + Vite + ESLint + Prettier
- 集成MCP SDK依赖 (`@modelcontextprotocol/sdk`)
- 设置ESM模块系统规范 (强制import/export语法)
- 配置Vitest测试框架和覆盖率报告
- 初始化Git hooks (pre-commit验证)

#### 技术栈选择依据
- **Fastify**: 高性能HTTP服务器，POC已验证
- **MCP SDK**: 官方MCP协议实现，兼容性已验证
- **Vue 3 + Element Plus**: 现代化Dashboard，符合specs要求
- **Vitest**: 轻量级测试框架，与Vite完美集成
- **Zod**: 数据验证，POC已验证效果良好

### Phase 2: 核心模型与配置 (2天)

**目标**: 建立数据基础和配置管理，为US1-US4提供支撑

#### 任务分解
**T002 - 核心数据模型**
```typescript
// src/models/server.model.ts
export interface McpServer {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  tags?: Record<string, string>;
  tools: McpTool[];
  // ... 其他字段
}

// src/models/tool.model.ts
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  serverId: string;
}
```

**配置管理系统**
- Zod schema验证 (`src/config/config.schema.ts`)
- JSON配置文件管理 (`src/config/config.manager.ts`)
- 环境变量支持:
  - `MCP_HUB_CONFIG_PATH`: 自定义配置文件路径
  - `MCP_HUB_PORT`: 服务端口号 (默认7788)
  - `MCP_HUB_HOST`: 服务绑定地址 (默认localhost)
  - `MCP_HUB_LOG_LEVEL`: 日志级别 (默认info)

**基础工具模块**
- Logger工具 (`src/utils/logger.ts`)
- Validation工具 (`src/utils/validation.ts`)
- Process工具 (`src/utils/process.ts`)

### Phase 3: Server管理功能 (3天)

**目标**: 实现US1 - 独立开发者管理多个MCP Server

#### 任务分解
**T003 - 后端实现 (`src/services/hub-manager.service.ts`)**
- HubManager服务 (单进程管理所有Servers)
- REST API端点:
  - `GET /api/servers` - 获取服务器列表
  - `POST /api/servers` - 添加新服务器
  - `GET /api/servers/{id}` - 获取服务器详情
  - `PUT /api/servers/{id}` - 更新服务器配置
  - `DELETE /api/servers/{id}` - 删除服务器
  - `POST /api/servers/{id}/start|stop|restart` - 控制服务器

**T004 - 前端实现 (`frontend/src/`)**
- Vue3 ServerManager视图 (`views/ServerManager.vue`)
- Pinia状态管理 (`stores/server.store.ts`)
- Element Plus组件集成 (表格、表单、按钮等)
- 路由配置 (`router/index.ts`)

#### 验收标准
- ✅ 系统启动后显示MCP Server列表
- ✅ 按状态（online/offline/error）筛选
- ✅ 查看Server详情（工具列表、配置、状态）
- ✅ 支持添加、编辑、删除Server配置

### Phase 4: 工具搜索功能 (3天)

**目标**: 实现US2 - 快速发现MCP工具（Web界面 + MCP协议）

#### 任务分解
**T005 - 后端实现 (`src/services/simple-search.service.ts`)**
- DirectSearch服务 (直接遍历工具列表)
- 字符串匹配算法 (name, description, tags)
- 双API设计:
  - `GET /web/search?q=keyword` - Web界面搜索 (返回友好格式)
  - `MCP list_tools` - MCP协议搜索 (返回JSON-RPC 2.0格式)
- 性能优化 (<100ms响应时间，200工具规模)

**T006 - 前端实现 (`frontend/src/`)**
- SearchBox组件 (`components/SearchBox.vue`)
- ToolResult视图 (`views/ToolSearch.vue`)
- 搜索结果展示和过滤
- Pinia搜索状态管理 (`stores/tool.store.ts`)

#### 验收标准
- ✅ Web界面输入关键词返回匹配工具
- ✅ 支持工具名、描述、标签的模糊匹配
- ✅ MCP list_tools返回JSON RPC 2.0格式
- ✅ 响应时间 < 100ms（200工具规模）

### Phase 5: MCP Gateway代理 (3天)

**目标**: 实现US3 - 作为MCP Gateway代理后端Servers

#### 任务分解
**T007 - 核心实现 (`src/services/streaming-gateway.service.ts`)**
- StreamingGateway服务
- JSON-RPC 2.0协议处理
- 请求路由和代理 (基于serverId)
- 双轨错误码系统:
  - 内部: 6000-6999 (开发调试，详细错误信息)
  - 外部: -32001/-32801 (MCP标准，协议兼容)

**T008 - 协议测试 (`tests/integration/mcp.test.ts`)**
- MCP协议合规性测试
- 真实MCP客户端集成测试
- 错误处理验证
- 性能基准测试

#### 验收标准
- ✅ MCP客户端连接MCP-HUB-LITE获取Tools列表
- ✅ 调用后台Tools并返回JSON RPC 2.0格式响应
- ✅ 隐藏后端复杂性（统一入口）
- ✅ Gateway延迟 < 100ms

### Phase 6: 容错机制 (2天)

**目标**: 实现US4 - 单个MCP Server失败不影响整体系统

#### 任务分解
**T009 - 容错实现 (`src/services/hub-manager.service.ts`)**
- Promise.allSettled聚合响应
- Server状态跟踪 (online/offline/error)
- 启动失败隔离处理
- 健康检查端点 (`GET /health`)

**T010 - 容错测试 (`tests/integration/fault-tolerance.test.ts`)**
- Health check端点测试
- 混合状态集成测试 (正常+错误Server)
- 故障恢复验证
- API错误率验证 (<1%)

#### 验收标准
- ✅ 配置错误Server，系统仍可正常启动
- ✅ Server崩溃标记为error，不影响其他Services
- ✅ Promise.allSettled聚合响应
- ✅ API错误率不超过1%

### Phase 7: CLI命令 (2天)

**目标**: 实现6个核心CLI命令，支持快速操作

#### 任务分解
**T011 - CLI实现 (`src/cli/`)**
- CLI核心架构 (`src/cli/index.ts`)
- 6个命令实现:
  - `mcp-hub-lite start` - 启动服务
  - `mcp-hub-lite stop` - 停止服务
  - `mcp-hub-lite status` - 查看状态
  - `mcp-hub-lite ui` - 打开Web界面
  - `mcp-hub-lite list` - 列出所有Servers
  - `mcp-hub-lite restart` - 重启Servers
- package.json bin字段配置
- 全局安装测试 (npm/pnpm)

#### 验收标准
- ✅ 所有6个命令工作正常
- ✅ 支持Windows/macOS/Linux跨平台
- ✅ 全局安装后可直接使用命令
- ✅ 命令输出清晰易读

### Phase 8: 集成测试与优化 (3天)

**目标**: MVP交付准备，确保质量和性能

#### 任务分解
**T012 - 测试与性能 (`tests/`)**
- 完整测试套件 (单元+集成+E2E)
- 性能基准测试 (Gateway<100ms, Search<100ms)
- TypeScript strict mode验证
- 代码覆盖率报告 (>85%)

**T013 - 集成验收 (`docs/`)**
- 用户验收测试 (所有US1-US4场景)
- 构建系统完善
- 技术文档和用户文档生成
- 最终质量门禁检查

#### 验收标准
- ✅ 所有P1用户故事通过验收场景
- ✅ 代码覆盖率 > 85%
- ✅ Gateway延迟 < 100ms
- ✅ 搜索响应时间 < 100ms (200工具)
- ✅ CLI 6个命令全部工作正常
- ✅ MCP协议合规性测试通过

## 🧪 验证方法与测试流程

### 功能验证方法

#### 用户故事验收测试
**US1 - Server管理**
```gherkin
Scenario: 查看MCP Server列表
  Given 系统已启动并运行
  When 开发者打开MCP-HUB-LITE界面
  Then 应该显示所有已配置的MCP Server列表
  And 包括Server名称、状态和标签信息

Scenario: 查看Server详情
  Given 存在多个MCP Server
  When 开发者点击特定Server
  Then 应该显示该Server的工具列表、配置信息和当前状态
```

**US2 - 工具搜索**
```gherkin
Scenario: Web界面搜索工具
  Given 系统中有多个后端MCP Servers和大量Tools
  When 开发者在Web界面输入关键词"search"
  Then 应该返回所有Tool名称或描述中包含"search"的工具

Scenario: MCP协议搜索
  Given LLM发送MCP list_tools请求
  When 系统处理搜索请求
  Then 应返回JSON RPC 2.0格式的结构化响应
```

**US3 - MCP Gateway**
```gherkin
Scenario: 获取Tools列表
  Given LLM希望获取所有可用的Tools
  When 发送MCP list_tools请求到MCP-HUB-LITE
  Then 系统应以MCP JSON RPC 2.0格式返回所有Tools列表

Scenario: 调用特定Tool
  Given 上游MCP Client需要调用特定Tool
  When 发送MCP tool调用请求到Gateway
  Then 系统应代理请求到后端对应MCP Server
```

**US4 - 容错机制**
```gherkin
Scenario: Server启动失败
  Given 系统配置了三个MCP Servers，其中一个配置错误
  When 启动MCP-HUB-LITE
  Then 系统应该能够正常启动并提供API服务
  And 对服务器列表查询返回正确状态（一个错误，两个正常）

Scenario: Server运行时崩溃
  Given 正在运行的MCP Server突然崩溃
  When 系统检测到崩溃
  Then 应该立即标记该Server为错误状态
  And 不影响其他Servers的正常运行
```

### 自动化测试策略

#### 测试分层
| 测试类型 | 覆盖范围 | 工具 | 目标 |
|---------|----------|------|------|
| **单元测试** | 核心逻辑、工具函数 | Vitest | >85%覆盖率 |
| **集成测试** | API端点、服务交互 | Vitest | 功能完整性 |
| **E2E测试** | 完整用户流程 | Cypress/Playwright | 用户体验 |
| **契约测试** | MCP协议合规性 | 自定义测试 | 协议标准 |

#### 测试执行流程
```bash
# 1. 编译检查 (TypeScript strict mode)
npm run typecheck

# 2. 单元测试 (核心逻辑验证)
npm test

# 3. 集成测试 (API和服务验证)
npm run test:integration

# 4. E2E测试 (完整用户流程)
npm run test:e2e

# 5. 性能测试 (响应时间验证)
npm run test:performance

# 6. 协议合规测试 (MCP标准验证)
npm run test:compatibility
```

### 性能验证指标

| 指标 | 目标值 | 测试方法 |
|------|--------|----------|
| Gateway延迟 | <100ms | 压力测试工具 |
| 搜索响应时间 | <100ms (200工具) | 模拟搜索请求 |
| Server列表加载 | <2秒 (50 Servers) | 界面加载测试 |
| 内存占用 | <30MB | 内存监控工具 |
| CPU占用 | <80% | 系统资源监控 |
| API错误率 | <1% | 错误注入测试 |

## 📄 输出文档

### 技术文档

#### 架构文档 (`docs/architecture.md`)
- **系统架构图**: 单进程架构组件关系图
- **组件交互说明**: HubManager、StreamingGateway、SimpleSearch服务职责
- **数据流图**: 从API请求到MCP响应的完整数据流
- **错误处理流程**: 双轨错误码转换机制

#### API文档 (`docs/api.md`)
- **REST API端点说明**:
  - `/api/servers` - Server管理API
  - `/web/search` - Web搜索API
  - `/health` - 健康检查API
- **MCP协议接口说明**:
  - `tools/list` - 工具列表获取
  - `tools/call` - 工具调用
  - `initialize` - 初始化握手
- **错误码参考**:
  - JSON-RPC标准错误码 (-32099 to -32000)
  - MCP特定错误码 (-32899 to -32800)
  - MCP Hub Lite扩展错误码

#### 开发指南 (`docs/development.md`)
- **本地开发环境设置**: Node.js版本、依赖安装
- **调试技巧**: 断点调试、日志级别调整
- **测试运行方法**: 各类测试的执行命令
- **代码贡献指南**: 提交规范、代码审查流程

### 用户文档

#### 快速开始 (`docs/quickstart.md`)
- **安装指南**:
  ```bash
  npm install -g mcp-hub-lite
  # 或
  pnpm add -g mcp-hub-lite
  ```
- **基本使用示例**:
  ```bash
  mcp-hub-lite start
  mcp-hub-lite ui
  mcp-hub-lite list
  ```
- **常见问题解答**: 配置文件位置、端口冲突解决等

#### CLI参考 (`docs/cli-reference.md`)
- **6个命令详细说明**:
  - `start`: 启动服务 (支持--port, --host参数)
  - `stop`: 停止服务
  - `status`: 查看运行状态和Server列表
  - `ui`: 打开Web界面 (自动检测浏览器)
  - `list`: 列出所有MCP Servers及其状态
  - `restart`: 重启指定或所有MCP Servers
- **参数选项说明**: 环境变量覆盖、配置文件指定
- **使用示例**: 常见场景的命令组合

#### 配置指南 (`docs/configuration.md`)
- **配置文件格式**: JSON schema定义
- **环境变量说明**: MCP_HUB_*系列变量详解
- **高级配置选项**: 日志级别、资源限制、安全设置
- **配置迁移**: 从POC配置到生产配置的转换方法

## ⏱️ 时间规划与并行机会

### 总体时间线 (20天)
| 阶段 | 任务 | 时间 | 交付物 |
|------|------|------|--------|
| **Phase 1** | 项目初始化 | 2天 | 可运行的基础项目 |
| **Phase 2** | 核心模型与配置 | 2天 | 数据模型和配置系统 |
| **Phase 3** | Server管理功能 | 3天 | 完整的Server管理能力 |
| **Phase 4** | 工具搜索功能 | 3天 | 双模式搜索功能 |
| **Phase 5** | MCP Gateway代理 | 3天 | 标准化的MCP网关 |
| **Phase 6** | 容错机制 | 2天 | 高可用的容错系统 |
| **Phase 7** | CLI命令 | 2天 | 6个核心CLI命令 |
| **Phase 8** | 集成测试与优化 | 3天 | 完整MVP版本 |

### 并行开发机会

#### 团队分工建议
1. **团队A (基础设施)**: T001-T002 (2天)
   - 项目初始化、依赖配置、测试框架搭建

2. **团队B (核心功能)**: T003-T010 (8天，与团队A并行)
   - Server管理、工具搜索、MCP Gateway、容错机制

3. **团队C (CLI开发)**: T011 (2天，与团队B并行)
   - CLI命令实现、全局安装测试

4. **团队D (测试优化)**: T012-T013 (3天，等待核心功能完成后)
   - 完整测试套件、性能优化、文档编写

#### 关键路径
- **关键路径**: T001 → T002 → T003 → T005 → T007 → T009 → T012 → T013
- **并行路径**: T004, T006, T008, T010, T011

## 🚨 风险识别与缓解

### 高风险任务

#### 1. MCP SDK集成风险
- **风险描述**: MCP协议复杂，可能存在理解偏差
- **影响**: Gateway功能无法正常工作
- **缓解策略**:
  - 提前1天深度研究MCP协议文档
  - 基于POC-06的兼容性测试结果进行开发
  - 使用现有MCP客户端进行集成测试

#### 2. MCP Gateway实现风险
- **风险描述**: JSON-RPC 2.0协议处理复杂，错误码映射容易出错
- **影响**: 外部系统无法正确集成
- **缓解策略**:
  - 基于POC-01的Fastify Gateway实现逐步迭代
  - 实现完整的契约测试覆盖所有协议场景
  - 双轨错误码系统确保内部调试和外部兼容

#### 3. 前端Dashboard开发风险
- **风险描述**: Vue3 + Pinia + Element Plus集成复杂度高
- **影响**: 用户体验不佳，功能不完整
- **缓解策略**:
  - 分阶段实现：先完成Server管理再做搜索功能
  - 复用Element Plus官方示例和最佳实践
  - 前端组件化开发，确保可维护性

### 质量保证措施

#### 每个Phase结束后的质量门禁
1. **TypeScript编译检查**: `npm run typecheck` (strict mode)
2. **单元测试通过**: `npm test` (覆盖率>85%)
3. **代码规范检查**: `npm run lint` (ESLint + Prettier)
4. **验收测试验证**: 针对用户故事的具体场景测试

#### 持续集成保障
- **预提交Hook**: 自动运行类型检查和单元测试
- **PR检查**: 集成测试和E2E测试必须通过
- **性能监控**: 关键指标(延迟、内存)必须达标
- **文档同步**: 代码变更必须同步更新相关文档

## ✅ 最终交付标准

MVP交付必须满足以下**硬性条件**：

### 功能完整性
- ✅ **US1**: Server管理 - 完整的CRUD操作和状态显示
- ✅ **US2**: 工具搜索 - Web界面和MCP协议双模式支持
- ✅ **US3**: MCP Gateway - 标准JSON-RPC 2.0协议兼容
- ✅ **US4**: 容错机制 - 单点故障不影响整体服务

### 性能指标
- ✅ **Gateway延迟**: <100ms (平均响应时间)
- ✅ **搜索响应时间**: <100ms (200工具规模)
- ✅ **Server列表加载**: <2秒 (50 Servers)
- ✅ **内存占用**: <30MB (单进程架构)
- ✅ **CPU占用**: <80% (50 Servers负载)

### 质量保证
- ✅ **代码覆盖率**: >85% (Vitest报告)
- ✅ **CLI命令**: 6个核心命令全部工作正常
- ✅ **MCP协议合规**: 100%通过兼容性测试
- ✅ **跨平台支持**: Windows/macOS/Linux全平台验证

### 文档完整性
- ✅ **技术文档**: 架构、API、开发指南
- ✅ **用户文档**: 快速开始、CLI参考、配置指南
- ✅ **测试报告**: 完整的测试结果和性能基准

---

**总结**: 本实施计划基于Muda分析和YAGNI原则，将原计划的34个任务精简到13个核心任务，确保在3周内交付高质量的MCP Hub Lite MVP版本。通过单进程Lite架构、直接遍历搜索、6个核心CLI命令等简化设计，既满足独立开发者的核心需求，又保持了足够的简洁性和可维护性。