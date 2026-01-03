# MCP Hub Lite 架构决策与问答记录

**记录时间**: 2025-12-25
**相关模块**: Gateway, POC, Architecture

本文档记录了在开发 POC 阶段关于系统架构、并发处理及多租户隔离的关键问答与决策。

---

## 1. 需求与现状对比分析

### Q: 当前的 POC 项目与 specs 目录下的设计文档是否一致？

**结论**:
目前的 POC 项目在**功能验证**和**技术选型**上高度符合设计规范。

**详细分析**:
*   **功能对齐 (High Alignment)**:
    *   `01-fastify-gateway` 对应 **User Story 3 (Gateway)**，验证了代理能力。
    *   `02-vue3-ui` 对应 **User Story 1 & 6 (Dashboard)**，验证了前端管理界面。
    *   `07-direct-search` 对应 **User Story 2 (Search)**，实现了 Lite 版设计的轻量级搜索策略。
    *   `04-config-manager` 对应 **User Story 8 (Config)**，实现了配置备份与 Zod 验证。
    *   `03-cli-commands` 对应 **User Story 5 (CLI)**，验证了进程管理。
*   **架构差异**:
    *   设计文档 (`architecture.md`) 规划的是单体包结构 (`src/cli`, `src/services` 等)。
    *   POC 阶段采用了分治策略（独立目录 `01`-`07`），这是验证阶段的正常做法，后续需合并。

---

## 2. Gateway 多项目/多租户隔离

### Q: 作为网关接入 stdio 类型的 MCP Server 时，如何区分不同的工程或项目路径？

**背景**: `stdio` Server 通常与启动时的 `cwd`（工作目录）绑定，且单进程内无状态隔离。

**决策建议**: **配置即实例 (Configuration as Instance)**

1.  **多实例配置**:
    *   在 `mcp-hub-config.json` 中，允许将同一个可执行文件（如 `git-mcp`）配置为多个独立的 Server 条目。
    *   每个条目指定不同的 `cwd` 和唯一的 `serverId`。
    *   *示例*:
        *   Server A: `id="git-project-alpha"`, `cwd="/projects/alpha"`
        *   Server B: `id="git-project-beta"`, `cwd="/projects/beta"`

2.  **请求路由**:
    *   LLM 或 Client 在发起请求时，必须通过 `serverId`（或带命名空间的 Tool 名称）来指定目标实例。
    *   Gateway 根据 ID 将请求路由到对应的独立子进程。

---

## 3. 并发请求处理

### Q: 当后端 MCP Server 处理逻辑复杂（耗时 3-5 秒）时，Gateway 如何处理并发请求？

**决策建议**: **默认采用异步管道 (Async Pipelining)**

1.  **首选策略：异步管道 (Async Pipelining)**
    *   **机制**: 利用 JSON-RPC 2.0 的 `id` 机制。
    *   **流程**: Gateway 收到多个并发请求后，**不等待**前一个请求完成，直接连续写入后端 Server 的 `stdin`。
    *   **依赖**: 依赖后端 Server (如基于 Node.js/Python Async) 具备并发处理能力。
    *   **优势**: 最大化吞吐量，避免队头阻塞。

2.  **备选策略：请求队列 (Request Queuing)**
    *   **场景**: 仅当确认后端 Server 是单线程同步阻塞（不支持并发）时使用。
    *   **流程**: Gateway 在内存中维护 FIFO 队列，强制串行执行。
    *   **配置**: 在配置文件中提供 `concurrencyMode: "serial"` 选项供用户手动开启。

---

## 4. 异步并发能力测试

### Q: 如何测试或判断一个 stdio MCP Server 是否支持 Async Pipelining？

**方法**: **快慢请求追逐测试 (Fast-Follows-Slow Test)**

由于协议握手阶段无法获知并发能力，需通过行为测试验证。

**测试步骤**:
1.  **发送慢请求 (A)**: 调用一个已知耗时的 Tool (如 `git_clone` 或复杂搜索)。
2.  **发送快请求 (B)**: 立即（毫秒级）发送一个极快的元数据请求 (如 `tools/list`)。
3.  **观察顺序**:
    *   ✅ **支持并发**: B 先于 A 返回 (`Response B` -> `Response A`)。
    *   ❌ **不支持**: B 等待 A 结束后才返回 (`Response A` -> `Response B`)。

**Gateway 策略**:
*   Gateway 无法自动预知，应**默认乐观**（假设支持）。
*   提供 CLI 调试命令辅助开发者进行上述测试。
*   提供配置项允许用户针对特定 Server 降级为串行模式。
