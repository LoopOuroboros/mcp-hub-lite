# Quickstart Guide: MCP-HUB-LITE

## Prerequisites

- Node.js 20.x or higher
- npm or yarn package manager
- Windows, macOS, or Linux operating system
- Access to command line interface (PowerShell/CMD on Windows, Terminal on macOS/Linux)

## Installation

### Option 1: Using npm
```bash
# Install globally
npm install -g mcp-hub-lite

# Start the service
mcp-hub-lite start

# Check service status
mcp-hub-lite status

# Stop the service
mcp-hub-lite stop

# Open web interface (default port 7788)
# Already started automatically when running 'mcp-hub-lite start'

# Open UI in default browser
mcp-hub-lite ui

# List all MCP servers
mcp-hub-lite list

# Restart servers (optionally specify serverId)
mcp-hub-lite restart [serverId]
```

### Option 2: From source
```bash
# Clone or download the project
git clone <repository-url>
cd mcp-hub-lite

# Install dependencies
npm install

# Build the project (frontend + backend)
npm run build

# Start development server
npm run dev

# Or directly call the CLI (after build)
node dist/cli.js start
```

## Configuration

### Default Configuration File
The system uses `.mcp-hub.json` for configuration. By default, it looks for configuration in these locations (in order):

1. Path specified by `MCP_HUB_CONFIG_PATH` environment variable
2. `.mcp-hub.json` in current directory
3. `config/.mcp-hub.json`
4. `~/.mcp-hub.json`

### Sample Configuration
```json
{
  "version": "1.0.0",
  "servers": [
    {
      "id": "server-1",
      "name": "My MCP Server",
      "description": "Example MCP server",
      "endpoint": "http://localhost:8080",
      "transport": "http-stream",
      "tags": {
        "env": "development",
        "category": "api-server",
        "function": "http-api",
        "priority": "medium"
      },
      "managedProcess": {
        "command": "npx my-mcp-server",
        "args": [],
        "env": {},
        "timeout": 30
      }
    }
  ],
  "settings": {
    "language": {
      "current": "zh-CN",
      "autoDetect": true,
      "fallback": "zh-CN"
    },
    "logging": {
      "level": "info"
    }
  },
  "gateway": {
    "proxyTimeout": 30000,
    "rateLimit": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000
    }
  }
}
```

## Adding Your First MCP Server

1. **Access the Dashboard**: Open your browser and navigate to `http://localhost:7788`

2. **Navigate to Servers**: Click on "Servers" in the sidebar navigation

3. **Add New Server**: Click the "Add Server" button

4. **Configure Server**: Fill in the server details:
   - **Name**: A friendly name for the server
   - **Endpoint**: The HTTP endpoint of your MCP server (e.g., `http://localhost:8080`)
   - **Transport**: Select the appropriate transport type (`http-stream` - Lite版本仅支持)
   - **Tags**: Assign tags to categorize the server (comma separated, e.g., "development,api-server,production")
   - **Managed Process**: If the server should be managed by MCP-HUB-LITE, configure:
     - **Command**: The command to start the server (e.g., `npx my-mcp-server`)
     - **Arguments**: Additional command arguments
     - **Environment**: Environment variables for the process

5. **Save Configuration**: Click "Save" to add the server to the system

## Using the Gateway

### MCP Protocol Access
The MCP-HUB-LITE gateway exposes the MCP JSON-RPC 2.0 protocol on the same port:

#### List All Tools
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "params": {},
  "id": "1"
}
```

#### Call a Tool
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "example-tool",
    "arguments": {
      "param1": "value1"
    }
  },
  "id": "2"
}
```

### Web Interface Search
Use the search bar in the dashboard to find tools by name or description across all connected servers.

## Process Management

### Starting/Stopping Managed Servers
In the dashboard interface:
1. Navigate to the "Servers" page
2. Click the status indicator or "Start"/"Stop" button next to each server
3. The system will start or stop the managed process as configured

### Monitoring Resource Usage
- CPU and memory usage of managed processes is displayed in the server list
- Server uptime and health status are shown in real-time

## Tag Management

### Using Tags
1. When adding a server, specify tags in the structured object format: {"env": "production", "category": "database", "function": "mysql"}
2. Each tag follows a key-value structure for clearer classification
3. Tags enable precise organization and filtering of MCP servers

### Managing Tags
- Tags allow you to organize your MCP servers with structured key-value pairs (e.g., {"env": "production", "category": "database"})
- Search and tool discovery can be filtered by specific tag keys and values
- Each server has a single tag object with multiple key-value pairs
- Use descriptive tag keys for better organization (e.g., "env", "category", "function", "priority")

## Language Settings

### Changing Language
1. Click the language toggle in the top navigation bar
2. Select between Chinese (中文) and English (English)
3. The change applies immediately to the dashboard and MCP responses

## Backup and Restore

### Automatic Backups
The system automatically creates backups of your configuration file when changes are made:
- Backup files follow the naming pattern: `.mcp-hub.json.{yyyy-MM-ddTHH-mm-ssZ}.bak`
- The last 7 versions are retained automatically
- Older backups are deleted to save space

### Manual Backup
1. Navigate to the "Settings" page in the dashboard
2. Click "Create Backup" to manually create a configuration backup

### Restore Configuration
1. Go to "Settings" → "Backup Management"
2. Select a backup file from the list
3. Click "Restore" to apply the previous configuration

## API Endpoints

### Server Management
- `GET /api/servers` - Get all configured MCP servers
- `POST /api/servers` - Add a new MCP server
- `GET /api/servers/{serverId}` - Get server details
- `PUT /api/servers/{serverId}` - Update server configuration
- `DELETE /api/servers/{serverId}` - Remove server
- `POST /api/servers/{serverId}/start` - Start managed server
- `POST /api/servers/{serverId}/stop` - Stop managed server

### Tool Search
- `GET /web/search?q={query}` - Search tools across all servers

### Tag Management
- `GET /api/servers` - Get all servers (supports tag filtering)
- `GET /api/servers?tags=env:production` - Get servers by tag filter

### Configuration
- `GET /api/config` - Get system configuration
- `PUT /api/config` - Update system configuration
- `POST /api/config/validate` - Validate configuration without applying

## Troubleshooting

### Server Status Issues
- If a server shows as "error", check the server's endpoint is accessible
- Verify the transport protocol matches the server's capabilities
- Check the managed process command if using process management

### Search Not Finding Tools
- Ensure the target MCP servers are online
- Verify the servers have tools available
- Check that the search index has been updated

### Dashboard Not Loading
- Verify the service is running (default port 7788)
- Clear browser cache if interface appears broken
- Check the service logs for errors