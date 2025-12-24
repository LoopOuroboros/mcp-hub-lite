import { MCPGateway } from './MCPGateway.js';

/**
 * 启动 MCP Gateway POC
 */
async function main() {
  console.log('🚀 Starting MCP Gateway POC...\n');

  const gateway = new MCPGateway();
  await gateway.start(3000);

  console.log('\n✅ MCP Gateway POC started successfully!');
  console.log('   Health check: http://localhost:3000/health');
  console.log('   Server list: http://localhost:3000/api/servers');
  console.log('   API documentation: http://localhost:3000/docs\n');

  // 保持服务器运行
  process.on('SIGTERM', async () => {
    console.log('\n📴 Shutting down MCP Gateway...');
    await gateway.stop();
    process.exit(0);
  });
}

main();