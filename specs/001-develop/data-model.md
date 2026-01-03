# MCP-HUB-LITE 数据模型规范

## 概述

基于新架构设计，本规范定义了 MCP-HUB-LITE 的数据模型，采用简化设计以避免过度工程化问题。

## 实体定义

### 1. McpServer（MCP服务器实体）

**Description**: 代表一个正在运行的MCP服务器实例，包含名称、描述、状态、标签分类、可用工具列表和配置信息

**Fields**:
- `id: string` - 服务器唯一标识符
- `name: string` - 服务器显示名称
- `description: string` - 服务器描述信息
- `endpoint: string` - MCP服务器的URL端点（统一使用HTTP-Stream协议）
- `transport: 'http-stream'` - 协议传输类型（统一基于HttpStream的协议）
- `status: 'online' | 'offline' | 'error' | 'starting' | 'stopping'` - 服务器当前状态（简化状态枚举，移除degraded）
- `tags: Record<string, string>` - 用于分类的标签对象（取代分组概念），支持键值对形式的结构化标签，如 {"env": "production", "category": "database", "function": "api-server"}
- `tools: MCPTool[]` - 该服务器上可用工具的列表
- `config: object` - 连接到此服务器的配置参数
- `managedProcess: ManagedProcessConfig | null` - 与mcpServers配置结构一致的本地进程管理配置
- `pid: number | null` - 本地进程ID（如果本地管理）
- `cpuUsage: number` - 当前CPU使用百分比
- `memoryUsage: number` - 当前内存使用量MB
- `uptime: number` - 运行时长（秒）
- `lastHeartbeat: Date` - 最后成功通信的时间戳
- `healthCheckUrl: string | null` - 健康检查端点
- `capabilities: string[]` - 服务器能力标记（如'http-stream', 'process-managed'）

**简化设计说明** *(2025-12-15)*：
基于Kaizen分析和YAGNI原则，本实体已移除以下过度工程化字段：
- ❌ ~~`retryCount`~~ - 重试次数计数器（不必要的复杂性）
- ❌ ~~`cooldownUntil`~~ - 冷却时间机制（独立开发者场景无需此功能）
- ❌ ~~`degraded`状态~~ - 降级状态（简化状态管理）

**Validation**:
- `name` 必须为1-100字符之间
- `endpoint` 必须是有效的URL格式
- `status` 必须是定义的枚举值之一
- `tags` 用于分类和搜索（取代原有的分组机制）
- `transport` 必须是支持的传输协议列表中的值

### 2. McpTool（MCP工具实体）

**Description**: 代表MCP Server提供的具体工具，包含工具名称、描述、输入输出模式、所属Server和权限信息

**Fields**:
- `id: string` - 工具唯一标识符（通常为 serverId:toolName 格式）
- `name: string` - 工具名称
- `description: string` - 工具描述
- `serverId: string` - 父MCP服务器的引用
- `inputSchema: object` - 描述工具输入的JSON模式
- `outputSchema: object` - 描述工具输出的JSON模式
- `capabilities: string[]` - 能力或标签列表
- `status: 'available' | 'unavailable' | 'error'` - 当前可用性（简化状态，移除degraded）
- `callCount: number` - 调用次数统计
- `avgCallDuration: number` - 平均调用持续时间（毫秒）
- `errorCount: number` - 调用错误计数
- `deprecated: boolean` - 是否已弃用

**Validation**:
- `name` 必须为1-100字符之间
- `serverId` 必须引用有效的MCP服务器
- `inputSchema` 和 `outputSchema` 必须是有效的JSON模式
- 调用持续时间不能为负数

### 3. ManagedProcessConfig（托管进程配置）

**Description**: 与mcpServers配置结构一致的本地进程管理配置

**Fields**:
- `command: string` - 用于启动进程的命令（支持npx/uvx启动）
- `args: string[]` - 传递给进程的参数
- `env: object` - 环境变量配置
- `timeout: number` - 进程超时时间（秒）

### 4. Language Settings（语言设置）

**Description**: 用户对界面和MCP响应的语言偏好，支持动态切换

**Fields**:
- `id: string` - 语言设置唯一标识符
- `currentLanguage: 'zh-CN' | 'en-US'` - 当前选择的语言
- `browserDetection: 'zh-CN' | 'en-US' | null` - 从浏览器检测
- `userPreference: 'zh-CN' | 'en-US' | null` - 用户手动选择
- `updatedAt: Date` - 设置最后更新时间
- `autoDetect: boolean` - 是否自动检测语言
- `fallbackLanguage: string` - 回退语言

### 5. System Configuration（系统配置）

**Description**: 全局系统配置，包括日志、安全等设置

**Fields**:
- `logging: object` - 日志配置
  - `level: 'info' | 'warn' | 'error' | 'debug'` - 日志级别
  - `rotation: object` - 日志轮转设置
    - `enabled: boolean` - 是否启用轮转
    - `maxSize: string` - 最大文件大小（如"100MB"）
    - `maxAge: string` - 最大保留时间（如"7d"）
    - `compress: boolean` - 是否压缩
- `security: object` - 安全配置
  - `allowedNetworks: string[]` - 允许访问的网络地址列表
  - `maxConcurrentConnections: number` - 最大并发连接数
  - `connectionTimeout: number` - 连接超时时间（毫秒）
  - `idleConnectionTimeout: number` - 空闲连接超时时间（毫秒）
  - `maxConnections: number` - 最大连接数

## 实体关系定义 *(简化版)*

- **McpServer** **拥有多个** McpTool
- **McpServer** **通过标签** 进行分类（取代原有的 Group 关系）
- **ManagedProcessConfig** **关联至** McpServer（用于进程管理）
- **Language Settings** **独立实体** （全局语言配置）
- **System Configuration** **独立实体** （全局系统配置）

**简化说明** *(2025-12-15)*：
基于YAGNI原则，简化后的关系模型仅保留核心关联：
- ❌ ~~McpConnection实体~~ - 未使用的连接追踪（过度工程化）
- ❌ ~~Process实体~~ - 未使用的进程管理（通过ManagedProcessConfig即可满足需求）
- ❌ ~~MCP Gateway 路由关系~~ - 简化为直接关联

**当前5个实体的关系更为简洁清晰**，符合独立开发者场景的实际需求。

## 索引策略

- McpServer: endpoint（快速查找）、status（过滤）、tags（标签分类）
- McpTool: serverId（按服务器查询）
- McpConnection: clientId（跟踪）、isActive（过滤活跃连接）、protocol（协议过滤）
- Process: serverId（按服务器查询）、status（状态筛选）

**注意**：基于架构简化（2025-12-15），系统不再使用SearchIndex预构建索引，采用直接遍历工具列表进行搜索。

## 状态转换

### McpServer状态转换
```
offline → starting → online → stopping → offline
              ↘ error ↗       ↘ error ↗
                    ↘ degraded ↗
```

### Process状态转换
```
stopped → starting → running → stopping → stopped
              ↘ error ↗        ↘ error ↗
                    ↘ crashed ↗
```

### McpConnection状态转换
```
inactive → establishing → active → closing → inactive
                                    ↘ error ↗
```

## 与旧架构的差异

### 1. 移除的实体
- **Group 实体**：已移除，使用 `tags` 字段替代分组功能
- **搜索相关字段**：移除了 `searchScore`、`ftsVector`、`lastIndexed` 等预建索引字段

### 2. 简化的字段
- **Server实体**：移除了复杂的 `groupIds` 数组，使用简单的 `tags` 键值对对象
- **Tool实体**：移除了 `searchScore`、`ftsVector`、`lastIndexed`、`toolVersion` 等搜索相关字段

### 3. 简化的关联关系
- **服务器-标签**：1:N 关系，通过 `tags` 键值对实现灵活分类
- **工具搜索**：基于架构简化（第4节详细介绍），采用直接遍历搜索而非SearchIndex服务

**💡 说明**：2025-12-15架构优化后，已移除SearchIndex服务，采用直接遍历搜索，详见第4节"搜索索引简化设计"。

### 搜索索引简化设计

基于架构优化（2025-12-15），系统采用直接遍历实现而非SearchIndex服务。

## 数据验证规则

### 通用验证
- 所有 ID 字段：必须是有效的字符串格式
- 所有时间字段：必须是有效的 Date 对象或 ISO 8601 字符串
- 所有数值字段：必须是有效的数字且非负数（除非特别说明）

### 特定验证
- `McpServer.name`：1-100 字符
- `McpServer.endpoint`：有效的 URL 格式
- `McpTool.name`：1-100 字符
- `tags`：字符串数组，每个标签长度 1-50 字符

## 性能优化设计

### 1. 搜索性能
- 采用直接遍历搜索，无预构索引
- 支持 50-200 工具规模的即时搜索
- 预期响应时间 < 100ms（小规模场景）

### 2. 内存管理
- 无索引内存开销（纯动态搜索）
- 直接在工具列表上进行字符串匹配
- 支持Promise.allSettled聚合多Server结果

## 架构优势

1. **避免过度工程化**：移除不必要的分组实体
2. **简化数据结构**：减少字段数量，提高可维护性
3. **搜索简化**：移SearchIndex服务，改为直接遍历
4. **灵活性**：标签系统提供轻量级分类能力
5. **快速实现**：无复杂索引同步逻辑
---

## 搜索索引简化设计 *(2025-12-15)*

### 优化说明

基于Kaizen分析和YAGNI原则，原设计的SearchIndex 5层Map索引服务已被简化为**直接遍历工具列表**的简单搜索机制。

### 原有SearchIndex设计（❌已移除）

**移除的SearchIndex混合索引架构**：
- 5层Map索引：fullTextIndex、serverIndex、toolIndex、serverToTools、tagKeyIndex、tagValueIndex
- 词级别分词、多关键词AND查询、增量更新机制
- 使用Fuse.js全文检索
- 预期内存开销：60MB
- 复杂索引同步：100ms防抖更新

**移除原因**：
- 过度工程化：独立开发者实际使用50-200个工具，无需复杂索引
- 维护复杂：索引同步、防抖更新等逻辑增加系统复杂性和维护成本
- 性能足够：直接遍历<string, any>匹配即可满足需求

### 新的简化搜索设计（✅当前方案）

**直接遍历工具列表实现**：

```typescript
interface SimpleSearchService {
  async searchTools(query: string): Promise<McpTool[]> {
    const allTools = await this.getAllTools();
    const lowerQuery = query.toLowerCase();
    
    return allTools.filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description?.toLowerCase().includes(lowerQuery) ||
      Object.values(tool.tags || {}).some(tag => 
        tag.toLowerCase().includes(lowerQuery)
      )
    );
  }
}
```

**搜索能力**：
- **文本匹配**：tool.name、tool.description、tool.tags
- **大小写不敏感**：所有查询转为lowercase处理
- **模糊匹配**：使用includes()进行子串匹配
- **无分词**：不进行词级别分解，直接字符串包含判断

**性能预期**：
- **适用规模**：50-200个工具（独立开发者实际使用场景）
- **响应时间**：<100ms（直接遍历，无需索引构建）
- **内存占用**：无预构索引，纯动态搜索
- **并发支持**：Promise.allSettled聚合多Server结果

### 数据模型简化

**Tool模型（简化后）**：
```typescript
interface McpTool {
  // 基础字段
  name: string;
  description?: string;
  
  // 标签系统（简化搜索）
  tags?: Record<string, string>;
  
  // 移除的字段（❌已移除）：
  // - searchScore: number       // 无需排名得分
  // - ftsVector: string         // 无需全文索引
  // - lastIndexed: Date         // 无需索引时间
  // - toolVersion: string       // 无需版本控制
}
```

**Server模型（无变化）**：
```typescript
interface McpServer {
  id: string;
  name: string;
  type: 'node' | 'python';
  command: string;  // npx script 或 uvx script
  args?: string[];
  
  // 标签系统
  tags?: Record<string, string>;  // 简化：无groupIds
  
  // 工具列表
  tools?: McpTool[];
}
```

### 搜索API设计

**Web界面搜索**：
- **Endpoint**: `GET /web/search`
- **参数**: `?q=<keyword>&limit=<n>`
- **响应**: JSON数组，包含匹配的工具信息
- **用途**: 人类用户友好的表格显示

**MCP协议搜索**：
- **协议**: MCP JSON-RPC 2.0
- **调用**: `tools/list` (无搜索参数)
- **响应**: 标准JSON-RPC 2.0格式
- **用途**: LLM系统通过MCP协议获取工具列表

### 性能基准

| 工具数量 | 预期响应时间 | 内存占用 | 适用性 |
|----------|--------------|----------|---------|
| 50 | <20ms | ~1-2MB | ✅ 优秀 |
| 100 | <40ms | ~3-5MB | ✅ 良好 |
| 200 | <100ms | ~8-12MB | ✅ 可接受 |
| 300 | <200ms | ~15-20MB | ⚠️ 警戒线 |
| 500+ | >300ms | >25MB | ❌ 不推荐 |

**⚠️重要说明**：
- 直接遍历算法复杂度为 O(n)，大规模场景下性能会明显下降
- 200 个工具是本设计的安全边界，建议实际使用不超过300个工具
- 超过300个工具时，建议采用轻量级索引方案（如 Fuse.js）

### 升级路径

**触发条件**：
- 工具数量超过300个
- 搜索响应时间超过200ms
- 用户反馈搜索体验不佳

**升级方案**（可选）：
```typescript
interface UpgradedSearchService {
  // 阶段1：轻量索引（无Fuse.js）
  addLightIndex(query: string, tools: McpTool[]): void;
  
  // 阶段2：分词搜索（简单实现）
  tokenSearch(query: string): McpTool[];
}
```

### 结论

通过简化搜索索引实现，MCP-HUB-LITE大幅降低了系统复杂性：
- **内存节省**：60MB → 0-5MB（未索引时）
- **代码减少**：移除SearchIndex服务及相关同步逻辑
- **维护简化**：无需复杂防抖、索引更新机制
- **性能足够**：独立开发者场景下响应时间可接受

此设计遵循**YAGNI原则**，在保持足够功能的同时，极大简化了系统架构。
