/**
 * Dashboard核心功能测试脚本
 */

import chalk from "chalk";
import { DashboardService } from "./DashboardService.js";

async function runDashboardTests() {
  console.log(chalk.bold.blue("\n🧪 Dashboard核心功能POC测试"));
  console.log(chalk.gray("=".repeat(80)));

  const dashboard = new DashboardService();
  const testResults: Array<{
    name: string;
    status: "PASS" | "FAIL";
    duration: number;
  }> = [];

  // 测试1: 获取Dashboard数据
  console.log("\n" + chalk.bold("测试1: 获取Dashboard数据"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime1 = Date.now();
  try {
    const data = await dashboard.getDashboardData();
    const duration1 = Date.now() - startTime1;

    if (data.servers.length > 0 && data.metrics) {
      testResults.push({ name: "获取Dashboard数据", status: "PASS", duration: duration1 });
      console.log(chalk.green(`✅ PASS - 找到 ${data.servers.length} 个服务器 (${duration1}ms)`));
    } else {
      testResults.push({ name: "获取Dashboard数据", status: "FAIL", duration: duration1 });
      console.log(chalk.red(`❌ FAIL: 数据为空`));
    }
  } catch (error) {
    const duration1 = Date.now() - startTime1;
    testResults.push({ name: "获取Dashboard数据", status: "FAIL", duration: duration1 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试2: 获取服务器列表
  console.log("\n" + chalk.bold("测试2: 获取服务器列表"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime2 = Date.now();
  try {
    const servers = await dashboard.getServers();
    const duration2 = Date.now() - startTime2;

    if (servers.length >= 3) {
      testResults.push({ name: "获取服务器列表", status: "PASS", duration: duration2 });
      console.log(chalk.green(`✅ PASS - 列表包含 ${servers.length} 个服务器 (${duration2}ms)`));
    } else {
      testResults.push({ name: "获取服务器列表", status: "FAIL", duration: duration2 });
      console.log(chalk.red(`❌ FAIL: 服务器数量不足`));
    }
  } catch (error) {
    const duration2 = Date.now() - startTime2;
    testResults.push({ name: "获取服务器列表", status: "FAIL", duration: duration2 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试3: 搜索工具
  console.log("\n" + chalk.bold("测试3: 搜索工具"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime3 = Date.now();
  try {
    const results = await dashboard.searchTools("query");
    const duration3 = Date.now() - startTime3;

    if (results.length > 0) {
      testResults.push({ name: "搜索工具", status: "PASS", duration: duration3 });
      console.log(chalk.green(`✅ PASS - 搜索到 ${results.length} 个工具 (${duration3}ms)`));
    } else {
      testResults.push({ name: "搜索工具", status: "FAIL", duration: duration3 });
      console.log(chalk.red(`❌ FAIL: 未找到匹配工具`));
    }
  } catch (error) {
    const duration3 = Date.now() - startTime3;
    testResults.push({ name: "搜索工具", status: "FAIL", duration: duration3 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试4: 获取工具列表
  console.log("\n" + chalk.bold("测试4: 获取工具列表"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime4 = Date.now();
  try {
    const tools = await dashboard.getTools("server-1");
    const duration4 = Date.now() - startTime4;

    if (tools.length > 0) {
      testResults.push({ name: "获取工具列表", status: "PASS", duration: duration4 });
      console.log(chalk.green(`✅ PASS - 找到 ${tools.length} 个工具 (${duration4}ms)`));
    } else {
      testResults.push({ name: "获取工具列表", status: "FAIL", duration: duration4 });
      console.log(chalk.red(`❌ FAIL: 工具列表为空`));
    }
  } catch (error) {
    const duration4 = Date.now() - startTime4;
    testResults.push({ name: "获取工具列表", status: "FAIL", duration: duration4 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试5: 启动服务器
  console.log("\n" + chalk.bold("测试5: 启动服务器"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime5 = Date.now();
  try {
    await dashboard.startServer("server-3");
    const duration5 = Date.now() - startTime5;
    testResults.push({ name: "启动服务器", status: "PASS", duration: duration5 });
    console.log(chalk.green(`✅ PASS (${duration5}ms)`));
  } catch (error) {
    const duration5 = Date.now() - startTime5;
    testResults.push({ name: "启动服务器", status: "FAIL", duration: duration5 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试6: 停止服务器
  console.log("\n" + chalk.bold("测试6: 停止服务器"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime6 = Date.now();
  try {
    await dashboard.stopServer("server-3");
    const duration6 = Date.now() - startTime6;
    testResults.push({ name: "停止服务器", status: "PASS", duration: duration6 });
    console.log(chalk.green(`✅ PASS (${duration6}ms)`));
  } catch (error) {
    const duration6 = Date.now() - startTime6;
    testResults.push({ name: "停止服务器", status: "FAIL", duration: duration6 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试7: 调用工具
  console.log("\n" + chalk.bold("测试7: 调用工具"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime7 = Date.now();
  try {
    const result = await dashboard.callTool("server-1", "query");
    const duration7 = Date.now() - startTime7;

    if (result) {
      testResults.push({ name: "调用工具", status: "PASS", duration: duration7 });
      console.log(chalk.green(`✅ PASS (${duration7}ms)`));
    } else {
      testResults.push({ name: "调用工具", status: "FAIL", duration: duration7 });
      console.log(chalk.red(`❌ FAIL: 工具调用失败`));
    }
  } catch (error) {
    const duration7 = Date.now() - startTime7;
    testResults.push({ name: "调用工具", status: "FAIL", duration: duration7 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试8: 重启服务器
  console.log("\n" + chalk.bold("测试8: 重启服务器"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime8 = Date.now();
  try {
    await dashboard.restartServer("server-1");
    const duration8 = Date.now() - startTime8;
    testResults.push({ name: "重启服务器", status: "PASS", duration: duration8 });
    console.log(chalk.green(`✅ PASS (${duration8}ms)`));
  } catch (error) {
    const duration8 = Date.now() - startTime8;
    testResults.push({ name: "重启服务器", status: "FAIL", duration: duration8 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试9: 系统指标获取
  console.log("\n" + chalk.bold("测试9: 系统指标获取"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime9 = Date.now();
  try {
    const metrics = await dashboard.getMetrics();
    const duration9 = Date.now() - startTime9;

    if (metrics.cpu && metrics.memory && metrics.disk) {
      testResults.push({ name: "系统指标获取", status: "PASS", duration: duration9 });
      console.log(chalk.green(`✅ PASS - CPU: ${metrics.cpu.usage.toFixed(1)}% (${duration9}ms)`));
    } else {
      testResults.push({ name: "系统指标获取", status: "FAIL", duration: duration9 });
      console.log(chalk.red(`❌ FAIL: 指标数据不完整`));
    }
  } catch (error) {
    const duration9 = Date.now() - startTime9;
    testResults.push({ name: "系统指标获取", status: "FAIL", duration: duration9 });
    console.log(chalk.red(`❌ FAIL: ${error}`));
  }

  // 测试10: Dashboard操作执行
  console.log("\n" + chalk.bold("测试10: Dashboard操作执行"));
  console.log(chalk.gray("-".repeat(80)));
  const startTime10 = Date.now();
  try {
    await dashboard.executeAction({
      type: "START_SERVER",
      payload: { serverId: "server-3" }
    });
    const duration10 = Date.now() - startTime10;
    testResults.push({ name: "Dashboard操作执行", status: "PASS", duration: duration10 });
    console.log(chalk.green(`✅ PASS (${duration10}ms)`));
  } catch (error) {
    const duration10 = Date.now() - startTime10;
    testResults.push({ name: "Dashboard操作执行", status: "FAIL", duration: duration10 });
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
    console.log(chalk.bold.green("🎉 所有测试通过！Dashboard核心功能POC验证成功"));
  } else {
    console.log(chalk.bold.yellow("⚠️ 部分测试失败，需要进一步调试"));
  }

  console.log("\n");
}

runDashboardTests().catch(error => {
  console.error(chalk.red("❌ 测试执行失败:"), error);
  process.exit(1);
});