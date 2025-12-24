#!/usr/bin/env node

/**
 * MCP Hub Lite CLI入口点
 * 演示6个核心命令的可行性验证
 */

import { CliCommandHandler } from "./CliCommandHandler.js";

async function main() {
  const handler = new CliCommandHandler();

  try {
    await handler.init();
    handler.parse(process.argv);
  } catch (error) {
    console.error("初始化失败:", error);
    process.exit(1);
  }
}

main();