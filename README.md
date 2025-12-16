# MCP-HUB-LITE

A lightweight MCP management platform designed for independent developers, providing MCP server gateway, grouping, fuzzy search, and MCP HttpStream protocol interface.

## 概述

MCP-HUB-LITE 是一个专为独立开发者设计的 MCP 服务器网关。它充当前端和多个后端 MCP 服务器之间的代理，提供统一的访问界面，支持 MCP JSON RPC 2.0 协议。

### 核心功能

- **MCP 网关服务**: 作为多个后端 MCP 服务器的统一代理接口
- **服务器管理**: 通过 Web 界面管理多个 MCP 服务器
- **工具搜索**: 跨所有服务器进行模糊搜索和工具发现
- **进程管理**: 支持通过 npx/uvx 启动和管理 MCP 服务器进程
- **标签系统**: 使用结构化标签按环境、类别、功能等组织多个 MCP 服务器
- **容错处理**: 单个服务器故障时系统继续运行
- **双语界面**: 支持中文/英文界面切换
- **配置管理**: 支持 `.mcp-hub.json` 配置文件的热重载和维护

## 技术栈

- **TypeScript 5.x** + Node.js 20.x
- **Fastify**: 高性能 HTTP 服务器
- **MCP SDK**: 官方 MCP 协议支持
- **Jest**: 单元测试框架
- **Zod**: 数据验证
- **Pino**: 结构化日志

## 快速开始

### 系统要求

- Node.js 20.x 或更高版本
- npm 或 yarn
- Windows、macOS 或 Linux

### 安装

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build

# 运行生产版本
npm start
```

服务器将在 http://localhost:7788 启动。

### 测试

```bash
# 运行所有测试
npm test

# 单元测试
npm run test:unit

# 集成测试
npm run test:integration

# 合同测试
npm run test:contract
```

## 配置

MCP-HUB-LITE 使用 `.mcp-hub.json` 文件进行配置。你可以通过以下方式指定配置文件：

1. 环境变量 `MCP_HUB_CONFIG_PATH`
2. 当前目录的 `.mcp-hub.json`
3. `config/.mcp-hub.json`
4. `~/.mcp-hub.json`

### 配置示例

```json
{
  "version": "1.0.0",
  "servers": [
    {
      "id": "server-1",
      "name": "My MCP Server",
      "description": "Example server",
      "endpoint": "http://localhost:8080",
      "transport": "http-stream",
      "tags": {
        "env": "development",
        "category": "api-server",
        "function": "http-api",
        "priority": "medium"
      },
      "managedProcess": {
        "command": "npx my-mcp-server",
        "managedMode": "npx",
        "processType": "http-stream"
      }
    }
  ],
  "settings": {
    "language": {
      "current": "zh-CN",
      "autoDetect": true,
      "fallback": "zh-CN"
    },
    "logging": {
      "level": "info"
    }
  },
  "gateway": {
    "proxyTimeout": 30000,
    "rateLimit": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000
    }
  }
}
```

## 使用说明

### 添加 MCP 服务器

通过 Web 界面：

1. 打开 http://localhost:7788
2. 导航到 "Servers" 页面
3. 点击 "Add Server"
4. 填写服务器详情并保存

### MCP 协议使用

MCP-HUB-LITE 在同一端口暴露 MCP 协议接口：

#### 列出所有工具

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "params": {}
}
```

#### 执行工具

```json
{
  "jsonrpc": "2.0",
  "method": "tool/call",
  "params": {
    "toolId": "server1:example-tool",
    "arguments": {}
  }
}
```

#### 获取服务器状态

```json
{
  "jsonrpc": "2.0",
  "method": "server/status",
  "params": {
    "serverId": "server-1"
  }
}
```

## 进程管理

MCP-HUB-LITE 支持使用你的本地环境启动和管理 MCP 服务器：

### 支持的启动方式

- **Node.js (npx)**: `npx package-name`
- **Python (uvx)**: `uvx package-name`
- **直接命令**: 自定义启动命令

### 进程管理功能

- 启动/停止/重启 MCP 服务器
- 监控 CPU 和内存使用情况
- 检测崩溃并自动重启
- PID 跟踪和健康检查

## 开发指南

### 项目结构

```
src/
├── api/              # API 实现
│   ├── mcp-protocol/ # MCP 协议处理器
│   └── web-api/      # Web API 路由
├── models/           # 数据模型
├── services/         # 核心业务逻辑
├── utils/            # 工具函数
├── config/           # 配置
└── web/              # Web 界面

tests/
├── unit/             # 单元测试
├── integration/      # 集成测试
└── contract/         # 合同测试
```

### 添加新功能

1. 创建模型 (models/)
2. 实现服务 (services/)
3. 添加 API 路由 (api/)
4. 编写测试 (tests/)
5. 更新配置文件

## 约束和限制

- 最大服务器数: 50
- 最大内存使用: 4GB
- CPU 使用率阈值: 80%
- 搜索响应时间: <500ms (90%)
- 网关延迟: <100ms

## 详细技术文档

完整的项目架构、约束和设计决策详见以下文档：

- [技术选择深度研究报告](./specs/001-develop/technology-research-report.md) - 100页+详细技术分析
- [规格文档](./specs/001-develop/spec.md) - 功能规格说明
- [实施计划](./specs/001-develop/plan.md) - 技术实施计划
- [数据模型](./specs/001-develop/data-model.md) - 数据结构定义

## 许可证

MIT

## 贡献

欢迎提交 Pull Request 和 Issue！

## 路线图

- [ ] 监控系统集成
- [ ] 更多传输协议支持
- [ ] 集群部署支持
- [ ] 更高级的工具搜索功能
