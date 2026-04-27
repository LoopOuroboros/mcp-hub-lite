import { Command } from 'commander';
import { getServerStatus } from '@cli/server.js';

/**
 * CLI command for dynamic MCP server tool operations via API.
 *
 * This command provides a simplified CLI interface for interacting with MCP server tools,
 * supporting five actions: list-servers, list-tools, list-tags, get-tool, and call-tool. It wraps
 * the HTTP API endpoints and requires the MCP Hub Lite server to be running.
 *
 * ## Command Format
 *
 * ```
 * mcp-hub-lite tool-use <action> [--server <serverName>] [--tool <toolName>] [--args <json>] [--tags <json>]
 * ```
 *
 * Or via npm:
 * ```
 * npm run tool-use -- <action> [--server <serverName>] [--tool <toolName>] [--args <json>] [--tags <json>]
 * ```
 *
 * ## Supported Actions
 *
 * - `list-servers` - List all connected MCP servers
 * - `list-tools` - List all tools from the specified server
 * - `list-tags` - List all instance tags for a specific MCP server
 * - `get-tool` - Get complete schema for a specific tool (requires --tool)
 * - `call-tool` - Call a tool on the specified server (requires --tool)
 *
 * ## Options
 *
 * - `--server <serverName>` - Server name to target (use "mcp-hub-lite" for system tools)
 * - `--tool <toolName>` - Tool name (required for get-tool and call-tool actions)
 * - `--args <json>` - JSON string of tool arguments, or combined JSON with server/tool/args fields
 * - `--tags <json>` - JSON object of instance selection tags (call-tool only, for multi-instance servers)
 *
 * ## JSON Merge Logic
 *
 * When `--args` contains `server`, `tool`, or `args` fields, they are extracted and merged:
 * - `server` field → effective server name
 * - `tool` field → effective tool name
 * - `args` field → tool arguments
 * - Other fields → treated as tool arguments
 *
 * This allows passing all parameters in a single JSON object via --args.
 *
 * ## Usage Examples
 *
 * ###分散参数形式 (Separate Arguments):
 *
 * ```bash
 * # List all connected servers
 * mcp-hub-lite tool-use list-servers
 *
 * # List system tools
 * mcp-hub-lite tool-use list-tools --server mcp-hub-lite
 *
 * # List third-party server tools
 * mcp-hub-lite tool-use list-tools --server baidu-search
 *
 * # List instance tags for a server
 * mcp-hub-lite tool-use list-tags --server chrome-devtools
 *
 * # Get system tool schema
 * mcp-hub-lite tool-use get-tool --tool list_tools --server mcp-hub-lite
 *
 * # Call system tool
 * mcp-hub-lite tool-use call-tool --tool list_tools --server mcp-hub-lite --args '{}'
 *
 * # Call third-party server tool
 * mcp-hub-lite tool-use call-tool --tool search --server baidu-search --args '{"query":"天气"}'
 *
 * # Multi-instance server with tags
 * mcp-hub-lite tool-use call-tool --tool search --server baidu-search --args '{"query":"test"}' --tags '{"env":"prod"}'
 * ```
 *
 * ### JSON 合并形式 (JSON Merge):
 *
 * ```bash
 * # All parameters in one JSON
 * mcp-hub-lite tool-use call-tool --args '{"server":"baidu-search","tool":"search","query":"天气"}'
 *
 * # System tool example
 * mcp-hub-lite tool-use call-tool --args '{"server":"mcp-hub-lite","tool":"list_tools"}'
 *
 * # Equivalent to
 * mcp-hub-lite tool-use call-tool --server baidu-search --tool search --args '{"query":"天气"}'
 * ```
 *
 * ## Error Handling
 *
 * - Exits with code 1 if the server is not running
 * - Exits with code 1 if action is unknown
 * - Exits with code 1 if toolName is required but not provided
 * - Exits with code 1 if JSON parsing fails for --args or --tags
 * - Exits with code 1 if the underlying API call fails
 *
 * @returns {Command} The configured mcp-tool-use command instance for registration with Commander.js
 */
export const toolUseCommand = new Command('tool-use')
  .description(
    'Manage MCP server tools via API (list-servers, list-tools, list-tags, get-tool, call-tool)'
  )
  .argument('<action>', 'Action: list-servers, list-tools, list-tags, get-tool, call-tool')
  .option('--server <serverName>', 'Server name to target (omit or empty for system tools)')
  .option('--tool <toolName>', 'Tool name (required for get-tool and call-tool actions)')
  .option(
    '--args <json>',
    'JSON string of tool arguments, or combined JSON with server/tool/args fields'
  )
  .option(
    '--tags <json>',
    'JSON object of instance selection tags (call-tool only, for multi-instance servers)'
  )
  .addHelpText(
    'after',
    `

Examples:
  # List all connected servers
  mcp-hub-lite tool-use list-servers

  # List mcp-hub-lite system tools (default)
  mcp-hub-lite tool-use list-tools

  # List third-party server tools
  mcp-hub-lite tool-use list-tools --server baidu-search

  # List instance tags for a server
  mcp-hub-lite tool-use list-tags --server chrome-devtools

  # Get system tool schema
  mcp-hub-lite tool-use get-tool --tool list_tools

  # Call third-party server tool
  mcp-hub-lite tool-use call-tool --tool search --server baidu-search --args '{"query":"天气"}'

  # JSON merge form (all params in one JSON)
  mcp-hub-lite tool-use call-tool --args '{"server":"baidu-search","tool":"search","query":"天气"}'
`
  )
  .action(async (action, options) => {
    try {
      // Check if server is running and get connection info
      const status = await getServerStatus();

      if (!status.running) {
        console.error('Error: MCP Hub Lite server is not running.');
        console.error('Start the server with: mcp-hub-lite start');
        process.exit(1);
      }

      // Parse JSON merge logic: extract server, tool, and args from --args if present
      let toolArgs: Record<string, unknown> = {};
      // When --server is not provided, default to mcp-hub-lite (system tools)
      const defaultServer = 'mcp-hub-lite';
      let effectiveServer = options.server || defaultServer;
      let effectiveTool = options.tool ?? '';

      if (options.args) {
        try {
          const parsedArgs = JSON.parse(options.args);
          // Extract server and tool from JSON if present
          if (parsedArgs.server !== undefined) {
            effectiveServer = parsedArgs.server;
          }
          if (parsedArgs.tool !== undefined) {
            effectiveTool = parsedArgs.tool;
          }
          // Extract args if present, otherwise treat other fields as tool args
          if (parsedArgs.args !== undefined) {
            toolArgs = parsedArgs.args as Record<string, unknown>;
          } else {
            // Other fields (excluding server and tool) are treated as tool args
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { server: _server, tool: _tool, ...rest } = parsedArgs;
            toolArgs = rest;
          }
        } catch {
          // If JSON parsing fails, treat the entire content as tool args
          try {
            toolArgs = JSON.parse(options.args);
          } catch {
            console.error('Error: Invalid JSON in --args option');
            process.exit(1);
          }
        }
      }

      const baseUrl = `http://${status.host}:${status.port}`;

      switch (action) {
        case 'list-servers': {
          const response = await fetch(`${baseUrl}/web/hub-tools/servers`, {
            headers: { Accept: 'application/json' }
          });
          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }
          const result = await response.json();
          console.log(JSON.stringify(result, null, 2));
          break;
        }
        case 'list-tools': {
          const tagsParam = options.tags ? `?tags=${encodeURIComponent(options.tags)}` : '';
          const response = await fetch(
            `${baseUrl}/web/hub-tools/servers/${effectiveServer}/tools${tagsParam}`,
            {
              headers: { Accept: 'application/json' }
            }
          );
          if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(
              (error as { message?: string }).message || `API error: ${response.status}`
            );
          }
          const result = await response.json();
          console.log(JSON.stringify(result, null, 2));
          break;
        }
        case 'get-tool': {
          if (!effectiveTool) {
            console.error('Error: toolName is required for get-tool action');
            process.exit(1);
          }
          const tagsParam = options.tags ? `?tags=${encodeURIComponent(options.tags)}` : '';
          const response = await fetch(
            `${baseUrl}/web/hub-tools/servers/${effectiveServer}/tools/${effectiveTool}${tagsParam}`,
            { headers: { Accept: 'application/json' } }
          );
          if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(
              (error as { message?: string }).message || `API error: ${response.status}`
            );
          }
          const result = await response.json();
          console.log(JSON.stringify(result, null, 2));
          break;
        }
        case 'list-tags': {
          if (!effectiveServer || effectiveServer === defaultServer) {
            effectiveServer = 'mcp-hub-lite';
          }
          const tagsParam = options.tags ? `?tags=${encodeURIComponent(options.tags)}` : '';
          const response = await fetch(
            `${baseUrl}/web/hub-tools/servers/${effectiveServer}/tags${tagsParam}`,
            {
              headers: { Accept: 'application/json' }
            }
          );
          if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(
              (error as { message?: string }).message || `API error: ${response.status}`
            );
          }
          const result = await response.json();
          console.log(JSON.stringify(result, null, 2));
          break;
        }
        case 'call-tool': {
          if (!effectiveTool) {
            console.error('Error: toolName is required for call-tool action');
            process.exit(1);
          }
          // Parse tags for instance selection (call-tool only)
          let requestOptions: { tags?: Record<string, string> } | undefined;
          if (options.tags) {
            try {
              requestOptions = { tags: JSON.parse(options.tags) };
            } catch {
              console.error('Error: Invalid JSON in --tags option');
              process.exit(1);
            }
          }
          const response = await fetch(
            `${baseUrl}/web/hub-tools/servers/${effectiveServer}/tools/${effectiveTool}/call`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
              },
              body: JSON.stringify({ toolArgs, requestOptions })
            }
          );
          if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(
              (error as { message?: string }).message || `API error: ${response.status}`
            );
          }
          const result = await response.json();
          console.log(JSON.stringify(result, null, 2));
          break;
        }
        default: {
          console.error(`Unknown action: ${action}`);
          console.error('Valid actions: list-servers, list-tools, list-tags, get-tool, call-tool');
          process.exit(1);
        }
      }
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
