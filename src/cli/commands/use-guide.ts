import { Command } from 'commander';

/**
 * CLI use guide content
 */
const USE_GUIDE_CONTENT = `# MCP Hub Lite CLI Use Guide

## Overview

MCP Hub Lite CLI provides command-line interface for managing MCP servers. This guide covers CLI-specific usage only.

## Commands

### start

Start the MCP Hub Lite server.

\`\`\`bash
# Start in daemon mode (default)
mcp-hub-lite start

# Start in foreground mode
mcp-hub-lite start --foreground

# Start with custom port
mcp-hub-lite start --port 8080
\`\`\`

### stop

Stop the running MCP Hub Lite server.

\`\`\`bash
mcp-hub-lite stop
\`\`\`

### status

Display server status and connected MCP servers.

\`\`\`bash
mcp-hub-lite status
\`\`\`

### ui

Open the web UI in default browser.

\`\`\`bash
mcp-hub-lite ui
\`\`\`

### list

List all configured MCP servers.

\`\`\`bash
mcp-hub-lite list
\`\`\`

### restart

Restart the MCP Hub Lite server.

\`\`\`bash
mcp-hub-lite restart
\`\`\`

### install

Add a new MCP server to MCP Hub Lite.

**Parametric Mode:**

\`\`\`bash
# stdio server
mcp-hub-lite install github-mcp "npx github-mcp" --env API_KEY=xxx

# HTTP server
mcp-hub-lite install api-server https://api.example.com/mcp -t streamable-http -H "Authorization: Bearer xxx"
\`\`\`

**JSON Mode:**

\`\`\`bash
# stdio server
mcp-hub-lite install --json '{"name":"github-mcp","type":"stdio","command":"npx github-mcp","env":{"API_KEY":"xxx"}}'

# HTTP server
mcp-hub-lite install --json '{"name":"api-server","type":"streamable-http","url":"https://api.example.com/mcp","headers":{"Authorization":"Bearer xxx"}}'
\`\`\`

**Options:**

| Option                     | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| \`-t, --transport <type>\`   | Transport type: stdio, sse, streamable-http (default: stdio) |
| \`-e, --env <env...>\`       | Environment variables (KEY=VALUE)                            |
| \`-H, --header <header...>\` | HTTP headers (Header-Key: Value)                             |
| \`--timeout <seconds>\`      | Timeout in seconds (default: 60)                             |
| \`--strategy <strategy>\`    | Instance selection: random, round-robin, tag-match-unique    |
| \`-a, --auto-start\`         | Auto-start server (default: true)                            |
| \`--no-auto-start\`          | Disable auto-start                                           |
| \`-d, --description <desc>\` | Server description                                           |

**JSON Config Fields:**

| Field                       | Required    | Description                     |
| --------------------------- | ----------- | ------------------------------- |
| \`name\`                      | Yes         | Server name                     |
| \`type\`                      | No          | Transport type (default: stdio) |
| \`command\`                   | Yes (stdio) | Command to execute              |
| \`url\`                       | Yes (HTTP)  | Server URL                      |
| \`args\`                      | No          | Command arguments               |
| \`env\`                       | No          | Environment variables object    |
| \`headers\`                   | No          | HTTP headers object             |
| \`timeout\`                   | No          | Timeout in seconds              |
| \`enabled\`                   | No          | Auto-start enabled              |
| \`description\`               | No          | Server description              |
| \`instanceSelectionStrategy\` | No          | Instance selection strategy     |

### tool-use

Manage MCP server tools via API.

\`\`\`bash
# List all connected servers
mcp-hub-lite tool-use list-servers

# List system tools
mcp-hub-lite tool-use list-tools

# List tools from specific server
mcp-hub-lite tool-use list-tools --server baidu-search

# Get tool schema
mcp-hub-lite tool-use get-tool --tool list_tools

# Call a tool
mcp-hub-lite tool-use call-tool --tool search --server baidu-search --args '{"query":"天气"}'
\`\`\`

**Options:**

| Option            | Description                                 |
| ----------------- | ------------------------------------------- |
| \`--server <name>\` | Server name (default: mcp-hub-lite)         |
| \`--tool <name>\`   | Tool name (required for get-tool/call-tool) |
| \`--args <json>\`   | Tool arguments JSON                         |
| \`--tags <json>\`   | Instance selection tags                     |

**JSON Merge Form:**

\`\`\`bash
# All parameters in one JSON
mcp-hub-lite tool-use call-tool --args '{"server":"baidu-search","tool":"search","query":"天气"}'
\`\`\`

---

_Last updated: 2026-04-20_
`;

/**
 * CLI command for displaying the use guide in Markdown format.
 *
 * This command outputs the CLI usage guide, similar to how MCP Hub Lite
 * provides a use-guide resource for MCP protocol usage.
 *
 * @returns {Command} The configured use-guide command instance for registration with Commander.js
 */
export const useGuideCommand = new Command('use-guide')
  .description('Output CLI usage guide in Markdown format')
  .action(() => {
    process.stdout.write(USE_GUIDE_CONTENT);
    process.exit(0);
  });
