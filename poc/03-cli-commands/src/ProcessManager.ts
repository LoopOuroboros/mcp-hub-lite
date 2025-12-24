/**
 * 进程管理器 - 演示MCP Hub Lite的进程管理逻辑
 * 使用PID文件进行进程状态跟踪
 */

import { promises as fs } from "fs";
import path from "path";
import { MCPServer, ProcessStatus } from "./types.js";

export class ProcessManager {
  private pidDir: string;
  private servers: Map<string, MCPServer> = new Map();

  constructor(homeDir: string) {
    this.pidDir = path.join(homeDir, ".mcp-hub-lite", "pids");
  }

  /**
   * 初始化进程管理器
   */
  async init(): Promise<void> {
    await fs.mkdir(this.pidDir, { recursive: true });
    await this.loadProcessStatus();
  }

  /**
   * 模拟启动一个MCP服务器
   */
  async startServer(serverId: string, config: Partial<MCPServer>): Promise<void> {
    console.log(`\n🔄 正在启动MCP服务器: ${serverId}`);

    // 检查是否已经运行
    if (await this.isServerRunning(serverId)) {
      console.log(`⚠️  服务器 ${serverId} 已在运行中`);
      return;
    }

    // 模拟启动过程
    const mockPid = this.generateMockPID(serverId);
    const status = {
      id: serverId,
      name: config.name || serverId,
      command: config.command || "npx",
      args: config.args || ["-y", `@mcp/server-${serverId}`],
      status: "running" as const,
      pid: mockPid,
      port: config.port || this.generateMockPort(serverId),
      tags: config.tags || {}
    };

    this.servers.set(serverId, status);

    // 写入PID文件
    const pidFile = this.getPidFilePath(serverId);
    await fs.writeFile(pidFile, JSON.stringify(status, null, 2));

    console.log(`✅ 服务器 ${serverId} 已启动`);
    console.log(`   - PID: ${mockPid}`);
    console.log(`   - 端口: ${status.port}`);
    console.log(`   - 命令: ${status.command} ${status.args.join(" ")}`);
  }

  /**
   * 停止MCP服务器
   */
  async stopServer(serverId: string, force: boolean = false): Promise<void> {
    console.log(`\n🔄 正在停止MCP服务器: ${serverId}`);

    const server = this.servers.get(serverId);
    if (!server) {
      console.log(`⚠️  服务器 ${serverId} 未找到`);
      return;
    }

    if (!(await this.isServerRunning(serverId))) {
      console.log(`⚠️  服务器 ${serverId} 未运行`);
      return;
    }

    try {
      // 模拟停止过程
      if (force) {
        console.log(`   - 强制终止进程 ${server.pid}`);
      } else {
        console.log(`   - 正常停止进程 ${server.pid}`);
      }

      // 删除PID文件
      const pidFile = this.getPidFilePath(serverId);
      await fs.unlink(pidFile);

      this.servers.set(serverId, { ...server, status: "stopped" });
      console.log(`✅ 服务器 ${serverId} 已停止`);
    } catch (error) {
      console.error(`❌ 停止服务器失败:`, error);
    }
  }

  /**
   * 重启MCP服务器
   */
  async restartServer(serverId: string): Promise<void> {
    console.log(`\n🔄 正在重启MCP服务器: ${serverId}`);

    const server = this.servers.get(serverId);
    if (server) {
      // 停止现有进程
      await this.stopServer(serverId, false);
    }

    // 等待1秒
    await this.sleep(1000);

    // 重新启动
    await this.startServer(serverId, server || {});
  }

  /**
   * 查看所有服务器状态
   */
  async listServers(): Promise<MCPServer[]> {
    if (this.servers.size === 0) {
      await this.loadProcessStatus();
    }

    return Array.from(this.servers.values());
  }

  /**
   * 检查服务器是否运行中
   */
  async isServerRunning(serverId: string): Promise<boolean> {
    const pidFile = this.getPidFilePath(serverId);
    try {
      await fs.access(pidFile);
      const content = await fs.readFile(pidFile, "utf-8");
      const data = JSON.parse(content);
      return data.status === "running";
    } catch {
      return false;
    }
  }

  /**
   * 加载进程状态
   */
  private async loadProcessStatus(): Promise<void> {
    try {
      const files = await fs.readdir(this.pidDir);
      for (const file of files) {
        if (!file.endsWith(".pid")) continue;

        const filePath = path.join(this.pidDir, file);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const data = JSON.parse(content) as MCPServer;
          this.servers.set(data.id, data);
        } catch {
          // 忽略损坏的PID文件
        }
      }
    } catch {
      // PID目录不存在，跳过
    }
  }

  /**
   * 获取系统状态概览
   */
  async getSystemStatus(): Promise<{
    total: number;
    running: number;
    stopped: number;
    servers: MCPServer[];
  }> {
    const servers = await this.listServers();
    return {
      total: servers.length,
      running: servers.filter(s => s.status === "running").length,
      stopped: servers.filter(s => s.status !== "running").length,
      servers
    };
  }

  /**
   * 获取PID文件路径
   */
  private getPidFilePath(serverId: string): string {
    return path.join(this.pidDir, `${serverId}.pid`);
  }

  /**
   * 生成模拟PID (实际实现中会使用真实进程PID)
   */
  private generateMockPID(serverId: string): number {
    // 使用serverId的hash生成模拟PID
    const hash = serverId.split("").reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return Math.abs((10000 + (hash % 50000)));
  }

  /**
   * 生成模拟端口号
   */
  private generateMockPort(serverId: string): number {
    const hash = serverId.split("").reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return 3000 + (Math.abs(hash) % 10000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}