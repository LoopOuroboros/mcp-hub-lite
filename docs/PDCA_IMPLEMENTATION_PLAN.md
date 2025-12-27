# MCP Hub Lite PDCA Implementation Plan

基于IMPLEMENTATION_PLAN.md文档，针对每个Phase使用PDCA循环进行开发，确保每个循环都通过`npm build success`和`npm test success`。

## Phase 1: 项目初始化 PDCA循环

### PLAN
- **目标**: 搭建项目基础，集成最新依赖，配置开发工具链
- **关键任务**: 目录结构、TypeScript/Vite配置、MCP SDK集成、ESM规范、Vitest配置、Git hooks
- **依赖策略**: 所有依赖使用最新稳定版本，特别关注MCP SDK兼容性
- **成功标准**: `npm run build` 和 `npm test` 成功，ESM规范验证通过

### DO
- 创建统一目录结构 (`src/`, `frontend/`, `tests/`, `docs/`)
- 初始化package.json，安装最新版本依赖
- 配置TypeScript strict模式
- 配置Vite构建系统
- 集成ESLint + Prettier代码规范
- 配置Vitest测试框架和覆盖率
- 设置Husky预提交hooks
- 创建基础测试验证配置

### CHECK
- 验证 `npm run build` 成功 (exit code 0)
- 验证 `npm test` 成功 (exit code 0)
- 验证 `npm run lint` 通过
- 验证 `npm run validate:esm` 通过
- 检查依赖版本兼容性

### ACT
- **成功**: 标准化配置，更新文档，进入Phase 2
- **失败**: 分析失败原因，调整依赖版本或配置，重新执行

## Phase 2: 核心模型与配置 PDCA循环

### PLAN
- **目标**: 建立数据基础和配置管理，为US1-US4提供支撑
- **关键任务**: McpServer/McpTool模型、Zod配置验证、环境变量支持、基础工具模块
- **依赖策略**: 使用最新Zod版本进行配置验证
- **成功标准**: 模型类型安全，配置验证通过，测试覆盖100%

### DO
- 实现 `src/models/server.model.ts` 和 `src/models/tool.model.ts`
- 创建Zod schema验证 (`src/config/config.schema.ts`)
- 实现JSON配置文件管理 (`src/config/config.manager.ts`)
- 添加环境变量支持 (MCP_HUB_CONFIG_PATH, PORT, HOST, LOG_LEVEL)
- 实现基础工具模块 (Logger, Validation, Process)
- 编写单元测试覆盖所有模型和配置功能

### CHECK
- 验证 `npm run build` 成功 (类型安全)
- 验证 `npm test` 成功 (模型和配置测试通过)
- 验证配置验证功能正常工作
- 验证环境变量覆盖功能

### ACT
- **成功**: 标准化数据模型和配置系统，进入Phase 3
- **失败**: 修复类型错误或验证逻辑，重新执行

## Phase 3: Server管理功能 PDCA循环

### PLAN
- **目标**: 实现US1 - 独立开发者管理多个MCP Server
- **关键任务**: HubManager服务、REST API端点、Vue3前端、Pinia状态管理
- **依赖策略**: 使用最新Fastify、Vue3、Element Plus、Pinia版本
- **成功标准**: Server CRUD操作正常，前后端集成测试通过

### DO
- 实现HubManager服务 (`src/services/hub-manager.service.ts`)
- 创建REST API端点 (GET/POST/PUT/DELETE /api/servers)
- 实现Vue3 ServerManager视图 (`frontend/src/views/ServerManager.vue`)
- 配置Pinia状态管理 (`frontend/src/stores/server.store.ts`)
- 集成Element Plus组件
- 配置前端路由
- 编写集成测试验证前后端交互

### CHECK
- 验证 `npm run build` 成功 (前后端编译通过)
- 验证 `npm test` 成功 (单元测试通过)
- 验证 `npm run test:integration` 成功 (API端点测试通过)
- 验证前端界面正常显示Server列表
- 验证CRUD操作功能正常

### ACT
- **成功**: 标准化Server管理功能，进入Phase 4
- **失败**: 修复API或前端集成问题，重新执行

## Phase 4: 工具搜索功能 PDCA循环

### PLAN
- **目标**: 实现US2 - 快速发现MCP工具（Web界面 + MCP协议）
- **关键任务**: DirectSearch服务、双API设计、前端搜索组件、性能优化
- **依赖策略**: 使用最新搜索算法库，确保<100ms响应时间
- **成功标准**: Web搜索和MCP协议搜索都正常工作，性能达标

### DO
- 实现SimpleSearch服务 (`src/services/simple-search.service.ts`)
- 创建字符串匹配算法 (name, description, tags)
- 实现双API: `/web/search` (Web) 和 `MCP list_tools` (协议)
- 开发SearchBox组件和ToolResult视图
- 配置Pinia搜索状态管理
- 编写性能测试验证<100ms响应时间

### CHECK
- 验证 `npm run build` 成功
- 验证 `npm test` 成功 (搜索逻辑测试通过)
- 验证 `npm run test:performance` 成功 (<100ms响应时间)
- 验证Web界面搜索功能正常
- 验证MCP协议搜索返回正确JSON-RPC 2.0格式

### ACT
- **成功**: 标准化搜索功能，进入Phase 5
- **失败**: 优化搜索算法或修复协议格式问题，重新执行

## Phase 5: MCP Gateway代理 PDCA循环

### PLAN
- **目标**: 实现US3 - 作为MCP Gateway代理后端Servers
- **关键任务**: StreamingGateway服务、JSON-RPC 2.0协议处理、双轨错误码系统
- **依赖策略**: 基于POC-01的Fastify Gateway实现，使用最新MCP SDK
- **成功标准**: MCP客户端能正常连接和调用Tools，协议合规性100%

### DO
- 实现StreamingGateway服务 (`src/services/streaming-gateway.service.ts`)
- 处理JSON-RPC 2.0协议请求和响应
- 实现请求路由和代理 (基于serverId)
- 创建双轨错误码系统 (内部6000-6999, 外部-32001/-32801)
- 编写MCP协议合规性测试
- 集成真实MCP客户端进行端到端测试

### CHECK
- 验证 `npm run build` 成功
- 验证 `npm test` 成功 (单元测试通过)
- 验证 `npm run test:compatibility` 成功 (MCP协议100%合规)
- 验证Gateway延迟<100ms
- 验证MCP客户端能正常获取Tools列表和调用Tools

### ACT
- **成功**: 标准化Gateway功能，进入Phase 6
- **失败**: 修复协议处理或错误码映射问题，重新执行

## Phase 6: 容错机制 PDCA循环

### PLAN
- **目标**: 实现US4 - 单个MCP Server失败不影响整体系统
- **关键任务**: Promise.allSettled聚合、Server状态跟踪、健康检查、容错测试
- **依赖策略**: 使用原生Promise.allSettled，无需额外依赖
- **成功标准**: 系统在Server故障时仍能正常运行，API错误率<1%

### DO
- 在HubManager服务中实现Promise.allSettled聚合响应
- 实现Server状态跟踪 (online/offline/error)
- 添加启动失败隔离处理
- 创建健康检查端点 (`GET /health`)
- 编写容错集成测试 (混合状态、故障恢复)

### CHECK
- 验证 `npm run build` 成功
- 验证 `npm test` 成功 (容错逻辑测试通过)
- 验证 `npm run test:integration` 成功 (容错场景测试通过)
- 验证配置错误Server时系统仍能正常启动
- 验证API错误率<1%

### ACT
- **成功**: 标准化容错机制，进入Phase 7
- **失败**: 修复状态跟踪或聚合逻辑问题，重新执行

## Phase 7: CLI命令 PDCA循环

### PLAN
- **目标**: 实现6个核心CLI命令，支持快速操作
- **关键任务**: CLI架构、6个命令实现、跨平台支持、全局安装
- **依赖策略**: 使用最新commander.js或类似CLI框架
- **成功标准**: 所有6个命令工作正常，支持Windows/macOS/Linux

### DO
- 实现CLI核心架构 (`src/cli/index.ts`)
- 开发6个命令: start, stop, status, ui, list, restart
- 配置package.json bin字段
- 测试跨平台兼容性
- 验证全局安装功能

### CHECK
- 验证 `npm run build` 成功
- 验证 `npm test` 成功 (CLI命令测试通过)
- 验证全局安装后命令可用
- 验证跨平台功能正常
- 验证命令输出清晰易读

### ACT
- **成功**: 标准化CLI功能，进入Phase 8
- **失败**: 修复跨平台或命令逻辑问题，重新执行

## Phase 8: 集成测试与优化 PDCA循环

### PLAN
- **目标**: MVP交付准备，确保质量和性能
- **关键任务**: 完整测试套件、性能基准、文档生成、质量门禁
- **依赖策略**: 使用最新测试和监控工具
- **成功标准**: 所有验收标准达成，代码覆盖率>85%

### DO
- 执行完整测试套件 (单元+集成+E2E)
- 运行性能基准测试 (Gateway<100ms, Search<100ms)
- 验证TypeScript strict mode
- 生成代码覆盖率报告
- 执行用户验收测试 (所有US1-US4场景)
- 完善构建系统
- 生成技术文档和用户文档

### CHECK
- 验证 `npm run build` 成功
- 验证 `npm test` 成功 (覆盖率>85%)
- 验证 `npm run test:performance` 成功 (性能指标达标)
- 验证 `npm run test:compatibility` 成功 (MCP协议合规)
- 验证所有P1用户故事通过验收
- 验证CLI命令全部工作正常

### ACT
- **成功**: MVP版本完成，准备发布
- **失败**: 修复未达标的功能或性能问题，重新执行

## 通用PDCA执行原则

### 依赖版本管理
- 所有依赖使用最新稳定版本 (`npm install package@latest`)
- 在`npm build`过程中检查兼容性问题
- 如遇兼容性问题，优先尝试调整配置而非降级版本
- 记录实际使用的依赖版本到package-lock.json

### 质量保证
- 每个PDCA循环必须通过`npm run build`和`npm test`
- 严格遵循项目ESM模块规范 (R001-R008)
- 遵循TypeScript严格模式和双轨API类型系统
- 保持代码覆盖率>85%
- 遵循TDD三步循环：编写测试→测试失败→编写代码

### 验证流程
```bash
# 每个Phase结束后的标准验证流程
npm run typecheck    # TypeScript编译检查
npm test            # 单元测试
npm run test:integration  # 集成测试
npm run lint        # 代码规范检查
npm run validate:esm      # ESM规范验证
```

### 风险缓解
- **MCP SDK集成风险**: 提前研究协议文档，基于POC-06测试结果开发
- **协议兼容性风险**: 实现完整契约测试，双轨错误码确保兼容
- **性能风险**: 持续性能监控，确保关键指标达标
- **跨平台风险**: 在多平台环境中测试验证