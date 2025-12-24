/**
 * CLI命令处理器
 * 实现MCP Hub Lite的6个核心命令
 */

import chalk from "chalk";
import { Command } from "commander";
import { ProcessManager } from "./ProcessManager.js";
import type {
  CLIOptions,
  StartOptions,
  StopOptions,
  StatusOptions
} from "./types.js";

export class CliCommandHandler {
  private processManager: ProcessManager;
  private program: Command;

  constructor(homeDir: string = process.env.HOME || process.env.USERPROFILE || ".") {
    this.processManager = new ProcessManager(homeDir);
    this.program = new Command();
    this.setupCommands();
  }

  /**
   * 初始化命令处理器
   */
  async init(): Promise<void> {
    await this.processManager.init();
  }

  /**
   * 设置所有CLI命令
   */
  private setupCommands(): void {
    this.program
      .name("mcp-hub")
      .description("MCP Hub Lite - 轻量级MCP网关管理器")
      .version("0.1.0");

    // start命令 - 启动服务
    this.program
      .command("start")
      .description("启动MCP服务器")
      .option("-n, --name <name>", "服务器名称")
      .option("-p, --port <port>", "服务器端口")
      .option("-s, --server-id <id>", "服务器ID")
      .action(async (options: StartOptions) => {
        await this.handleStart(options);
      });

    // stop命令 - 停止服务
    this.program
      .command("stop")
      .description("停止MCP服务器")
      .requiredOption("-s, --server-id <id>", "服务器ID")
      .option("-f, --force", "强制停止", false)
      .action(async (options: StopOptions) => {
        await this.handleStop(options);
      });

    // restart命令 - 重启服务
    this.program
      .command("restart")
      .description("重启MCP服务器")
      .requiredOption("-s, --server-id <id>", "服务器ID")
      .action(async (options: { serverId: string }) => {
        await this.handleRestart(options);
      });

    // status命令 - 查看状态
    this.program
      .command("status")
      .description("查看MCP Hub状态")
      .option("-j, --json", "JSON格式输出", false)
      .option("-v, --verbose", "详细输出", false)
      .action(async (options: StatusOptions) => {
        await this.handleStatus(options);
      });

    // list命令 - 列出所有服务
    this.program
      .command("list")
      .description("列出所有MCP服务器")
      .action(async () => {
        await this.handleList();
      });

    // ui命令 - 打开Web界面
    this.program
      .command("ui")
      .description("打开MCP Hub Web管理界面")
      .action(async () => {
        await this.handleUI();
      });
  }

  /**
   * 解析命令行参数
   */
  parse(argv: string[]): void {
    this.program.parse(argv);
  }

  /**
   * 处理start命令
   */
  private async handleStart(options: StartOptions): Promise<void> {
    try {
      const serverId = options.serverId || this.generateServerId();
      await this.processManager.startServer(serverId, {
        name: options.name,
        port: options.port
      });
    } catch (error) {
      console.error(chalk.red("❌ 启动失败:"), error);
      process.exit(1);
    }
  }

  /**
   * 处理stop命令
   */
  private async handleStop(options: StopOptions): Promise<void> {
    try {
      await this.processManager.stopServer(options.serverId, options.force);
    } catch (error) {
      console.error(chalk.red("❌ 停止失败:"), error);
      process.exit(1);
    }
  }

  /**
   * 处理restart命令
   */
  private async handleRestart(options: { serverId: string }): Promise<void> {
    try {
      await this.processManager.restartServer(options.serverId);
    } catch (error) {
      console.error(chalk.red("❌ 重启失败:"), error);
      process.exit(1);
    }
  }

  /**
   * 处理status命令
   */
  private async handleStatus(options: StatusOptions): Promise<void> {
    const status = await this.processManager.getSystemStatus();

    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    console.log("\n" + chalk.bold.blue("🔵 MCP Hub Lite 状态概览"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(` 总计服务器: ${status.total}`);
    console.log(` 运行中: ${chalk.green(status.running)}`);
    console.log(` 已停止: ${chalk.red(status.stopped)}`);
    console.log();
  }

  /**
   * 处理list命令
   */
  private async handleList(): Promise<void> {
    const servers = await this.processManager.listServers();

    console.log("\n" + chalk.bold.blue("📋 MCP服务器列表"));
    console.log(chalk.gray("─".repeat(80)));
    console.log(
      chalk.gray("ID".padEnd(20) + "名称".padEnd(20) + "状态".padEnd(12) + "PID".padEnd(10) + "端口")
    );
    console.log(chalk.gray("─".repeat(80)));

    if (servers.length === 0) {
      console.log(chalk.yellow(" 暂无MCP服务器"));
      console.log();
      return;
    }

    for (const server of servers) {
      const statusColor = server.status === "running" ? chalk.green : chalk.red;
      const statusText = statusColor(server.status);
      console.log(
        server.id.padEnd(20) +
          (server.name || "").padEnd(20) +
          statusText.padEnd(12) +
          String(server.pid || "").padEnd(10) +
          String(server.port || "")
      );
    }
    console.log();
  }

  /**
   * 处理ui命令
   */
  private async handleUI(): Promise<void> {
    console.log("\n" + chalk.bold.blue("🌐 启动Web管理界面"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(" 正在启动Web服务器...");
    console.log(" 访问地址: http://localhost:3000");
    console.log(" 按 Ctrl+C 退出\n");
    console.log(chalk.gray("  （此为演示，不会启动真实Web服务器）\n"));
  }

  /**
   * 生成服务器ID
   */
  private generateServerId(): string {
    return `server-${Date.now()}`;
  }
}