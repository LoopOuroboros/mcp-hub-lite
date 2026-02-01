import { Command } from 'commander';
import { listServers } from '@cli/server.js';

export const listCommand = new Command('list')
  .description('List all configured MCP servers')
  .option('--format <format>', 'Output format (json, table)', 'table')
  .action(async (options) => {
    try {
      const servers = await listServers();

      if (options.format === 'json') {
        console.log(JSON.stringify(servers, null, 2));
      } else {
        // Table format
        console.log('MCP Servers:');
        console.table(servers.map(server => ({
          Name: server.name,
          // 现在需要显示服务器实例信息
          Instances: server.instances?.length || 0,
          Type: server.config.type,
          Enabled: server.config.enabled
        })));
      }
    } catch (error) {
      console.error('Failed to list servers:', error);
      process.exit(1);
    }
  });