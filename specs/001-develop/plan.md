# Implementation Plan: MCP-HUB-LITE

**Branch**: `001-develop` | **Date**: January 2, 2026 | **Spec**: `/specs/001-develop/spec.md`
**Input**: Feature specification from `/specs/001-develop/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

MCP-HUB-LITE是为独立开发者设计的MCP管理平台，提供MCP服务器网关、服务器状态管理、工具模糊搜索功能，并支持MCP HttpStream协议对外接口。系统作为Gateway代理，允许多个后端MCP Servers通过统一接口被外部CLI或IDE复用。核心特性包括单个MCP启动失败不影响整体服务、6个核心CLI命令、直接遍历搜索实现，以及Vue3 + Element Plus构建的Web Dashboard界面。

## Technical Context

**Language/Version**: TypeScript 5.x + Node.js 20.x
**Primary Dependencies**: Fastify (HTTP server), MCP SDK (官方MCP协议), Vitest (测试), Zod (数据验证), Pino (日志), Vue 3 + Element Plus (前端UI)
**Storage**: 文件存储（.mcp-hub.json配置文件），无数据库依赖
**Testing**: Vitest（单元测试），DOM环境支持，API集成测试，端到端测试
**Target Platform**: 跨平台（Windows PowerShell/CMD、macOS Terminal、Linux Bash）
**Project Type**: web - 前后端分离架构（Fastify后端 + Vue3前端Dashboard）
**Performance Goals**: Gateway平均响应延迟<100ms，搜索功能90%查询<100ms支持200工具规模，内存占用<30MB
**Constraints**: 内存使用<4GB，CPU使用<80%，API错误率<1%，连接成功率>99%
**Scale/Scope**: 面向独立开发者，支持管理50个MCP Servers，单用户场景无需认证

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Compliance Verification

**I. Type Safety First**: TypeScript 5.x with strict mode will be used throughout the project. All API contracts will be validated with Zod schemas as required. Data models defined in data-model.md follow strict typing principles with validation rules.

**II. MCP Protocol Compliance**: Gateway functionality will strictly adhere to MCP protocol specification using JSON-RPC 2.0 format for all proxied requests. MCP protocol contract defined in contracts/mcp-protocol-contract.md ensures compliance with official MCP specification.

**III. Test-First**: TDD approach will be followed with tests written before implementation, following Red-Green-Refactor cycle. API contracts in web-api-contract.yaml and mcp-protocol-contract.md provide contract tests for verification.

**IV. Configuration as Code**: System will use .mcp-hub.json configuration files with JSON Schema validation. Configuration management provides simple export/import capabilities without complex backup systems.

**V. Resilience by Design**: Simple fault isolation using Promise.allSettled will be implemented to ensure single MCP server failures don't impact overall system. Server status monitoring and error handling follow simplified data-model.md specifications.

### Performance Standards
- API response times <100ms (achieved via Fastify framework)
- Memory usage <4GB (monitoring during development, limit defined in data-model.md)
- Gateway latency <100ms overhead (per spec requirement SC-010)
- Server status updates within 5 seconds (using polling instead of SSE to reduce complexity)
- Direct search performance <100ms for 200 tools (per SC-003 requirement, no SearchIndex construction needed)
- Support for 50 MCP Servers with tag-based filtering and search

### Quality Gates
- All tests pass before merge
- TypeScript compilation with strict mode
- MCP protocol compliance verification (via contract tests)
- Configuration validation against schema
- Performance benchmarks met per spec requirements

## Project Structure

### Documentation (this feature)

```text
specs/001-develop/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/                                 # 后端源码
├── api/                             # API处理
│   ├── mcp/                         # MCP JSON-RPC协议
│   │   ├── tools.ts                 # 工具处理
│   │   └── gateway.ts               # Gateway处理
│   └── web/                         # Web API
│       ├── servers.ts               # 服务器API
│       └── config.ts                # 配置API
├── models/                          # 数据模型
│   ├── types.ts                     # 类型定义
│   ├── server.model.ts              # 服务器模型（简化）
│   └── tool.model.ts                # 工具模型（简化）
├── services/                        # 核心业务（简化）
│   ├── gateway.service.ts          # MCP Gateway（直接代理）
│   └── simple-search.service.ts     # 简化搜索（直接遍历）
├── config/                          # 配置管理（简化）
│   └── config.manager.ts            # 仅JSON文件操作
├── utils/                           # 工具函数
│   └── process.ts                   # 简化进程工具
├── server/                          # 服务器相关
│   ├── runner.ts                    # 服务器启动器
│   └── pid.manager.ts               # PID管理器
├── cli/                             # 命令行接口（6命令）
│   ├── commands/
│   │   ├── start.ts
│   │   ├── stop.ts
│   │   ├── status.ts
│   │   ├── ui.ts
│   │   ├── list.ts
│   │   └── restart.ts
│   └── index.ts
└── index.ts                         # 服务入口

frontend/                           # Vue3前端源码
├── public/                         # 静态资源
│   └── locales/                    # 国际化语言文件
│       ├── en.json                 # 英文翻译
│       └── zh.json                 # 中文翻译
├── src/                            # Vue3源代码
│   ├── assets/                     # 资源文件（图片、图标等）
│   ├── components/                 # 公共组件
│   ├── views/                      # 页面视图
│   │   ├── ServerManager.vue       # 服务器管理视图
│   │   └── ToolExplorer.vue        # 工具探索视图
│   ├── router/                     # 前端路由配置
│   │   └── index.ts                # 路由定义
│   ├── stores/                     # 状态管理
│   │   └── server-store.ts         # 服务器状态管理（kebab-case命名）
│   ├── App.vue                     # 根组件
│   ├── main.ts                     # 前端入口
│   └── styles/                     # 样式文件
├── index.html                      # HTML模板
└── vite.config.ts                  # Vite配置

tests/                              # 测试结构
├── unit/                           # 单元测试
│   ├── services/                   # 服务测试
│   │   └── hub-manager.test.ts     # HubManager服务测试
│   └── utils/                      # 工具测试
│       └── config.test.ts          # 配置管理测试
├── integration/                    # 集成测试
│   ├── api/                        # API测试
│   │   └── gateway.test.ts         # Gateway集成测试
│   └── gateway/                    # Gateway测试
│       ├── mcp-connection.test.ts  # MCP连接测试
│       └── fault-tolerance.test.ts # 故障容忍测试
└── e2e/                            # 端到端测试
    └── dashboard/                   # Dashboard测试

scripts/                            # 工具脚本
└── validate-cleanup.js             # 清理验证脚本

package.json                        # 包配置
```

**Structure Decision**: MCP-HUB-LITE follows a simplified web application architecture with backend Fastify server and Vue 3 frontend dashboard. The structure separates concerns with dedicated directories for API (mcp/web separation), models, services, and web interface. CLI commands are implemented in a dedicated cli directory. Configuration is managed via simple JSON file operations without complex backup systems.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | All complexity has been removed through Muda analysis and YAGNI principle | N/A |