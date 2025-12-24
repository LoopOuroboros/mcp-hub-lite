/**
 * 配置管理器测试脚本
 * 验证配置文件加载、保存、验证、导出、导入、备份和降级
 */

import { ConfigManager } from "./config-manager.js";
import chalk from "chalk";

async function runConfigManagerTests() {
  console.log(chalk.bold.blue("\n🧪 配置管理POC测试"));
  console.log(chalk.gray("=".repeat(80)));

  const testDir = `./test-config-${Date.now()}`;
  const configManager = new ConfigManager(
    `${testDir}/mcp-hub-config.json`,
    `${testDir}/backups`
  );

  const testResults: Array<{
    name: string;
    status: "PASS" | "FAIL";
    duration: number;
    output?: string;
  }> = [];

  // 测试1: 初始化配置管理器
  console.log("\n" + chalk.bold("测试1: 初始化配置管理器"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime1 = Date.now();
  try {
    await configManager.init();
    const duration1 = Date.now() - startTime1;
    testResults.push({ name: "初始化配置管理器", status: "PASS", duration: duration1 });
    console.log(chalk.green(`✅ PASS (${duration1}ms)`));
  } catch (error) {
    const duration1 = Date.now() - startTime1;
    testResults.push({ name: "初始化配置管理器", status: "FAIL", duration: duration1 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试2: 创建并保存配置
  console.log("\n" + chalk.bold("测试2: 保存配置"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime2 = Date.now();
  try {
    const testConfig = {
      servers: [
        {
          id: "test-server-1",
          name: "测试服务器1",
          command: "npx",
          args: ["-y", "@mcp/server-test"],
          port: 3001,
          tags: { category: "test" }
        }
      ],
      global: {
        port: 3000,
        host: "localhost",
        cors: {
          enabled: true,
          allowedOrigins: ["*"]
        },
        rateLimit: {
          enabled: true,
          requestsPerMinute: 100
        }
      },
      logging: {
        level: "info" as const,
        output: "console" as const
      },
      backup: {
        enabled: true,
        interval: 24,
        maxBackups: 10,
        path: `${testDir}/backups`
      }
    };

    await configManager.saveConfig(testConfig);
    const duration2 = Date.now() - startTime2;
    testResults.push({ name: "保存配置", status: "PASS", duration: duration2 });
    console.log(chalk.green(`✅ PASS (${duration2}ms)`));
  } catch (error) {
    const duration2 = Date.now() - startTime2;
    testResults.push({ name: "保存配置", status: "FAIL", duration: duration2 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试3: 加载配置
  console.log("\n" + chalk.bold("测试3: 加载配置"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime3 = Date.now();
  try {
    const config = await configManager.loadConfig();
    const duration3 = Date.now() - startTime3;
    if (config && config.data.servers.length >= 1) {
      testResults.push({ name: "加载配置", status: "PASS", duration: duration3 });
      console.log(chalk.green(`✅ PASS - 成功加载配置，包含 ${config.data.servers.length} 个服务器 (${duration3}ms)`));
    } else {
      testResults.push({ name: "加载配置", status: "FAIL", duration: duration3 });
      console.log(chalk.red(`❌ FAIL: 配置加载失败或为空`));
    }
  } catch (error) {
    const duration3 = Date.now() - startTime3;
    testResults.push({ name: "加载配置", status: "FAIL", duration: duration3 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试4: 配置验证
  console.log("\n" + chalk.bold("测试4: 配置验证"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime4 = Date.now();
  try {
    const testConfigInvalid = {
      servers: [
        {
          id: "", // 无效ID
          name: "无效服务器",
          command: "npx",
          args: [],
          port: 80 // 无效端口
        }
      ],
      global: {
        port: 3000,
        host: "localhost",
        cors: {
          enabled: true,
          allowedOrigins: ["*"]
        },
        rateLimit: {
          enabled: true,
          requestsPerMinute: 100
        }
      },
      logging: {
        level: "info" as const,
        output: "console" as const
      },
      backup: {
        enabled: false,
        interval: 24,
        maxBackups: 10,
        path: "./backups"
      }
    };

    const validation = configManager.validateConfig(testConfigInvalid);
    const duration4 = Date.now() - startTime4;

    if (!validation.isValid && validation.errors.length > 0) {
      testResults.push({ name: "配置验证", status: "PASS", duration: duration4 });
      console.log(chalk.green(`✅ PASS - 成功检测到 ${validation.errors.length} 个验证错误 (${duration4}ms)`));
    } else {
      testResults.push({ name: "配置验证", status: "FAIL", duration: duration4 });
      console.log(chalk.red(`❌ FAIL: 未检测到无效配置`));
    }
  } catch (error) {
    const duration4 = Date.now() - startTime4;
    testResults.push({ name: "配置验证", status: "FAIL", duration: duration4 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试5: 配置导出
  console.log("\n" + chalk.bold("测试5: 配置导出"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime5 = Date.now();
  try {
    await configManager.exportConfig(`${testDir}/exported-config`);
    const duration5 = Date.now() - startTime5;
    testResults.push({ name: "配置导出", status: "PASS", duration: duration5 });
    console.log(chalk.green(`✅ PASS (${duration5}ms)`));
  } catch (error) {
    const duration5 = Date.now() - startTime5;
    testResults.push({ name: "配置导出", status: "FAIL", duration: duration5 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试6: 配置导入
  console.log("\n" + chalk.bold("测试6: 配置导入"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime6 = Date.now();
  try {
    const importedConfig = await configManager.importConfig(`${testDir}/exported-config.json`);
    const duration6 = Date.now() - startTime6;
    if (importedConfig) {
      testResults.push({ name: "配置导入", status: "PASS", duration: duration6 });
      console.log(chalk.green(`✅ PASS - 成功导入配置 (${duration6}ms)`));
    } else {
      testResults.push({ name: "配置导入", status: "FAIL", duration: duration6 });
      console.log(chalk.red(`❌ FAIL: 导入的空`));
    }
  } catch (error) {
    const duration6 = Date.now() - startTime6;
    testResults.push({ name: "配置导入", status: "FAIL", duration: duration6 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试7: 备份功能
  console.log("\n" + chalk.bold("测试7: 备份功能"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime7 = Date.now();
  try {
    const config = await configManager.loadConfig();
    if (config) {
      await configManager.saveConfig(config.data, { createBackup: true });
      const backups = await configManager.listBackups();
      const duration7 = Date.now() - startTime7;
      if (backups.length > 0) {
        testResults.push({ name: "备份功能", status: "PASS", duration: duration7 });
        console.log(chalk.green(`✅ PASS - 成功创建和列出备份，当前有 ${backups.length} 个备份 (${duration7}ms)`));
      } else {
        testResults.push({ name: "备份功能", status: "FAIL", duration: duration7 });
        console.log(chalk.yellow(`⚠️ PARTIAL - 备份创建成功但列表为空 (${duration7}ms)`));
      }
    } else {
      const duration7 = Date.now() - startTime7;
      testResults.push({ name: "备份功能", status: "FAIL", duration: duration7 });
      console.log(chalk.red(`❌ FAIL: 无法加载配置进行备份`));
    }
  } catch (error) {
    const duration7 = Date.now() - startTime7;
    testResults.push({ name: "备份功能", status: "FAIL", duration: duration7 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试总结
  console.log("\n" + chalk.bold.blue("📊 测试总结"));
  console.log(chalk.gray("=".repeat(80)));
  const passed = testResults.filter(t => t.status === "PASS").length;
  const failed = testResults.filter(t => t.status === "FAIL").length;
  const total = testResults.length;

  console.log(` 总测试数: ${total}`);
  console.log(chalk.green(` 通过: ${passed}`));
  console.log(chalk.red(` 失败: ${failed}`));
  console.log(` 成功率: ${((passed / total) * 100).toFixed(1)}%`);
  console.log();

  // 详细结果
  console.log(chalk.bold("详细结果:"));
  for (const result of testResults) {
    const icon = result.status === "PASS" ? "✅" : "❌";
    const color = result.status === "PASS" ? chalk.green : chalk.red;
    console.log(` ${color(icon)} ${result.name.padEnd(20)} ${result.status.padEnd(6)} ${result.duration}ms`);
  }
  console.log();

  // 结论
  if (failed === 0) {
    console.log(chalk.bold.green("🎉 所有测试通过！配置管理POC验证成功"));
  } else {
    console.log(chalk.bold.yellow("⚠️ 部分测试失败，需要进一步调试"));
  }

  console.log("\n");
}

// 运行测试
runConfigManagerTests().catch(error => {
  console.error(chalk.red("❌ 测试执行失败:"), error);
  process.exit(1);
});