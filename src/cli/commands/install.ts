import { Command } from 'commander';
import { getServerStatus, installServer } from '@cli/server.js';
import { parseEnvVars, parseHeaders } from '@cli/server.js';

/**
 * JSON config structure for server installation
 */
interface ServerJsonConfig {
  name: string;
  type?: 'stdio' | 'sse' | 'streamable-http';
  command?: string;
  url?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
  enabled?: boolean;
  description?: string;
  instanceSelectionStrategy?: 'random' | 'round-robin' | 'tag-match-unique';
}

/**
 * CLI command for installing a new MCP server to MCP Hub Lite.
 *
 * This command provides two modes of operation:
 *
 * 1. **Parametric mode** (default): Specify server properties via individual options
 * 2. **JSON mode** (--json): Pass a complete server configuration as JSON
 *
 * ## Parametric Mode
 *
 * ```
 * mcp-hub-lite install <name> <commandOrUrl> [args...]
 * ```
 *
 * ## JSON Mode
 *
 * ```
 * mcp-hub-lite install --json '{"name":"github-mcp","type":"stdio","command":"npx github-mcp"}'
 * ```
 *
 * @returns {Command} The configured install command instance for registration with Commander.js
 */
export const installCommand = new Command('install')
  .description('Add a new MCP server to MCP Hub Lite')
  .argument('[name]', 'Server name (required in parametric mode)')
  .argument('[commandOrUrl]', 'Command (stdio) or URL (sse/streamable-http)')
  .argument('[args...]', 'Command arguments (stdio only)')
  .option('-j, --json <config>', 'Server configuration as JSON')
  .option('-t, --transport <type>', 'Transport type (stdio, sse, streamable-http)', 'stdio')
  .option('-e, --env <env...>', 'Environment variables (KEY=VALUE)')
  .option('-H, --header <header...>', 'HTTP headers (Header-Key: Value)')
  .option('--timeout <seconds>', 'Timeout in seconds', parseInt, 60)
  .option(
    '--strategy <strategy>',
    'Instance selection strategy (random, round-robin, tag-match-unique)',
    'random'
  )
  .option('-a, --auto-start', 'Auto-start the server', true)
  .option('--no-auto-start', 'Disable auto-start')
  .option('-d, --description <description>', 'Server description')
  .addHelpText(
    'after',
    `

Modes:
  This command supports two modes - parametric (default) and JSON.

  # Parametric mode (individual options):
  mcp-hub-lite install github-mcp "npx github-mcp" --env API_KEY=xxx

  # JSON mode (complete config):
  mcp-hub-lite install --json '{"name":"github-mcp","type":"stdio","command":"npx github-mcp","env":{"API_KEY":"xxx"}}'

JSON config fields:
  name (required)           - Server name
  type                      - Transport type: stdio, sse, streamable-http (default: stdio)
  command                   - Command for stdio transport
  url                       - URL for sse/streamable-http transport
  args                      - Command arguments (stdio)
  env                       - Environment variables object
  headers                   - HTTP headers object
  timeout                   - Timeout in seconds (default: 60)
  enabled                   - Auto-start enabled (default: true)
  description               - Server description
  instanceSelectionStrategy - random, round-robin, tag-match-unique (default: random)

Examples:
  # Parametric mode
  mcp-hub-lite install github-mcp "npx github-mcp" --env API_KEY=xxx
  mcp-hub-lite install api-server https://api.example.com/mcp -t streamable-http -H "Authorization: Bearer xxx"

  # JSON mode
  mcp-hub-lite install --json '{"name":"github-mcp","type":"stdio","command":"npx github-mcp","env":{"API_KEY":"xxx"}}'
  mcp-hub-lite install --json '{"name":"api-server","type":"streamable-http","url":"https://api.example.com/mcp","headers":{"Authorization":"Bearer xxx"}}'
`
  )
  .action(async (name, commandOrUrl, args, options) => {
    try {
      // Check if server is running and get connection info
      const status = await getServerStatus();

      if (!status.running) {
        console.error('Error: MCP Hub Lite server is not running.');
        console.error('Start the server with: mcp-hub-lite start');
        process.exit(1);
      }

      // JSON mode
      if (options.json) {
        await handleJsonMode(options.json, status.host, status.port);
        return;
      }

      // Parametric mode
      await handleParametricMode(name, commandOrUrl, args, options, status.host, status.port);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * Handles JSON mode - installs server from complete JSON config
 */
async function handleJsonMode(jsonConfig: string, host: string, port: number): Promise<void> {
  let config: ServerJsonConfig;

  // Parse JSON
  try {
    config = JSON.parse(jsonConfig);
  } catch {
    console.error('Error: Invalid JSON format in --json option');
    process.exit(1);
  }

  // Validate required fields
  if (!config.name) {
    console.error('Error: "name" field is required in JSON config');
    process.exit(1);
  }

  // Validate transport type
  const transport = config.type || 'stdio';
  if (!['stdio', 'sse', 'streamable-http'].includes(transport)) {
    console.error(`Error: Invalid transport type "${config.type}"`);
    console.error('Valid types: stdio, sse, streamable-http');
    process.exit(1);
  }

  // Validate command/url based on transport
  const isHttpTransport = transport !== 'stdio';
  if (isHttpTransport && !config.url) {
    console.error(`Error: "url" field is required for transport type "${transport}"`);
    process.exit(1);
  }
  if (!isHttpTransport && !config.command) {
    console.error(`Error: "command" field is required for transport type "${transport}"`);
    process.exit(1);
  }

  // Validate URL format for HTTP transports
  if (isHttpTransport && config.url) {
    try {
      new URL(config.url);
    } catch {
      console.error(`Error: Invalid URL "${config.url}"`);
      process.exit(1);
    }
  }

  // Build install options
  const installOptions = {
    name: config.name,
    ...(isHttpTransport
      ? { url: config.url }
      : { command: config.command, args: config.args || [] }),
    transport: transport as 'stdio' | 'sse' | 'streamable-http',
    env: config.env || {},
    headers: config.headers || {},
    timeout: config.timeout || 60,
    autoStart: config.enabled !== false,
    instanceSelectionStrategy: config.instanceSelectionStrategy || 'random',
    description: config.description
  };

  // Install the server
  await installServer(installOptions, host, port);

  console.log(`Successfully installed server: ${config.name}`);
  console.log(`  Type: ${transport}`);
  if (isHttpTransport) {
    console.log(`  URL: ${config.url}`);
  } else {
    console.log(`  Command: ${config.command}`);
  }
  if (Object.keys(installOptions.env).length > 0) {
    console.log(`  Env: ${JSON.stringify(installOptions.env)}`);
  }
  if (Object.keys(installOptions.headers).length > 0) {
    console.log(`  Headers: ${JSON.stringify(installOptions.headers)}`);
  }
  if (installOptions.instanceSelectionStrategy !== 'random') {
    console.log(`  Strategy: ${installOptions.instanceSelectionStrategy}`);
  }
  if (config.description) {
    console.log(`  Description: ${config.description}`);
  }
}

/**
 * Handles parametric mode - installs server from individual options
 */
async function handleParametricMode(
  name: string | undefined,
  commandOrUrl: string | undefined,
  args: string[],
  options: {
    transport: string;
    env?: string[];
    header?: string[];
    timeout: number;
    strategy: string;
    autoStart: boolean;
    description?: string;
  },
  host: string,
  port: number
): Promise<void> {
  // Validate required positional arguments
  if (!name) {
    console.error('Error: Server name is required in parametric mode');
    console.error(
      'Or use --json mode for complete config: mcp-hub-lite install --json \'{"name":"..."}\''
    );
    process.exit(1);
  }
  if (!commandOrUrl) {
    console.error('Error: Command or URL is required in parametric mode');
    console.error(
      'Or use --json mode for complete config: mcp-hub-lite install --json \'{"name":"..."}\''
    );
    process.exit(1);
  }

  // Determine transport type
  const transportLower = options.transport.toLowerCase();
  if (!['stdio', 'sse', 'streamable-http'].includes(transportLower)) {
    console.error(`Error: Invalid transport type "${options.transport}"`);
    console.error('Valid types: stdio, sse, streamable-http');
    process.exit(1);
  }

  // Parse environment variables
  let env: Record<string, string> = {};
  if (options.env && options.env.length > 0) {
    try {
      env = parseEnvVars(options.env);
    } catch (error) {
      console.error(
        `Error: Invalid env format - ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  }

  // Parse HTTP headers
  let headers: Record<string, string> = {};
  if (options.header && options.header.length > 0) {
    try {
      headers = parseHeaders(options.header);
    } catch (error) {
      console.error(
        `Error: Invalid header format - ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  }

  // Determine if this is a URL (sse/streamable-http) or command (stdio)
  const isHttpTransport = transportLower !== 'stdio';

  // Validate that URL is provided for HTTP transports
  if (isHttpTransport) {
    try {
      new URL(commandOrUrl);
    } catch {
      console.error(`Error: Invalid URL "${commandOrUrl}" for transport type "${transportLower}"`);
      process.exit(1);
    }
  }

  // Parse strategy
  const strategyLower = options.strategy.toLowerCase();
  if (!['random', 'round-robin', 'tag-match-unique'].includes(strategyLower)) {
    console.error(`Error: Invalid strategy "${options.strategy}"`);
    console.error('Valid strategies: random, round-robin, tag-match-unique');
    process.exit(1);
  }

  // Build install options
  const installOptions = {
    name,
    ...(isHttpTransport ? { url: commandOrUrl } : { command: commandOrUrl, args }),
    transport: transportLower as 'stdio' | 'sse' | 'streamable-http',
    env,
    headers,
    timeout: options.timeout,
    autoStart: options.autoStart,
    instanceSelectionStrategy: strategyLower as 'random' | 'round-robin' | 'tag-match-unique',
    description: options.description
  };

  // Install the server
  await installServer(installOptions, host, port);

  console.log(`Successfully installed server: ${name}`);
  console.log(`  Type: ${transportLower}`);
  if (isHttpTransport) {
    console.log(`  URL: ${commandOrUrl}`);
  } else {
    console.log(`  Command: ${commandOrUrl}`);
  }
  if (Object.keys(env).length > 0) {
    console.log(`  Env: ${JSON.stringify(env)}`);
  }
  if (Object.keys(headers).length > 0) {
    console.log(`  Headers: ${JSON.stringify(headers)}`);
  }
  if (strategyLower !== 'random') {
    console.log(`  Strategy: ${strategyLower}`);
  }
  if (options.description) {
    console.log(`  Description: ${options.description}`);
  }
}
