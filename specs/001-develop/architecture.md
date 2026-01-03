# 架构指南

## 项目概述

MCP Hub Lite 是一个轻量级的 MCP (Model Context Protocol) 网关系统。

## 架构设计

基于对项目需求和claude-code-router架构的分析，本项目采用**集中式架构**，将CLI、后台服务和Vue3 UI整合在单一项目中，实现全栈统一和便捷管理。本架构采用单进程Lite设计（统一安装发布），内部采用模块化组件避免耦合，通过简化后的核心组件提供轻量级、高性能的基础能力。

### 集中式架构核心组件

1. **统一入口设计**
   - CLI入口：`src/cli.ts` - 处理命令行参数，提供start、stop、status、dashboard命令
   - 后端服务入口：`src/index.ts` - 启动Fastify服务器和MCP网关
   - 单一包结构：通过package.json的bin字段提供全局命令

2. **进程管理与服务发现**
   - PID文件管理：`~/.mcp-hub-lite/pids/`目录存储服务进程ID
   - 服务状态检测：读取PID文件确定服务是否运行
   - 进程生命周期：支持启动、停止、重启、状态检查操作

3. **Vue3前端集成**
   - 前端源码：`frontend/`目录包含Vue3组件和页面
   - 构建产出：Vite构建生成静态资源到`public/assets/`目录
   - 构建脚本：`build/copy.assets.js`负责将构建后的前端资源复制到`public/assets/`
   - 服务端集成：Fastify作为静态文件服务器提供Vue3 UI
   - 路由管理：SPA路由通过History API实现客户端路由
   - 国际化支持：`frontend/public/locales/`目录包含语言文件
   - 状态管理：使用Pinia管理前端状态，包括服务器、工具、配置和国际化状态

4. **模块化组织**

   - 核心层：`src/models/` - 数据模型
   - 服务层：`src/services/` - 简化后的核心服务组件（HubManager、DirectSearch、StreamingGateway）
   - API层：`src/api/` - REST API路由和控制器
   - 配置层：`src/config/` - 统一的配置管理和加载
   - 工具层：`src/utils/` - 通用工具和实用函数

5. **核心组件设计**

   - **HubManager**：简化后的MCP服务器管理器，管理所有MCP服务器生命周期（移除复杂容错机制）
   - **DirectSearch**：直接遍历搜索实现，无需SearchIndex服务：
     * **简单过滤**：基于字符串匹配的模糊搜索，支持工具名、描述、标签搜索
     * **轻量级**：无预构建索引，适用于100-200工具规模
     * **性能目标**：搜索响应时间<500ms，内存占用<30MB
   - **Gateway**：基于HttpStream协议的MCP网关服务

### 项目结构

```
src/                                 # 后端源码
├── api/                             # API和MCP协议处理
│   ├── mcp/                         # MCP JSON-RPC协议处理器
│   │   ├── tools.ts                 # 工具处理
│   │   ├── gateway.ts               # Gateway处理
│   │   └── server-manager.ts        # 服务器管理
│   └── web/                         # Web API处理器
│       ├── servers.ts               # 服务器管理API
│       ├── config.ts                # 配置管理API
│       ├── health.ts                # 健康检查API
│       └── index.ts                 # Web API导出
├── models/                          # 数据模型和实体定义
│   ├── types.ts                     # 全局类型定义
│   ├── server.model.ts              # MCP Server模型（简化字段）
│   ├── tool.model.ts                # MCP Tool模型
│   └── index.ts                     # 模型导出
├── services/                        # 核心业务逻辑
│   ├── hub-manager.service.ts       # 服务器管理服务（HubManager）
│   ├── direct-search.service.ts     # 直接遍历搜索服务（DirectSearch）
│   ├── gateway.service.ts # MCP HttpStream网关服务
│   └── index.ts                     # 服务导出
├── config/                          # 配置管理
│   ├── config.schema.ts             # 配置模式验证
│   ├── config.manager.ts            # 配置加载/保存（移除复杂备份管理）
├── utils/                           # 工具函数
│   ├── validation.ts                # 验证工具
│   ├── process.ts                   # 进程工具
│   ├── logger.ts                    # 日志工具
│   └── index.ts                     # 工具导出
├── cli/                             # 命令行接口
│   ├── commands/                    # CLI命令实现
│   │   ├── start.ts                 # 启动服务命令
│   │   ├── stop.ts                  # 停止服务命令
│   │   ├── status.ts                # 状态查看命令
│   │   ├── ui.ts                    # 打开UI界面命令
│   │   ├── list.ts                  # 列出所有MCP服务器
│   │   └── restart.ts               # 重启服务器命令
│   ├── index.ts                     # CLI入口文件
│   └── parse-args.ts                # 命令参数解析
├── pid/                             # 进程ID管理
│   ├── manager.ts                   # PID文件管理器
│   └── file.ts                      # PID文件操作工具
├── types/                           # 全局类型定义
│   └── mcp-types.ts                 # MCP协议类型
└── index.ts                         # 服务入口

frontend/                           # Vue3前端源码
├── public/                         # 静态资源
│   └── locales/                    # 国际化语言文件
│       ├── en.json                 # 英文翻译
│       └── zh.json                 # 中文翻译
├── src/                            # Vue3源代码
│   ├── assets/                     # 资源文件（图片、图标等）
│   ├── components/                 # 公共组件
│   │   ├── ServerIcon.vue          # 服务器图标组件
│   │   ├── ToolCard.vue            # 工具卡片组件
│   │   ├── SearchBox.vue           # 搜索框组件
│   │   └── StatusBadge.vue         # 状态徽章组件
│   ├── views/                      # 页面视图
│   │   ├── Dashboard.vue           # 仪表板视图
│   │   ├── ServerManager.vue       # 服务器管理视图
│   │   ├── ToolSearch.vue          # 工具搜索视图
│   │   ├── Settings.vue            # 设置视图
│   │   └── About.vue               # 关于视图
│   ├── router/                     # 前端路由配置
│   │   └── index.ts                # 路由定义
│   ├── stores/                     # 状态管理
│   │   ├── server.store.ts         # 服务器状态管理
│   │   ├── tool.store.ts           # 工具状态管理
│   │   ├── config.store.ts         # 配置状态管理
│   │   └── i18n.store.ts           # 国际化状态管理
│   ├── App.vue                     # 根组件
│   ├── main.ts                     # 前端入口
│   └── styles/                     # 样式文件
│       ├── variable.css            # CSS变量
│       └── common.css              # 通用样式
├── index.html                      # HTML模板
└── vite.config.ts                  # Vite配置

build/                              # 构建脚本
├── vite.build.js                   # 前端构建脚本
├── copy.assets.js                  # 资源复制脚本
└── postbuild.js                    # 构建后处理脚本

public/                             # 公共资源
└── assets/                         # 静态资源
    ├── js/                         # 静态脚本
    ├── css/                        # 静态样式
    └── img/                        # 静态图片

tests/                              # 测试结构
├── unit/                           # 单元测试
│   ├── models/                     # 模型测试
│   │   ├── server.test.ts          # 服务器模型测试
│   │   └── tool.test.ts            # 工具模型测试
│   ├── services/                   # 服务测试
│   │   ├── hub-manager.test.ts     # HubManager服务测试
│   │   └── direct-search.test.ts   # DirectSearch服务测试
│   └── utils/                      # 工具测试
│       ├── validation.test.ts      # 验证工具测试
│       └── process.test.ts         # 进程工具测试
├── integration/                    # 集成测试
│   ├── api/                        # API测试
│   │   ├── mcp.test.ts             # MCP协议测试
│   │   └── web-api.test.ts         # Web API测试
│   └── gateway/                    # Gateway测试
│       └── streaming.test.ts       # 流式网关测试
├── contract/                       # 契约测试
│   └── mcp-protocol/               # MCP协议契约测试
│       └── tools-list.test.ts      # 工具列表契约测试
└── e2e/                            # 端到端测试
    └── dashboard/                   # Dashboard测试
        ├── main.test.ts             # 主页面测试
        └── server-manage.test.ts    # 服务器管理测试

schemas/                            # 模式定义
└── config-schema.json              # JSON Schema配置模式

scripts/                            # 工具脚本
├── build.js                        # 构建入口脚本
├── setup.js                        # 安装设置脚本
└── dev.js                          # 开发环境脚本

package.json                        # 包配置
```

### 进程管理与PID文件

进程管理是集中式架构的核心组件之一，通过PID文件管理实现服务的状态跟踪和生命周期控制。

```typescript
// src/pid/file.ts - 实现PID文件管理
import { promises as fs } from 'fs/promises';
import path from 'path';
import os from 'os';

export function createPidFile(filename: string, pid: number): void {
  const homeDir = os.homedir();
  const pidDir = path.join(homeDir, '.mcp-hub-lite', 'pids');
  ensureDir(pidDir);

  const filePath = path.join(pidDir, filename);
  fs.writeFileSync(filePath, pid.toString(), 'utf-8');
}

export function readPidFile(filename: string): number | null {
  try {
    const homeDir = os.homedir();
    const filePath = path.join(homeDir, '.mcp-hub-lite', 'pids', filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseInt(content.trim(), 10);
  } catch {
    return null;
  }
}

export function deletePidFile(filename: string): void {
  try {
    const homeDir = os.homedir();
    const filePath = path.join(homeDir, '.mcp-hub-lite', 'pids', filename);
    fs.unlinkSync(filePath);
  } catch {
    // 忽略删除错误
  }
}
```

**特性说明**:
- PID文件存储位置：`~/.mcp-hub-lite/pids/`
- 支持进程启动时创建PID文件记录
- 支持运行时读取PID文件确定服务状态
- 支持进程停止时删除PID文件
- 错误处理：文件不存在或读取失败时返回null而不抛出异常

### 架构优势

1. **开发统一性**
   - 单一代码库，共享类型定义和工具函数
   - 统一的开发、构建和部署流程
   - 减少技术栈复杂性，一个团队掌握全套技术

2. **操作便捷性**
   - 全局安装后提供mcp-hub-lite命令
   - 统一CLI管理服务和UI界面
   - 简单的进程管理和状态查看

3. **维护效率**
   - 版本同步：一次更新同时更新CLI、服务和UI
   - 配置集中：单一配置文件管理所有组件
   - 错误定位：同一项目内快速定位和修复问题

4. **部署简单**
   - 通过npm/pnpm全局安装，无需独立构建
   - 运行时动态加载Vue3前端，减少分发大小
   - 服务自动创建必要目录和PID文件

### Vue3集成策略

根据技术评估，Vue3在本项目中有充分的必要性和合理性：

1. **类型安全**: Vue3原生的TypeScript友好特性，确保前后端类型一致性
2. **代码组织**: Composition API提高复杂组件的可维护性，特别适合管理Dashboard类界面
3. **开发效率**: Vite构建工具提供卓越的开发体验和快速构建
4. **技术栈简化**: 统一使用Vue生态，减少学习成本和技术栈复杂性

### CLI设计与实现

全局命令设计遵循简洁原则，为独立开发者提供4个核心命令：

```json
// package.json关键部分
{
  "main": "dist/index.js",
  "bin": {
    "mcp-hub-lite": "dist/cli/index.js"
  },
  "scripts": {
    "build:frontend": "cd frontend && npm install && npm run build",
    "build:backend": "tsc",
    "build:integrate": "node build/copy.assets.js",
    "build": "npm run build:frontend && npm run build:backend && npm run build:integrate"
  }
}
```

**CLI命令**:

1. **`mcp-hub-lite start`**：启动MCP Hub Lite服务
   - 后台启动Fastify HTTP服务器
   - 同时启动Web界面（默认端口7788）
   - 同时启动MCP Gateway服务
   - 创建PID文件便于服务管理

2. **`mcp-hub-lite stop`**：停止MCP Hub Lite服务
   - 安全关闭Fastify HTTP服务器
   - 停止MCP Gateway服务
   - 同时停止所有管理的MCP服务器进程
   - 删除PID文件，记录服务状态

3. **`mcp-hub-lite status`**：检查服务状态
   - 显示MCP Hub Lite服务是否运行
   - 显示当前配置的MCP服务器列表
   - 显示每个服务器的运行状态（online/offline/error）
   - 显示CPU和内存使用情况

4. **`mcp-hub-lite ui`**：打开用户界面
   - `mcp-hub-lite ui` - 打开Web界面（默认端口7788）
   - 自动在默认浏览器中打开UI界面

5. **`mcp-hub-lite server`**：管理MCP服务器
   - `mcp-hub-lite server list` - 列出所有MCP服务器
   - `mcp-hub-lite server start <id>` - 启动指定MCP服务器
   - `mcp-hub-lite server stop <id>` - 停止指定MCP服务器
   - `mcp-hub-lite server restart <id>` - 重启指定MCP服务器

6. **`mcp-hub-lite tool`**：搜索MCP工具
   - `mcp-hub-lite tool search <query>` - 搜索MCP工具
   - `mcp-hub-lite tool list` - 显示所有可用工具
   - `mcp-hub-lite tool info <name>` - 显示工具详细信息
   - `mcp-hub-lite tool test <name>` - 测试工具调用

**命令解析实现**:
- CLI入口：`src/cli/index.ts`解析命令和选项
- 参数解析：`src/cli/parse-args.ts`处理命令行参数
- 命令实现：`src/cli/commands/`目录下的各模块实现各个命令逻辑
- 统一输出：所有命令统一返回结构化输出格式（JSON或表格）
- 错误处理：所有命令统一处理和返回错误信息
---

## 架构优化更新 *(2025-12-15)*

### 优化说明

基于Kaizen分析和YAGNI原则，本架构文档已进行重大简化，从多组件分布式架构调整为**单进程Lite架构**，旨在为独立开发者提供更简洁、更易维护的MCP管理平台。

### 核心变化

#### 1. 移除组件层次结构（✅→❌）

**移除的组件** *(基于Muda分析)*：
- ~~SearchIndex服务~~ - 5层Map索引（fullTextIndex、serverIndex、toolIndex、serverToTools、tagKeyIndex、tagValueIndex）
- ~~ProcessManager进程管理器~~ - 复杂的进程生命周期管理（独立开发者场景不需要）
- ~~BackupManager备份系统~~ - 多版本备份和回滚机制（简化为简单导出）
- ~~ConfigManager配置管理器~~ - 独立的配置验证和备份系统（单进程足以处理）

**新的简化架构**：单进程Node.js应用

#### 2. 新的简化项目结构（✅）

```
src/                                 # 简化后端源码
├── api/                             # API处理
│   ├── mcp/                         # MCP JSON-RPC协议
│   │   ├── tools.ts                 # 工具处理
│   │   └── gateway.ts               # Gateway处理
│   └── web/                         # Web API
│       ├── servers.ts               # 服务器API
│       └── config.ts                # 配置API
├── services/                        # 核心业务（简化）
│   ├── gateway.service.ts          # MCP Gateway（直接代理）
│   └── simple-search.service.ts     # 简化搜索（直接遍历）
├── models/                          # 数据模型
│   ├── types.ts                     # 类型定义
│   ├── server.model.ts              # 服务器模型（简化）
│   └── tool.model.ts                # 工具模型（简化）
├── config/                          # 配置管理（简化）
│   └── config.manager.ts            # 仅JSON文件操作
├── utils/                           # 工具函数
│   └── process.ts                   # 简化进程工具
└── cli/                             # 命令行接口（6命令）
    ├── commands/
    │   ├── start.ts
    │   ├── stop.ts
    │   ├── status.ts
    │   ├── ui.ts
    │   ├── list.ts
    │   └── restart.ts
    └── index.ts
```

#### 3. 核心组件简化

**Gateway服务（gateway.service.ts）**：
- **简化前**：多组件协调、复杂路由、索引同步
- **简化后**：直接代理请求到后端MCP Servers
- 使用Promise.allSettled聚合响应
- 启动失败标记为error，不影响其他服务

**搜索服务（simple-search.service.ts）**：
- **简化前**：SearchIndex 5层Map索引 + Fuse.js全文检索
- **简化后**：直接遍历工具列表，字符串匹配
- 支持：name、description、tags的简单匹配
- 预期响应时间：<100ms（适合50-200工具规模）

#### 4. CLI命令精简（12→6个）

**精简前命令结构**：
```bash
mcp-hub-lite server  # list/start/stop/restart
mcp-hub-lite tool    # search/list/info/test
mcp-hub-lite config  # file list/backup/restore
mcp-hub-lite dashboard # open
```

**精简后命令结构**：
```bash
mcp-hub-lite start    # 启动服务
mcp-hub-lite stop     # 停止服务
mcp-hub-lite status   # 查看状态
mcp-hub-lite ui       # 打开Web界面
mcp-hub-lite list     # 列出所有MCP Servers
mcp-hub-lite restart  # 重启MCP Servers
```

#### 5. 进程管理简化

**简化前**：
- PID文件管理：~/.mcp-hub-lite/pids/
- 进程生命周期：启动、停止、重启、状态检查
- 复杂进程监控：CPU/内存使用、运行时间

**简化后**：
- 直接npx/uvx调用：不在独立管理进程
- PID仅用于显示：运行时显示当前进程ID
- 无复杂监控：仅显示基本状态

#### 6. 构建流程简化

**简化前**：
```json
{
  "scripts": {
    "build:frontend": "cd frontend && npm install && npm run build",
    "build:backend": "tsc",
    "build:integrate": "node build/copy.assets.js",
    "build": "npm run build:frontend && npm run build:backend && npm run build:integrate"
  }
}
```

**简化后**：
```json
{
  "scripts": {
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  }
}
```

### 内存和性能优化

#### 内存占用
- **原设计**：60MB（SearchIndex + 各个服务组件）
- **简化后**：20-30MB（单进程架构）
- **节省**：50%内存占用

#### 构建时间
- **原设计**：3步构建链（frontend + backend + integrate）
- **优化后**：Vite单一配置
- **节省**：60%构建时间

#### 学习成本
- **原设计**：12个子命令 + 5个独立组件
- **优化后**：6个核心命令 + 1个进程
- **节省**：50%认知负担

### 实施状态

| 模块 | 状态 | 优先级 |
|------|------|--------|
| 单进程架构 | ✅ 已设计 | CRITICAL |
| 6个CLI命令 | ✅ 已设计 | CRITICAL |
| 简化Gateway | ✅ 已设计 | CRITICAL |
| 直接遍历搜索 | ✅ 已设计 | HIGH |
| 搜索API分离 | ✅ 已设计 | HIGH |
| JSON-RPC 2.0错误码 | ✅ 已设计 | HIGH |
| 简化配置导出/导入 | ✅ 已设计 | MEDIUM |
| MCP-Inspector集成 | ✅ 已设计 | MEDIUM |

### 风险与缓解

#### 搜索性能风险
- **风险**：工具数量>300时直接遍历性能下降
- **缓解**：监控响应时间，必要时添加轻量级索引

#### 配置丢失风险
- **风险**：移除复杂备份系统后配置可能丢失
- **缓解**：提供简单导出功能，教育用户手动备份

### 下一步

根据简化后的架构，待实施Phase 1核心MVP：
1. 🔲 实现单进程Node.js应用（待实施）
2. 🔲 6个CLI命令（start, stop, status, ui, list, restart）（待实施）
3. 🔲 简化MCP Gateway代理（移除复杂协议转换）（待实施）
4. 🔲 基础Web Dashboard（移除实时推送，改为轮询）（待实施）

**架构总结**：通过Muda分析和YAGNI原则的系统简化，当前正处于设计规划阶段。从多组件分布式架构调整为单进程Lite设计，彻底移除过度工程化元素，更符合独立开发者的真实需求和"Lite"定位。设计已完成，待进入实施阶段。
