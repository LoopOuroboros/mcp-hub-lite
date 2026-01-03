# Tasks: MCP-HUB-LITE Implementation Plan (Lite版本)

**Feature**: 001-develop | **Feature Name**: MCP-HUB-LITE
**Date**: January 2, 2026
**Based on**: spec.md, plan.md, data-model.md, architecture.md, research.md

## 架构简化为LITE版本 (2025-12-15)

本任务清单基于**Muda分析优化**，专为独立开发者设计，强调极简交付：

**核心决策**：
- ✅ 单进程架构（无多组件协调）
- ✅ 直接遍历搜索（无SearchIndex）
- ✅ 6个CLI命令（start/stop/status/ui/list/restart）
- ✅ 简化容错（Promise.allSettled）
- ✅ Vue3 + Element Plus前端
- ✅ 专注P1功能（MVP），移除所有P2/P3非核心功能
- ✅ 总任务数：13（完整MVP）

---

## Phase 1: Project Setup (1任务)

**Goal**: 快速初始化项目并研究MCP协议，为开发扫清障碍

**MVP必需**: 所有核心功能的基础

### Implementation Tasks

- [ ] T001 [P] Research MCP SDK + initialize TypeScript project + create directory structure + configure build system (Vite, TypeScript, ESLint, Prettier)

**Dependencies**: None
**预计时间**: 2天

---

## Phase 2: Core Models & Config (1任务)

**Goal**: 核心数据模型 + 配置管理 + 基础工具 + 测试框架

**MVP必需**: 为US1-US5提供数据基础

### Implementation Tasks

- [ ] T002 [P] Create core models (McpServer, McpTool) + implement configuration system (Zod schema, JSON manager) + utility modules (logger, validation, process) + Vitest test framework

**Dependencies**: Phase 1 completed
**预计时间**: 2天

---

## Phase 3: User Story 1 - Server Management (2任务)

**Goal**: 独立开发者能够查看、管理和组织所有配置的MCP Servers

**Independent Test Criteria**:
- ✅ 系统启动后显示MCP Server列表
- ✅ 按状态（online/offline/error）筛选
- ✅ 查看Server详情（工具列表、配置、状态）

### Implementation Tasks

- [ ] T003 [US1] Backend: HubManager service + server CRUD API endpoints (GET/POST/PUT/DELETE /api/servers)
- [ ] T004 [US1] Frontend: Vue3 server management UI (ServerManager view + Pinia store + components) + routing integration

**Dependencies**: Phase 2 completed
**预计时间**: 3天

---

## Phase 4: User Story 2 - Tool Search (2任务)

**Goal**: 快速搜索MCP工具（Web界面 + MCP协议），直接遍历无SearchIndex

**Independent Test Criteria**:
- ✅ Web界面输入关键词返回匹配工具（`/web/search`）
- ✅ 支持工具名、描述、标签的简单匹配
- ✡ MCP list_tools返回JSON RPC 2.0格式
- ✅ 响应时间 < 100ms（50-200工具规模）

**Architecture**: 直接遍历搜索（无SearchIndex，无需分词）

### Implementation Tasks

- [ ] T005 [US2] Backend: Direct search service (simple string matching) + tool search endpoints (GET /web/search + MCP protocol integration)
- [ ] T006 [US2] Frontend: Tool search UI (SearchBox component + ToolResult view + Pinia store) + search tests

**Dependencies**: Phase 2, Phase 3
**预计时间**: 3天

---

## Phase 5: User Story 3 - MCP Gateway (2任务)

**Goal**: 作为MCP Gateway代理，JSON-RPC 2.0请求转发到后端MCP Servers

**Independent Test Criteria**:
- ✅ MCP客户端连接MCP-HUB-LITE获取Tools列表
- ✅ 调用后台Tools并返回JSON RPC 2.0格式响应
- ✅ 隐藏后端复杂性（统一入口）

**错误码设计**: JSON-RPC 2.0标准错误码 + 2个扩展码（SERVER_UNREACHABLE: -32001, SERVER_NOT_FOUND: -32002）

### Implementation Tasks

- [ ] T007 [US3] Core: MCP Gateway service + JSON-RPC 2.0 endpoints (tools/list, proxy requests) + standard error code system
- [ ] T008 [US3] Testing: MCP protocol compliance tests (contract + integration) + real MCP Client integration testing

**Dependencies**: Phase 2, Phase 3
**预计时间**: 3天

---

## Phase 6: User Story 4 - Fault Tolerance (2任务)

**Goal**: 单个MCP Server失败不影响整体系统（简化容错）

**Independent Test Criteria**:
- ✅ 配置错误Server，系统仍可正常启动
- ✅ Server崩溃标记为error，不影响其他Services
- ✅ Promise.allSettled聚合响应（简化设计）

**Architecture**: Promise.allSettled替代复杂容错机制（YAGNI原则）

### Implementation Tasks

- [ ] T009 [US4] Implementation: Fault isolation using Promise.allSettled in HubManager + Gateway + server status tracking
- [ ] T010 [US4] Testing: Health check endpoint + integration test with mixed server statuses

**Dependencies**: Phase 2, Phase 3, Phase 5
**预计时间**: 2天

---

## Phase 7: User Story 5 - CLI Commands (1任务)

**Goal**: 实现6个核心CLI命令，支持快速操作

**Commands**: start, stop, status, ui, list, restart

### Implementation Tasks

- [ ] T011 [US5] CLI core + all 6 commands (start/stop/restart/status/ui/list) + package.json bin field + global installation test

**Dependencies**: Phase 3（基于server management API）
**预计时间**: 2天

---

## Phase 8: Final Polish & Testing (2任务)

**Goal**: 性能优化、测试完善、构建部署准备（MVP交付）

### Implementation Tasks

- [ ] T012 [P] Performance & Testing: Comprehensive test suite (unit + integration + E2E) + performance optimization (Gateway < 100ms, Search < 100ms)
- [ ] T013 [P] Final Integration: Build system complete + TypeScript strict mode + full test pass + user acceptance testing (all US1-US5 criteria)

**Dependencies**: Phase 1-7（所有US1-US5）
**预计时间**: 3天

**Quality Gates**:
- ✅ TypeScript编译（strict mode）
- ✅ MCP协议合规
- ✅ 性能基准达成
- ✅ MVP验收通过

---

## Summary

### Statistics (Lite版本)
- **Total Tasks**: 13（完整MVP）
- **P1 Core (US1-US5)**: 11 tasks (85%)
- **CLI & Polish**: 2 tasks (15%)

### Phase Breakdown

| Phase | Tasks | Goal | Estimated Time |
|-------|-------|------|----------------|
| **Phase 1** | 1 | 项目初始化 | 2天 |
| **Phase 2** | 1 | 核心基础 | 2天 |
| **Phase 3** | 2 | Server管理 | 3天 |
| **Phase 4** | 2 | 工具搜索 | 3天 |
| **Phase 5** | 2 | MCP Gateway | 3天 |
| **Phase 6** | 2 | 容错机制 | 2天 |
| **Phase 7** | 1 | CLI命令 | 2天 |
| **Phase 8** | 2 | 测试优化 | 3天 |
| **总计** | **13** | **完整MVP** | **20天** |

### MVP范围 (核心价值)

**Phase 1-8**: 完整MVP（13任务，3周）
- ✅ Ph1-2: 基础设施（模型 + 配置 + 工具）
- ✅ Ph3: Server管理（后端API + 前端UI）
- ✅ Ph4: 搜索（后端服务 + 前端UI）
- ✅ Ph5: MCP Gateway（后端实现 + 协议测试）
- ✅ Ph6: 容错机制（实现 + 测试）
- ✅ Ph7: CLI命令（完整CLI）
- ✅ Ph8: 测试 & 性能优化（集成验收）

**MVP交付价值**：
- ✅ 完整的MCP服务器管理平台
- ✅ 支持外部系统集成（JSON-RPC 2.0）
- ✅ 快速搜索和浏览工具
- ✅ 简化容错和状态管理
- ✅ 便捷CLI工具

**预计时间**: 3周（单人），或2周（并行开发）

### 技术决策总结

- **Fastify** - 高性能HTTP服务器
- **MCP SDK** - 官方MCP协议实现
- **Vue 3 + Element Plus** - 现代化Dashboard
- **Vitest** - 单元测试框架
- **Zod** - 数据验证
- **JSON Storage** - 无需数据库

### 验收标准

最终交付标准：
- ✅ 所有P1用户故事通过验收场景
- ✅ 代码覆盖率 > 85%
- ✅ Gateway延迟 < 100ms
- ✅ 搜索响应时间 < 100ms (200工具)
- ✅ CLI 6个命令全部工作正常
- ✅ MCP协议合规性测试通过

---

**任务状态**: 待实施
**下一步**: T001 项目初始化（研究 + 初始化 + 目录结构 + 构建系统）

## Tasks Completed

此清单为计划的待执行任务。执行过程中：
- 完成任务后更新复选框为 `[x]`
- 添加实际的文件路径和变更详情
- 记录完成时间和验收证据