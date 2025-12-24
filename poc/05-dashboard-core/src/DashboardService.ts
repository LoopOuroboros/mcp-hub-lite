/**
 * Dashboard核心服务
 * 模拟Dashboard的核心功能
 */

import chalk from "chalk";
import type {
  MCPServer,
  MCPTool,
  SystemMetrics,
  DashboardAction,
  DashboardData
} from "./types.js";

export class DashboardService {
  private servers: Map<string, MCPServer> = new Map();

  constructor() {
    // 初始化模拟数据
    this.initializeMockData();
  }

  /**
   * 获取Dashboard数据
   */
  async getDashboardData(query?: string): Promise<DashboardData> {
    const servers = Array.from(this.servers.values());
    let searchResults: MCPTool[] | undefined;

    if (query) {
      searchResults = await this.searchTools(query);
    }

    const metrics = await this.generateMetrics();

    return {
      servers,
      metrics,
      searchResults
    };
  }

  /**
   * 获取服务器列表
   */
  async getServers(): Promise<MCPServer[]> {
    return Array.from(this.servers.values());
  }

  /**
   * 搜索工具
   */
  async searchTools(query: string): Promise<MCPTool[]> {
    console.log(chalk.blue(`\n🔍 搜索工具: "${query}"`));

    const results: MCPTool[] = [];
    for (const server of this.servers.values()) {
      if (server.status !== "online") continue;

      const serverResults = this.searchInServerTools(server, query);
      results.push(...serverResults.map(tool => ({
        ...tool,
        id: `${server.id}:${tool.id}`
      })));
    }

    console.log(chalk.green(`✅ 找到 ${results.length} 个匹配的工具`));
    return results.slice(0, 20); // 限制20个结果
  }

  /**
   * 获取工具列表
   */
  async getTools(serverId?: string): Promise<MCPTool[]> {
    if (serverId) {
      const server = this.servers.get(serverId);
      return server?.tools || [];
    }

    const allTools: MCPTool[] = [];
    for (const server of this.servers.values()) {
      allTools.push(...(server.tools || []));
    }
    return allTools;
  }

  /**
   * 获取系统指标
   */
  async getMetrics(): Promise<SystemMetrics> {
    return await this.generateMetrics();
  }

  /**
   * 启动服务器
   */
  async startServer(serverId: string): Promise<void> {
    console.log(chalk.blue(`\n🚀 启动服务器: ${serverId}`));
    const server = this.servers.get(serverId);

    if (!server) {
      throw new Error(`服务器 ${serverId} 不存在`);
    }

    if (server.status === "online") {
      console.log(chalk.yellow(`⏩ 服务器 ${serverId} 已在线`));
      return;
    }

    // 模拟启动过程
    server.status = "starting";
    console.log(chalk.gray("   - 检查服务器配置..."));

    await this.sleep(500);

    server.status = "online";
    server.cpu = Math.random() * 10 + 5; // 5-15%
    server.memory = Math.random() * 100 + 50; // 50-150MB
    server.uptime = 0;

    console.log(chalk.green(`✅ 服务器 ${serverId} 已启动 (CPU: ${server.cpu.toFixed(1)}%, Memory: ${server.memory.toFixed(1)}MB)`));
  }

  /**
   * 停止服务器
   */
  async stopServer(serverId: string): Promise<void> {
    console.log(chalk.blue(`\n📵 停止服务器: ${serverId}`));
    const server = this.servers.get(serverId);

    if (!server) {
      throw new Error(`服务器 ${serverId} 不存在`);
    }

    if (server.status !== "online") {
      console.log(chalk.yellow(`⏩ 服务器 ${serverId} 已离线`));
      return;
    }

    // 模拟停止过程
    server.status = "stopping";
    console.log(chalk.gray("   - 收敛连接..."));

    await this.sleep(300);

    server.status = "offline";
    delete server.cpu;
    delete server.memory;
    delete server.uptime;

    console.log(chalk.green(`✅ 服务器 ${serverId} 已停止`));
  }

  /**
   * 重启服务器
   */
  async restartServer(serverId: string): Promise<void> {
    console.log(chalk.blue(`\n🔄 重启服务器: ${serverId}`));
    await this.stopServer(serverId);
    await this.sleep(1000);
    await this.startServer(serverId);
  }

  /**
   * 调用工具
   */
  async callTool(serverId: string, toolName: string): Promise<unknown> {
    console.log(chalk.blue(`\n🛠️ 调用工具: ${serverId}/${toolName}`));

    if (!this.servers.has(serverId)) {
      throw new Error(`服务器 ${serverId} 不存在`);
    }

    const server = this.servers.get(serverId)!;
    if (server.status !== "online") {
      throw new Error(`服务器 ${serverId} 离线`);
    }

    // 模拟工具调用
    console.log(chalk.gray(`   - 发送请求到 ${server.name}...`));
    await this.sleep(200);

    const results = {
      success: true,
      data: {
        message: "工具调用成功",
        timestamp: new Date().toISOString(),
        tool: toolName,
        server: server.name
      }
    };

    console.log(chalk.green(`✅ 工具调用成功`));
    return results;
  }

  /**
   * 执行Dashboard操作
   */
  async executeAction(action: DashboardAction): Promise<unknown> {
    switch (action.type) {
      case "START_SERVER":
        await this.startServer(action.payload.serverId!);
        return { success: true };

      case "STOP_SERVER":
        await this.stopServer(action.payload.serverId!);
        return { success: true };

      case "RESTART_SERVER":
        await this.restartServer(action.payload.serverId!);
        return { success: true };

      case "SEARCH_TOOLS":
        return await this.searchTools(action.payload.query!);

      case "CALL_TOOL":
        if (action.payload.serverId && action.payload.tool) {
          return await this.callTool(action.payload.serverId, action.payload.tool.name);
        }
        throw new Error("缺少服务器ID或工具信息");

      default:
        throw new Error(`未知操作: ${action.type}`);
    }
  }

  /**
   * 初始化模拟数据
   */
  private initializeMockData(): void {
    this.servers.set("server-1", {
      id: "server-1",
      name: "MySQL数据库",
      status: "online",
      cpu: 12.5,
      memory: 128.5,
      port: 3001,
      uptime: 3600,
      tags: { category: "database", environment: "production" },
      tools: [
        { id: "query", name: "query", description: "执行SQL查询" },
        { id: "backup", name: "backup", description: "数据库备份" },
        { id: "migrate", name: "migrate", description: "数据迁移" }
      ]
    });

    this.servers.set("server-2", {
      id: "server-2",
      name: "GitHub API",
      status: "online",
      cpu: 8.3,
      memory: 45.2,
      port: 3002,
      uptime: 7200,
      tags: { category: "api", environment: "development" },
      tools: [
        { id: "issue", name: "issue", description: "获取Issue列表" },
        { id: "commit", name: "commit", description: "查看提交记录" },
        { id: "pr", name: "pr", description: "管理PR" }
      ]
    });

    this.servers.set("server-3", {
      id: "server-3",
      name: "文件管理器",
      status: "offline",
      port: 3003,
      tags: { category: "filesystem", environment: "production" },
      tools: [
        { id: "list", name: "list", description: "列出文件" },
        { id: "read", name: "read", description: "读取文件" },
        { id: "write", name: "write", description: "写入文件" }
      ]
    });
  }

  /**
   * 在某服务器的工具中搜索
   */
  private searchInServerTools(server: MCPServer, query: string): MCPTool[] {
    const lowercaseQuery = query.toLowerCase();
    return (server.tools || []).filter(tool => {
      return (
        tool.name.toLowerCase().includes(lowercaseQuery) ||
        tool.description?.toLowerCase().includes(lowercaseQuery)
      );
    });
  }

  /**
   * 生成系统指标
   */
  private async generateMetrics(): Promise<SystemMetrics> {
    return {
      cpu: {
        usage: Math.random() * 100,
        cores: 4
      },
      memory: {
        total: 8192,
        used: Math.random() * 4000 + 2000,
        available: Math.random() * 2000 + 2000
      },
      disk: {
        total: 512 * 1024,
        used: 200 * 1024,
        free: 312 * 1024
      },
      network: {
        bytesIn: Math.floor(Math.random() * 1000),
        bytesOut: Math.floor(Math.random() * 1000)
      },
      timestamp: new Date().toISOString()
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}