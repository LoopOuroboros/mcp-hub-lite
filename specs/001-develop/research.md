# Research: MCP-HUB-LITE

## MCP Protocol Research

### Decision: MCP Protocol Implementation
The MCP-HUB-LITE will implement the MCP JSON-RPC 2.0 protocol as specified in the official MCP documentation. The gateway will act as a proxy, forwarding requests to backend MCP servers while maintaining protocol compliance.

### Rationale:
- MCP protocol is the standard for Model Context Protocol interactions
- JSON-RPC 2.0 provides a well-defined interface for tool discovery and execution
- Proxy pattern allows multiple backend servers to be accessed through a single interface
- Maintains compatibility with existing MCP-enabled tools and clients

### Alternatives considered:
- Creating a custom protocol: Would break compatibility with existing MCP tools
- Using REST APIs: Would not be compliant with MCP standard
- gRPC: Would require additional dependencies and complexity

## Gateway Architecture Research

### Decision: Fastify-based Gateway
The gateway will be implemented using Fastify framework to handle both MCP protocol requests and web API requests, providing optimal performance and plugin ecosystem.

### Rationale:
- Fastify offers excellent performance for proxy operations
- Built-in support for JSON-RPC and HTTP protocols
- Plugin system allows easy extensibility
- TypeScript support is excellent
- Good for handling concurrent requests to multiple backend servers

### Alternatives considered:
- Express: Slower performance than Fastify
- Hapi: More complex configuration
- Koa: Requires more manual setup for proxy functionality

## Frontend Framework Research

### Decision: Vue 3 + Element Plus + 构建脚本集成
The web dashboard will be built using Vue 3 framework with Element Plus UI component library for consistent, professional UI components. Vue3 is integrated as a subdirectory (`frontend/`) with dedicated build scripts that integrate the built frontend into the main application output.

### Rationale:
- Vue 3 offers excellent performance and reactivity
- Element Plus provides comprehensive UI components out of the box
- Good TypeScript integration
- Lightweight compared to React alternatives
- 符合specification中的FR-023, FR-024, FR-025, FR-026, FR-027要求
- 集中式架构中的独立前端构建和集成方案更适合全局安装应用
- 构建脚本（`build/copy.assets.js`）自动将构建后的前端资源集成到服务端静态文件目录

### Frontend Structure Decision:
- 前端源码：`frontend/`目录包含完整的Vue3项目结构
- 组件设计：`src/components/`包含公共组件（ServerIcon.vue、ToolCard.vue等）
- 视图设计：`src/views/`包含页面视图（Dashboard.vue、ServerManager.vue等）
- 状态管理：Pinia状态管理，包括服务器、工具、配置和国际化状态
- 路由配置：Vue Router管理单页应用路由
- 国际化：前端支持中英文切换（`public/locales/`目录存储语言文件）
- 构建集成：构建过程通过脚本自动将前端构建结果集成到服务端

### Alternatives considered:
- React + Ant Design: More complex setup, larger bundle size，更不适合全局安装模式
- 前端与后端分离部署：增加部署复杂度和版本同步问题，不适合全局安装场景
- 纯静态HTML/CSS/JS：需要更多手工工作，缺乏组件化和状态管理能力

## Configuration Management Research

### Decision: JSON Schema with File-based Storage
Configuration will be stored in `.mcp-hub.json` file with strict JSON Schema validation to ensure type safety and proper configuration.

### Rationale:
- File-based configuration is simple and portable
- JSON Schema provides strong validation and documentation
-符合specification中的FR-010 requirements
- Easy for users to edit manually if needed
- Supports the backup and versioning requirements (FR-014)

### Alternatives considered:
- Database storage: Too complex for single-user scenario
- YAML configuration: Would require additional dependencies
- Environment variables only: Insufficient for complex server configurations

## Process Management Research

### Decision: npx/uvx-based Process Management
MCP-HUB-LITE will use the local npx command to start Node.js MCP servers and uvx command to start Python MCP servers, implementing a robust process management system with monitoring capabilities.

### Rationale:
- Uses developer's existing environment and package managers
-符合specification中的User Story 5 requirements for npx/uvx support
- Supports both Node.js and Python MCP servers
- Allows for monitoring and control of child processes
- Standard approach for executing JavaScript/Python packages

### Alternatives considered:
- Docker containers: Would add complexity for single-user tool
- Custom process launcher: Would require maintaining additional dependencies

## Search Algorithm Research

### Decision: DirectSearch - Lightweight Traversal Search
The tool search functionality will implement a DirectSearch service with straightforward traversal-based search, using fuzzy string matching and tag-based filtering. This simplified approach eliminates the need for complex indexing, reducing memory usage and complexity while meeting performance targets for 100+ MCP servers with 2000+ tools.

### DirectSearch Design
DirectSearch implements a lightweight, direct traversal approach for tool discovery:

```
class DirectSearch {
  // Lightweight filtering based on string matching
  search(query: string, servers: McpServer[], tagFilters?: Record<string, string>): SearchResult[] {
    // Apply tag filters first if specified
    let filteredServers = servers;
    if (tagFilters && Object.keys(tagFilters).length > 0) {
      filteredServers = this.filterByTags(servers, tagFilters);
    }

    // If no query, return all servers matching tag filters
    if (!query || query.trim() === '') {
      return filteredServers.map(server => this.convertToResult(server));;
    }

    // Direct traversal search
    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const server of filteredServers) {
      // Search in server name and description
      if (server.name.toLowerCase().includes(queryLower) ||
          (server.description || '').toLowerCase().includes(queryLower)) {
        results.push({
          serverId: server.id,
          serverName: server.name,
          score: this.calculateScore(queryLower, server.name, server.description)
        });
        continue; // If server matches, no need to check tools
      }

      // Search in tools for this server
      for (const tool of server.tools || []) {
        if (tool.name.toLowerCase().includes(queryLower) ||
            (tool.description || '').toLowerCase().includes(queryLower)) {
          const tagsText = Object.entries(server.tags || {})
            .map(([key, value]) => `${key}:${value}`).join(' ');

          results.push({
            serverId: server.id,
            serverName: server.name,
            toolName: tool.name,
            score: this.calculateScore(queryLower, tool.name, tool.description, tagsText)
          });
        }
      }
    }

    // Sort by score (highest first)
    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  // Filter servers by tag key-value pairs
  private filterByTags(servers: McpServer[], tagFilters: Record<string, string>): McpServer[] {
    return servers.filter(server => {
      return Object.entries(tagFilters).every(([key, value]) => {
        return server.tags && server.tags[key] === value;
      });
    });
  }

  // Calculate relevance score
  private calculateScore(query: string, ...texts: string[]): number {
    let score = 0;
    for (const text of texts) {
      const textLower = (text || '').toLowerCase();
      // Exact match gets highest score
      if (textLower === query) score += 100;
      // Starts with query gets medium score
      else if (textLower.startsWith(query)) score += 80;
      // Contains query gets lower score
      else if (textLower.includes(query)) score += 60;
      // Word match gets even lower score
      else if (textLower.split(/\s+/).some(word => word.includes(query))) score += 40;
    }
    return score;
  }
}
```

### Rationale:
-符合specification中的SC-003 performance requirement (100 MCP × 20 Tools = 2000 tools)
- Direct traversal provides acceptable performance for Lite version (<500ms response time)
- Eliminates complex indexing overhead, reducing memory from ~60MB to ~20-30MB
- Simpler code path reduces maintenance burden and bug potential
- Tag-based filtering replaces complex group management
- Zero build time (no index construction needed)

### Performance Targets:
- Search response time: < 500ms (90th percentile for 2000 tools on 100 MCP servers)
- Memory usage: ~20-30MB (vs ~60MB for SearchIndex approach)
- Build time: 0ms (no indexing phase)
- Update sensitivity: Immediate (no sync delays)

### Implementation Details:
- Uses simple array traversal with O(n) complexity
- Implements fuzzy string matching with multiple matching strategies
- Supports combined tag filtering and text search
- Scores results for better relevance ordering
- No complex data structures or lazy rebuilds needed

### YAGNI Principle Application:
Following the principle of "You Aren't Gonna Need It", the DirectSearch approach:
- ❌ Rejects: Complex L3 SearchIndex with debounced updates
- ❌ Rejects: Map-based advanced indexing infrastructure
- ❌ Rejects: Intersection queries optimization
- ✅ Accepts: Direct traversal search (sufficient for 100-200 tools)
- ✅ Accepts: Simple scoring based on string matching
- ✅ Accepts: Straightforward tag filtering

This decision aligns with the Lite mission of minimal complexity while maintaining acceptable performance.

## Dashboard Communication Research

### Decision: HTTP Polling for Status Updates
The dashboard will use lightweight HTTP polling to receive server status updates from the backend, fulfilling the requirement for status updates while avoiding complex real-time infrastructure.

### Rationale:
-符合specification中的FR-007 requirement (simplified from SSE)
- HTTP polling provides simple, reliable status updates (3-5 second intervals)
- No complex real-time infrastructure needed (no WebSockets, no SSE)
- Works reliably across all browsers and proxies
- Lower complexity and memory footprint than SSE

### Implementation Approach:
- Frontend polls backend API every 3-5 seconds for status updates
- Backend maintains server status cache to minimize MCP server calls
- Simple interval-based refresh mechanism
- Optimized to reduce unnecessary polling during idle periods

### Alternatives considered:
- SSE (Server-Sent Events): Removed due to complexity (YAGNI principle)
- WebSockets: More complex setup, bidirectional when unidirectional is sufficient
- Long polling: More complex than simple interval polling for status updates

## Internationalization Research

### Decision: Vue I18n with Dual-Language Support
The interface will support both Chinese and English languages using Vue I18n, with the ability to switch between languages at runtime and store user preferences.

### Rationale:
-符合specification中的FR-012 requirement for bilingual support
- Vue I18n integrates well with Vue 3
- Supports both interface text and MCP protocol response localization
- Allows for user preference persistence
- Follows language priority: user setting > browser detection > default (Chinese)

### Alternatives considered:
- Manual translation handling: More error-prone
- Server-side language switching: Would require page reload
- External i18n service: Unnecessary complexity