# Feature Specification: MCP-HUB-LITE：为独立开发者设计的MCP管理平台

**Feature Branch**: `001-develop`
**Created**: December 8, 2025
**Updated**: January 2, 2026
**Status**: Draft
**Input**: 用户需要设计一个mcp-hub，专门针对独立开发者的Lite版本，需要满足提供Server级别查询和分组，Tool名称或提示词的模糊查询，使用MCP HttpStream最新的协议提供对外接口，使得外部CLI或IDE可以复用；MCP-HUB-LITE中的MCP启动失败不影响MCP-HUB-LITE对外提供服务；MCP-HUB支持MCP-Inspector调试，支持MCP-PID的管理；

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - 独立开发者管理多个MCP Server (Priority: P1)

独立开发者作为MCP Hub的管理者，需要便捷地查看、组织和管理所有已配置的MCP Servers。

**Why this priority**: 这是核心功能，提供基础的管理视图和分组能力，帮助开发者理解当前所有可用的MCP服务

**Independent Test**: 可以完全测试通过以下操作：开发者能够查看所有MCP Server列表，按状态（online/offline/error）筛选，并验证每个Server的状态信息

**Acceptance Scenarios**:

1. **Given** 系统已启动并运行，**When** 开发者打开MCP-HUB-LITE界面，**Then** 应该显示所有已配置的MCP Server列表，包括Server名称、状态（运行中/停止/错误）和标签信息
2. **Given** 存在多个MCP Servers，**When** 开发者点击特定状态筛选，**Then** 应该仅显示该状态的MCP Servers
3. **Given** 有多个MCP Server正在运行，**When** 开发者查看任意Server的详情，**Then** 应该显示该Server的工具列表、配置信息和当前状态

---

### User Story 2 - 通过模糊搜索快速发现工具 (Priority: P1)

独立开发者需要快速找到某个功能的MCP Tool，而不需要知道该Tool隶属于哪个Server。同时，基于LLM的系统也需要能够搜索可用的工具。

**Why this priority**: 这是高效使用MCP生态系统的关键功能，解决"知道要做什么但不知道哪个工具能帮我做"的问题，支持人类开发和自动化LLM工作流

**Independent Test**: 可以完全测试通过模糊搜索功能，开发者能够搜索Tool名称和描述，并在结果中找到正确的工具，包括其归属的Server信息；LLM系统也能通过MCP JSON RPC 2.0协议成功调用搜索功能并获得结构化响应

**Acceptance Scenarios**:

1. **Given** 系统中有多个后端MCP Servers和大量Tools，**When** 开发者在Web界面输入关键词"search"，**Then** 应该返回所有Tool名称或描述中包含"search"的工具，包括工具名称、所属Server、标签和简要描述
2. **Given** 开发者输入部分关键词，**When** 系统执行模糊搜索，**Then** 应该支持部分匹配、大小写不敏感的简单匹配方式
3. **Given** 基于LLM的工具发送MCP list_tools请求，**When** 系统处理搜索请求，**Then** 应返回包含名称、描述、Server等元数据的MCP JSON RPC 2.0格式响应
4. **Given** 搜索结果有多条，**When** 开发者或LLM查看搜索结果，**Then** 应该按照相关性排序显示，并标明每个Tool的可用状态

**Implementation Notes**:
- 直接遍历搜索实现：基于字符串匹配的模糊搜索，支持工具名、描述、标签搜索
- 轻量级：无预构建索引，适用于50-200工具规模
- 性能目标：搜索响应时间<100ms，内存占用<30MB
- 仅通过tags键值对进行分类（已移除分组概念）

---

### User Story 3 - 作为MCP Gateway代理后端Servers (Priority: P1)

LLM或其他MCP Server通过MCP JSON RPC 2.0协议调用MCP-HUB-LITE，它作为Gateway代理调用后端的多个MCP Servers，提供统一的MCP接口。

**Why this priority**: 这是实现可复用生态系统的关键，让LLM能够通过标准化的MCP协议访问和调用所有后端MCP服务

**Independent Test**: 可以完全测试通过LLM或上游MCP Client发送MCP请求到MCP-HUB-LITE，获取Tools列表并成功调用，返回标准化的JSON RPC 2.0响应

**Acceptance Scenarios**:

1. **Given** LLM希望获取所有可用的Tools，**When** 发送MCP list_tools请求到MCP-HUB-LITE，**Then** 系统应以MCP JSON RPC 2.0格式返回所有Tools的列表，包括Tool名称、描述、所属Server和输入输出模式
2. **Given** 上游MCP Client需要调用特定Tool，**When** 发送MCP tool调用请求到Gateway，**Then** 系统应代理请求到后端对应MCP Server，并以JSON RPC 2.0格式返回结果
3. **Given** 开发者配置了多个后端MCP Servers，**When** 上游系统通过MCP协议连接Gateway，**Then** 应该能够访问所有后端Servers的工具，隐藏后端复杂性

---

### User Story 4 - 容错：单个MCP启动失败不影响系统服务 (Priority: P1)

当某个MCP Server启动失败或崩溃时，MCP-HUB-LITE应该继续对外提供服务。

**Why this priority**: 这是确保高可用性的核心功能，避免单点故障影响整个系统

**Independent Test**: 可以完全测试通过设置一个必然失败的MCP Server配置，然后验证其他Services正常工作，API对外响应正常

**Acceptance Scenarios**:

1. **Given** 系统配置了三个MCP Servers，其中一个配置错误，**When** 启动MCP-HUB-LITE，**Then** 系统应该能够正常启动并提供API服务，对服务器列表查询返回正确状态（一个错误，两个正常）
2. **Given** 正在运行的MCP Server突然崩溃，**When** 系统检测到崩溃，**Then** 应该立即标记该Server为错误状态，并更新API响应，同时不影响其他Servers的正常运行
3. **Given** 开发者尝试重新启动失败的MCP Server，**When** 点击重启操作，**Then** 系统应该提供重启结果反馈，但对其他服务（包括查询和搜索功能）无影响

**Implementation Note**: 使用Promise.allSettled聚合响应，无重试机制、无cooldown冷却逻辑

---

### User Story 5 - CLI命令管理 (Priority: P1)

独立开发者需要通过简洁的CLI命令快速管理MCP-HUB-LITE服务和MCP Servers。

**Why this priority**: 提供快速操作入口，降低学习成本，符合Unix哲学

**Independent Test**: 可以完全测试通过6个核心CLI命令的执行，验证命令功能正常

**Acceptance Scenarios**:

1. **Given** 系统未运行，**When** 执行 `mcp-hub-lite start`，**Then** 应该启动MCP-HUB-LITE服务并在后台运行
2. **Given** 系统正在运行，**When** 执行 `mcp-hub-lite status`，**Then** 应该显示服务状态和配置的MCP Servers列表
3. **Given** 系统正在运行，**When** 执行 `mcp-hub-lite ui`，**Then** 应该在默认浏览器中打开Web界面
4. **Given** 配置了多个MCP Servers，**When** 执行 `mcp-hub-lite list`，**Then** 应该列出所有MCP Servers及其状态
5. **Given** 某个MCP Server需要重启，**When** 执行 `mcp-hub-lite restart <server-id>`，**Then** 应该重启指定的MCP Server
6. **Given** 需要停止服务，**When** 执行 `mcp-hub-lite stop`，**Then** 应该安全关闭所有服务并退出

**Implementation Note**: 6个核心命令（start, stop, status, ui, list, restart），支持Windows、macOS、Linux跨平台

---

### Edge Cases

- **空配置场景**：当没有任何MCP Server配置时，系统提供启动页引导模式，显示欢迎界面和"快速开始"指南，辅助用户添加首个Server

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

#### 核心功能需求 (FR-001 至 FR-006)

- **FR-001**: 系统 MUST提供一个Web界面，采用左侧导航+右侧内容区的Dashboard设计，用于查看所有配置的MCP Server列表、状态和标签信息
- **FR-002**: 系统 MUST实现模糊搜索功能，支持对MCP Tool名称和描述进行部分匹配、大小写不敏感的搜索；系统须分离Web界面搜索（`/web/search`）和MCP协议搜索（`MCP list_tools`），避免响应格式适配复杂度
- **FR-003**: 系统 MUST以MCP Server形式运行，提供MCP JSON RPC 2.0协议接口，允许上游LLMs或MCP Clients查询所有可用的Tools；系统作为Gateway代理调用后端MCP Servers，返回统一格式的JSON RPC 2.0响应
- **FR-004**: 系统 MUST实现容错机制，确保单个MCP Server的启动失败、崩溃或无响应不影响其他Services的正常运行和对外API服务；使用Promise.allSettled聚合响应
- **FR-005**: 系统 MUST提供6个核心CLI命令：start（启动服务器）、stop（停止服务器）、status（查看运行状态）、ui（打开Web界面）、list（列出所有MCP Servers）、restart（重启服务器）
- **FR-006**: 系统 MUST支持通过包管理器全局安装，提供mcp-hub-lite全局命令，支持Windows、macOS、Linux跨平台部署

#### 前端技术栈需求 (FR-007 至 FR-010)

- **FR-007**: 系统前端组件 MUST使用Vue 3框架实现，而不是React或其他框架，以符合技术栈统一要求
- **FR-008**: 系统前端界面 MUST采用Element Plus UI组件库构建，提供一致的用户体验和丰富的组件支持
- **FR-009**: 系统Web界面 MUST主要面向桌面设备优化，支持主流浏览器，对平板设备提供基本支持，不强制要求移动设备完全响应式支持
- **FR-010**: 所有测试用例（包括单元测试、集成测试、端到端测试）MUST达到85%通过率，鼓励但不强制100%覆盖率，考虑独立开发者场景下的实用性

#### 配置管理需求 (FR-011 至 FR-012)

- **FR-011**: 系统 MUST提供配置管理功能，允许开发者添加、编辑、删除MCP Server配置，并支持简单配置导出功能；系统 MUST支持通过 `MCP_HUB_CONFIG_PATH` 环境变量自定义配置文件路径
- **FR-012**: 系统 MUST提供配置文件简单导出/导入功能，允许用户导出当前配置为JSON文件进行备份，用户手动管理备份文件

### Key Entities

- **MCP Server**: 代表一个正在运行的MCP服务器实例，包含名称、描述、状态、标签、可用工具列表和配置信息
- **MCP Tool**: 代表MCP Server提供的具体工具，包含工具名称、描述、输入输出模式、所属Server和权限信息

## 约束管理 *(mandatory)*

MCP-HUB-LITE 使用全局约束配置文件（`constraints.json`）以统一管理所有系统约束。该配置文件集中定义了性能、资源、可靠性、安全和协议方面的关键约束，并跟踪了约束变更历史。

所有系统约束均存储在项目根目录的 `constraints.json` 文件中，并在本规范的所有章节和成功标准中使用其 ID 进行引用。这确保了对系统约束的统一管理、可审计性和可测试性。

完整的约束列表和详细说明，请参见：
- **全局约束配置**: `/specs/001-develop/constraints/constraints.json`
- **约束变更日志**: `/specs/001-develop/constraints/change-log.md`

**约束分层说明**:
- **P1 (关键)**: 必须始终满足的核心约束，涉及安全、性能和可靠性
- **P2 (重要)**: 重要约束但可能有例外，需要管理层批准才能放宽
- **P3 (一般)**: 提升用户体验的可选约束，可根据需要略微放宽

## 环境变量与配置

### 核心环境变量

系统支持以下环境变量进行配置管理，这些变量可用于部署和运维场景：

#### 系统配置
- **MCP_HUB_CONFIG_PATH**: 自定义配置文件路径
  - 默认值: `~/.mcp-hub/config.json`
  - 用途: 指定系统配置和约束文件的存储路径

#### 网络与安全
- **MCP_HUB_PORT**: 服务端口号
  - 默认值: `7788`
  - 范围: `1024-65535`

- **MCP_HUB_HOST**: 服务绑定地址
  - 默认值: `localhost`
  - 取值: `localhost` | `0.0.0.0` | 具体IP地址

#### 日志与调试
- **MCP_HUB_LOG_LEVEL**: 日志级别
  - 默认值: `info`
  - 可选值: `error` | `warn` | `info` | `debug`

- **MCP_HUB_DEBUG**: 调试模式开关
  - 默认值: `false`
  - 功能: 启用详细的调试信息和堆栈跟踪

### 环境变量优先级

1. **命令行参数** (最高优先级): `--port 8080`
2. **环境变量**: `MCP_HUB_PORT=8080`
3. **配置文件**: config.json 中的设置
4. **默认值** (最低优先级): 系统内置默认值

## API 端点定义

### 服务器管理端点

#### 服务器列表
- **GET** `/api/servers`
- 功能: 获取所有配置的MCP服务器列表
- 参数: `tag` (可选，按标签键值对过滤)
- 响应: 服务器列表及其状态信息

#### 服务器管理
- **POST** `/api/servers`
- 功能: 添加新的后端MCP服务器
- 请求体: 服务器配置
- 响应: 添加后的服务器信息

- **GET** `/api/servers/{serverId}`
- 功能: 获取特定服务器的详细信息
- 响应: 服务器详细信息，包括工具列表

- **PUT** `/api/servers/{serverId}`
- 功能: 更新特定服务器的配置
- 请求体: 服务器更新配置
- 响应: 更新后的服务器信息

- **DELETE** `/api/servers/{serverId}`
- 功能: 从管理中移除MCP服务器
- 响应: 成功状态

#### 服务器控制
- **POST** `/api/mcp/servers/{serverId}/connect`
- 功能: 连接到MCP服务器
- 响应: 连接结果

- **POST** `/api/mcp/servers/{serverId}/disconnect`
- 功能: 断开MCP服务器连接
- 响应: 断开结果

### 工具搜索端点

#### Web搜索服务
- **GET** `/web/search`
- 功能: 跨所有服务器搜索工具（Web界面使用）
- 参数: `q` (搜索关键字)
- 响应: 搜索结果，包含工具信息、所属服务器

#### MCP协议搜索
- **MCP list_tools**
- 功能: MCP协议标准工具列表查询
- 响应: MCP JSON RPC 2.0格式的工具列表

### 系统管理端点

#### 状态查询
- **GET** `/api/mcp/status`
- 功能: 获取所有MCP服务器的连接状态
- 响应: 服务器状态列表

#### 配置管理
- **GET** `/api/config/export`
- 功能: 导出当前配置为JSON文件
- 响应: 配置文件下载

- **POST** `/api/config/import`
- 功能: 从上传文件导入配置
- 请求体: 配置文件
- 响应: 导入后的配置

## Success Criteria *(mandatory)*

### Measurable Outcomes

所有成功标准均引用全局约束配置的相应约束ID，以确保系统化管理和可追踪性。

- **SC-001** *(约束: performance.serverStatusUpdateDelay)*: 开发者能够在界面中查看所有MCP Server的实时状态，状态信息更新延迟不超过5秒（通过轮询实现）
- **SC-002** *(约束: reliability.serverListLoadTime)*: 系统支持管理多个MCP Server实例，Server列表加载时间不超过2秒
- **SC-003** *(约束: performance.searchResponseTime)*: Tool搜索功能在包含200工具的系统中，90%的查询在100毫秒内返回结果
- **SC-004** *(约束: reliability.apiErrorRate)*: 单个MCP Server故障不影响系统对外API响应，API错误率不超过1%
- **SC-005** *(约束: reliability.connectionSuccessRate)*: LLM或上游MCP Client通过MCP JSON RPC 2.0协议能够成功连接并获取数据，连接成功率达到99%
- **SC-006** *(约束: performance.gatewayLatency)*: MCP Gateway作为代理的平均响应延迟低于100毫秒，保持后端MCP Server性能

### Technology-Agnostic Metrics

- **可访问性**: Web界面在主流桌面浏览器中均可正常访问，主要面向桌面设备优化
- **可靠性**: 系统持续运行时间达到7x24小时，单次故障恢复时间不超过30秒
- **用户体验**: 新用户在5分钟内能够完成第一个MCP Server的添加和验证
- **集成性**: 支持至少3种不同类型的外部工具（IDE、CLI、自动化脚本）通过HttpStream协议集成
- **可维护性**: 关键错误信息清晰可读，包含错误码和解决建议，支持故障排除

### Assumptions

- 独立开发者主要使用Windows、macOS或Linux系统
- MCP-HUB-LITE部署在开发者本机或私有服务器上
- 外部工具遵循MCP HttpStream协议标准
- 开发者具有基本的命令行和配置管理技能
- 系统不需要实现用户认证（假设为单人使用场景）

### Dependencies

- 依赖MCP HttpStream协议规范的实现和文档
- 依赖MCP-Inspector工具的兼容性和API支持
- 依赖操作系统提供的进程管理接口（PID、资源监控）
- 依赖HTTPS/WebSocket等网络协议栈的稳定运行

---