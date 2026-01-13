# MCP Hub Lite - AI 编程助手指南

## 项目概述
MCP Hub Lite 是一个轻量级的 MCP (Model Context Protocol) 网关系统。

## 架构设计

完整的架构设计请参见：[specs/001-develop/architecture.md](specs/001-develop/architecture.md)

## 命名规范

完整的命名规范请参见：[.claude/rules/naming.md](.claude/rules/naming.md)

## 开发流程

基于 Spec-Plan-Tasks 工作流：

1. **Specification** (spec.md) - 功能规格说明
2. **Plan** (plan.md) - 设计与实施计划
3. **Tasks** (tasks.md) - 具体的开发任务

完整的开发流程指南请参见：[.claude/rules/development.md](.claude/rules/development.md)

## 开发准则

本项目严格遵循测试驱动开发（TDD）模式，确保代码质量和系统可靠性：

### TDD 三步循环
1. **编写测试**：在实现功能前先编写单元测试
   - 针对每个功能点编写对应测试用例
   - 确保测试用例覆盖正常和异常场景
   - 使用 Jest 框架编写测试
2. **运行测试并失败**：确认新测试未通过（预期结果）
3. **编写代码**：实现最简代码使测试通过

### 质量要求
每个任务的完成必须满足以下标准：

#### 编译通过
- TypeScript 代码必须能够成功编译（`npm run build`）
- 无类型错误和语法错误
- 遵循 tsconfig.json 中的配置要求

#### 测试通过
- 所有相关单元测试必须通过（`npm test`）
- 新功能必须有相应的测试覆盖
- 代码覆盖率符合项目要求
- 集成测试和端到端测试通过

#### 运行时无错误
- 功能按预期正常运行
- 无内存泄漏或性能问题
- 所有异常情况得到妥善处理
- 日志记录完整

## ESM模块系统规范

完整的ESM模块系统规范请参见：[.claude/rules/esm.md](.claude/rules/esm.md)

## TypeScript 规范

完整的 TypeScript 规范设计请参见：[.claude/rules/typescript.md](.claude/rules/typescript.md)

该规范采用模块化管理，包含以下专题：
- 基础类型安全规范
- Vue3 + TypeScript 集成规范
- 测试框架与规范 (Vite + Vitest)
- 代码组织与模块化分层规范
- 性能与配置管理规范
- 错误处理与日志规范
- CI/CD 与质量保证规范

## 快速开始

查看 `README.md` 获取详细指引。

## 开发服务器管理

**重要：LLM 严格禁止自行启动、停止或重启主程序**

- `npm run dev` 命令必须由用户自行启动和管理
- 当前项目已实现前后端热重载功能，用户启动开发服务器后可自动获得热重载体验
- LLM 不得执行任何与启动、停止、重启主程序相关的命令（包括但不限于 `npm run dev`、`npm run start`、`npm run stop` 等）
- LLM 不得假设开发服务器处于运行状态，所有代码修改应独立于服务器运行状态进行
- 如需验证功能，应指导用户手动启动/停止服务器，而非自行操作

## Git 提交规范

为保持提交历史的一致性，请遵守以下 Git 提交规范：

- **提交用户信息**：不要修改 Git 提交的用户信息（用户名和邮箱）
- **保持原作者**：在提交更改时，保留原始作者信息不变
- **提交消息**：使用清晰、描述性的提交消息
- **命名格式**：遵循约定式提交格式（如 feat(docs): ...）

详细规范请参见：[.claude/rules/git.md](.claude/rules/git.md)
