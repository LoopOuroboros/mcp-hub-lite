# 变更记录

本文件的所有重要变更都将被记录在此。

## [1.2.2] - 2026-04-17

### 网关

- 添加 gatewayDebug 日志控制

### 前端

- 添加时间单位类型和转换工具
- 在设置页面添加 Startup 配置标签页

### 配置

- 修正配置加载器中的服务器排序

### 启动

- 提取 ensureServerInstances() 以消除 DRY 违反
- 将启动编排逻辑提取到专用模块

### 资源

- 确保资源读取 API 中 { contents: [...] } 格式一致

### 日志

- 添加 STDERR 日志模块用于 stdio 传输

### 连接

- 将 connect() 拆分为符合 SRP 的私有方法

### 其他

- 更新 2026-04-15 到 2026-04-17 的变更记录
- 添加 LinuxDo 社区致谢

---

## [1.2.0] - 2026-04-14

### 核心

- 添加 normalizeToolName 支持跨格式工具名称匹配

### 命令行

- 添加 tool-use 命令用于 MCP 服务器工具操作
- 修复 Windows/npm symlink 环境下的 CLI 入口检测
- 修复命令计数并将 mcpToolUseCommand 重命名为 toolUseCommand

### 配置

- 将配置加载日志从 info 级别改为 debug 级别

### 系统工具

- 将 list_tools_in_server 重命名为 list_tools

### 文档

- 完成所有子模块的 CLAUDE.md 文档
- 更新 v1.2 版本的变更记录和 README

### 工具

- 为 normalizeToolName 函数添加单元测试

---

## [1.1.1] - 2026-04-14

### 网关

- 实现 per-request transport 模式以修复连接错误

### 前端

- 防止 groupedTools 中 tool 为 undefined 时的运行时错误

---

## [1.1.0] - 2026-04-13

### 资源

- 实现 MCP 原生资源转发

### 网关

- 限制 call_tool 调用系统工具
- 对缺失 Accept 头返回 400
- 将版本和协议版本提取到共享工具
- 仅包含配置了 allowedTools 的服务器的工具

### 安全

- 在配置变更日志中屏蔽敏感值

### 配置

- 保存配置时对 env 和 headers 键进行排序
- 实现 v1.1 实例配置系统
- 增强实例管理，添加显示名称和路由选择
- 保存配置时清理空值
- 在 ServerInstanceConfig 中添加 index 和 displayName 以及重新分配 API
- 添加 v1.1 配置模式与自动迁移支持
- 将实例选择策略移至模板
- 完成 v1.1 多实例配置重构
- 激活 v1.1 配置格式以支持实例
- 激活 v1.1 配置格式，移除 v1.0 兼容代码
- 确保配置加载和迁移时服务器实例索引正确
- 支持字符串索引类型用于服务器实例操作
- 使用内容哈希统一实例 ID 生成

### 代理

- 为 SSE 和 Streamable HTTP 传输添加代理配置支持

### 传输

- 添加 LineBuffer 用于正确的 stderr 行缓冲
- 使用官方 SDK StdioClientTransport
- 记录非 JSON-RPC 的 stdout 并统一 stderr 日志级别

### 前端

- 添加实例标签页路由同步
- 修复工具和资源在服务器详情中不显示的问题
- 在 ConfigTemplateForm 中添加 description 字段
- 改进实例状态响应性和管理
- 添加底部内边距以防止滚动时保存按钮被截断
- 修复组件事件处理器中的 TypeScript 类型错误
- 确保日志查看器区域填满可用容器高度
- 优化英文环境下的实例列表显示并隐藏冗余的 Running 标签
- 修正深色模式背景颜色并优化实例 UI
- 改进类型声明并提高类型安全
- 直接从 server.instances 计算实例数量

### UI 组件

- 添加服务器实例管理 UI 组件
- 添加标签管理 UI 和 TagManager 组件
- 在 AddServerModal 中添加 description 字段支持
- 更新资源详情和列表视图以集成 hub tools

### 国际化

- 改进 noToolsFound 消息以反映工具聚合
- 修正 InstanceConfig 组件中缺失的翻译键
- 修正 headers 标签并在服务器配置中添加按钮文本

### 会话

- 从会话管理中移除 cwd 和 project 字段
- 移除会话持久化机制并使用 SDK 原生无状态模式
- 移除会话持久化机制

### 系统工具

- 实现实例选择策略
- 添加 update_server_description 系统工具
- 支持 toolArgs 和 arguments 以保持向后兼容
- 在 getTool 中添加 MCP_HUB_LITE_SERVER 处理
- listServers 仅返回已连接的服务器
- 重构核心 hub tools 服务架构
- 增强系统工具处理和 API 端点
- 在 selectBestInstance 中添加非严格模式
- 优化 hub tools 服务和 API
- 简化系统工具 API 并提高类型安全

### MCP 状态

- 防止连接/断开时自动更新 enabled 字段

### 连接

- 改进 serverId 处理和协议版本支持

### 搜索

- 移除复杂搜索模块，简化为字符串匹配
- 使用服务器级缓存简化搜索逻辑

### 测试

- 移除不符合 MCP 规范的评估测试

### 核心

- 使用复合键 serverName-serverIndex 替代 serverId

### 文档

- 更新搜索功能描述
- 更新日志和 composables 的 CLAUDE.md 文档
- 更新 v1.1 配置重构的 CLAUDE.md 文档
- 更新 CLAUDE.md 文件以反映会话移除
- 更新项目模块的 CLAUDE.md 文件
- 更新 CLAUDE.md 文件以反映最近的 v1.1 配置变更
- 使用格式改进和新内容更新 CLAUDE.md 文件

### 使用指南

- 将使用指南从 13 节压缩到 7 节

### 工具

- 处理 updateServerDescription 中的嵌套 toolArgs
- 使用 mocks 简化 ServerStatusTags 测试
- 优化 updateServerInstance 日志

### Lint

- 为缺失的 .eslintrc-auto-import.json 添加后备方案

### 状态

- 在状态中显示所有配置的服务器，包括禁用的

---

## [1.0.2] - 2026-03-15

### 会话

- 在会话管理器中添加 capabilities 支持
- 在会话模型中添加 capabilities 字段
- 简化 sessionId 生成

### 网关

- 添加初始化通知和 capabilities 处理
- 清理弃用方法并更新工具缓存访问
- 启用初始化通知测试

### 客户端

- 添加 capabilities 和项目推断

### UI

- 在 SessionsView 中添加 capabilities 显示
- 修正 ServerDetail 中 ToolCallDialog 的 serverName prop

### 系统工具

- 将动态资源列表简化为仅服务器元数据

### 核心

- 更新会话和客户端迁移的核心模块

### 客户端追踪

- 移除弃用的客户端追踪和存储

### 会话迁移

- 从 mcp-session-manager 迁移到 session-tracker 服务

### API

- 使 MCP 通信调试日志可配置

---

## [1.0.1] - 2026-03-15

### UI

- 修复设置页面中环境变量值输入显示

### 系统工具

- 解决系统工具调用验证错误

---

## [1.0.0] - 2026-03-15

### UI

- 改进仪表板和服务器状态标签
- 改进设置页面 UI 和开发模式处理
- 在设置中添加新日志配置选项
- 改进资源视图，使用表格布局
- 改进工具调用对话框和系统工具显示
- 增强服务器卡片和交互
- 使用 i18n 和响应显示增强工具调用对话框
- 添加带 i18n 支持的服务器状态标签组件
- 使用新布局结构更新 App.vue

### 命令行

- 增强状态命令的格式化输出
- 为 CLI 命令添加全面的单元测试
- 确保 CLI 命令在执行后正确退出
- 修复服务器启动和日志 ANSI 颜色问题

### 日志

- 增强 stdio 传输的日志存储集成
- 在 MCP 响应日志中过滤二进制图像数据
- 增强 JSON 美化输出处理换行符
- 改进 MCP 网关日志
- 统一开发模式检测并移除 devLogFile 配置
- 统一日志配置系统
- 提取并统一 MCP 通知消息处理
- 使用 MCP_COMM_DEBUG 环境变量控制通信日志
- 将日志文件命名改为时间戳格式
- 在日志语句中添加缺失的 subModule 上下文
- 将单体日志记录器拆分为模块化结构
- 增强 SSE 流管理和响应日志
- 提取公共日志方法以消除代码重复
- 优化日志详细程度
- 优化日志选项提取
- 使用缓存命中指示器优化 getTools/getResources 日志和资源缓存改进
- 改进 stderr 日志级别检测逻辑
- 在 connection-manager 中使用 getMcpCommDebugSetting()
- 使用 stringifyForLogging 处理网关头并改进 rawHeaders 可读性
- 增强开发服务器日志和热重载
- 组织文件结构并增强日志
- 优化工具/列表响应的日志记录
- 更新配置路径和日志文档

### 配置

- 使用新日志选项扩展配置模式
- 为 MCP 网关添加可配置会话超时
- 简化配置管理器实现
- 使用默认配置在验证失败时
- 防止自动创建配置文件并添加错误日志
- 在 updateConfig 方法中添加立即保存选项
- 优化备份系统，使用缓存和编译阶段处理
- 优化备份逻辑并实现延迟初始化
- 跳过默认配置的备份创建
- 移除延迟保存机制
- 修正配置路径

### 会话

- 统计过期会话并使用配置刷新间隔
- 在恢复期间跳过过期会话
- 增强会话 ID 提取，支持请求头和更好的后备逻辑
- 增强会话持久化和清理逻辑
- 增强会话管理与一致性检查和请求头处理
- 实现全面的会话持久化和管理
- 实现会话持久化和配置管理
- 简化会话匹配逻辑
- 将会话管理器提取为模块化结构

### SSE

- 添加连接超时配置和重新连接检测
- 移除 SSE 连接时间戳追踪
- 改进类型处理和 SSE 日志

### 类型系统

- 在前端 ToolsView 中为 JsonSchema 添加类型安全
- 全面的 eslint no-explicit-any 修复和类型安全改进
- 为前后端集成建立共享类型系统

### 系统工具

- 引入统一系统工具处理程序和带前缀的工具名称支持
- 使用集中常量实现系统工具框架

### 文档

- 增强文档和系统配置
- 添加服务器描述字段和资源详情改进
- 更新项目文档和配置

### 请求头

- 添加 rawHeaders 操作以进行会话请求头传播

### 工具

- 在工具模型中添加 serverName 字段并实现服务器级缓存

### 可观测性

- 增强 OpenTelemetry 集成和日志系统
- 添加 OpenTelemetry 追踪支持
- 将追踪导出器简化为仅控制台和 OTLP
- 移除 OpenTelemetry 和遥测功能

### 日志记录器

- 在日志记录器中添加 subModule 支持并更新 WebSocket 日志
- 添加 LOG_MODULES 上下文并更新 hub-manager 服务测试

### 搜索

- 实现简单的搜索服务用于基本工具发现
- 使用搜索集成增强工具调用对话框和工具视图
- 实现跨 MCP 服务器的综合搜索功能

### WebSocket

- 添加服务器更新事件监听器

### 工具视图

- 使用基于 serverName 的分组增强工具视图
- 增强工具调用对话框和工具视图与搜索集成

### 批量操作

- 使用单次保存和并发启动优化批量导入

### 服务

- 添加 hub 管理器和搜索核心服务

### API

- 增强 MCP 网关和 Web API 端点

### 客户端追踪

- 增强客户端追踪和连接管理

### 前端存储

- 添加工具调用存储和 websocket 工具

### 客户端

- 添加客户端版本显示
- 在服务器列表中添加手动保存按钮
- 添加客户端管理功能

### 国际化

- 添加多语言支持并更新 UI 组件
- 为服务器管理操作添加国际化支持

### 服务器管理

- 增强系统配置管理和服务器管理功能
- 增强服务器管理功能，添加超时和自动启动配置
- 优化服务器详情页面状态显示和正常运行时间计算

### 工具管理

- 实现综合工具搜索和管理系统

### 工具网关

- 实现工具网关并重构导航

### MCP 服务器

- 添加服务器自动启动配置并重构 MCP 网关传输
- 添加服务器版本信息显示功能
- 实现 MCP 服务器日志页面以显示完整日志
- 添加服务器配置超时设置功能
- 重构 MCP 连接管理和传输层，添加资源模型支持
- 修复自动启动不工作和侧边栏显示问题

### 资源

- 在标签页中显示工具和资源计数
- 添加 MCP 资源支持与 UI 和 API 端点

### 传输

- 为 Microsoft Learn MCP Server 添加 Streamable HTTP 传输支持

### 前端工具

- 添加远程服务器支持和 HTTP 工具
- 保存开发进度，包含 UI 增强和新组件
- 完成前端架构重构并实现新 UI 组件
- 在前端代码中使用共享类型
- 使用模块特定别名增强路径别名系统
- 将仪表板和头部组件重命名为 view 后缀
- 前端代码清理和改进
- 增强网关和 hub tools 服务的类型安全

### 实现里程碑

- 完成支持多服务器的 MCP Hub Lite 实现
- 简化架构并增强 CLI 状态命令
- 增强 CLI，添加 i18n，更新配置和清理
- 实现 PID 管理和 stop/restart 命令
- 实现 CLI 命令 (start, list, status, ui)
- 实现容错和健康检查
- 实现带 stdio 支持的 MCP 流式网关
- 实现 MCP 连接和工具搜索
- 完成第 3 阶段服务器管理实现
- 完成第 1 和第 2 阶段（基础设施、模型、配置）

### 测试

- 解决配置管理器间歇性测试失败
- 通过为 ConfigManager 实现延迟初始化防止测试污染
- 解决单元测试中的 TypeScript 类型错误
- 修复 runner.test.ts 中缺少 logger.setLevel 方法和 system.logging 属性的 mock 配置
- 更新所有测试以包含 serverName 字段
- 添加全面的工具单元测试
- 添加全面的服务器运行器单元测试
- 添加全面的前端和后端测试基础设施
- 修复 lint:log 命令和 ESLint 配置
- 添加评估测试文件

### Element Plus

- 实现 Element Plus 自动导入

### 导入

- 使用路径别名替换相对导入

### Vitest

- 将临时目录添加到测试覆盖路径
- 从主 tsconfig 中排除前端单元测试

### 图像

- 移除未使用的图像

### 索引

- 更新项目索引并修复文档拼写错误
- 更新项目 AI 上下文文档

### 调试

- 移除网关中的重复调试日志
- 修复 ESM 导入并优化 CLI 启动性能
- 使用配置 getter 模式解决 config-logger 循环依赖

### 错误修复

- 修复 SettingsView 中 el-input-number 宽度问题
- 在 ReadMcpResourceTool 响应中添加缺失的 uri 字段
- 修正工具调用对话框中 serverName 的使用
- 修正 applyFilters 中的变量声明
- 修正 SettingsView 计算属性中的配置路径
- 确保为新服务器将 allowedTools 初始化为空数组
- 修复前端中工具聚合切换逻辑
- 修复仪表板和 ServerDetail 中的日志加载问题
- 修复服务器删除功能的两个问题
- 修复 CLI 命令执行后挂起的问题
- 在 index.ts 中添加缺失的 PidManager 导入
- 修复 app.ts 中缺失的导入

### 后端

- 在后端代码中使用共享类型

### 架构

- 建立前后端集成的共享类型系统

### 类型安全

- 改进系统工具类型安全和命名
- 优化配置和日志系统
- 增强测试覆盖率和 SDK 辅助工具
- 改进配置和遥测
- 优化连接管理逻辑
