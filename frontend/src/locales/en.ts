export default {
  sidebar: {
    title: 'MCP Server Manager',
    dashboard: 'Dashboard',
    servers: 'MCP Servers',
    addServer: 'Add New Server'
  },
  dashboard: {
    title: 'Dashboard',
    totalServers: 'Total Servers',
    running: 'Running',
    errors: 'Errors',
    recentActivity: 'Recent Activity'
  },
  serverDetail: {
    emptySelect: 'Select a server to view details',
    noServerSelected: 'No server selected',
    deleteConfirm: 'Are you sure you want to delete this server?',
    version: 'Version',
    tabs: {
      config: 'Configuration',
      logs: 'Logs',
      tools: 'Tools',
      resources: 'Resources'
    },
    config: {
      transport: 'Transport',
      transportStdio: 'Standard Input/Output (stdio)',
      transportSse: 'Server-Sent Events (sse)',
      transportHttp: 'Streamable HTTP (streamableHttp)',
      executable: 'Executable',
      args: 'Arguments',
      url: 'URL',
      env: 'Environment Variables',
      timeout: 'Timeout (s)',
      autoStart: 'Auto-start',
      addArg: 'Add Argument',
      addEnv: 'Add Environment Variable',
      save: 'Save Configuration',
      editByJson: 'Edit By Json'
    },
    logs: {
      autoScroll: 'Auto-scroll',
      clear: 'Clear',
      copy: 'Copy',
      copied: 'Logs copied to clipboard'
    },
    tools: {
      available: 'Available Tools',
      details: 'Tool Details',
      schema: 'Schema (JSON)',
      selectHint: 'Select a tool to view details',
      none: 'No tools available'
    },
    resources: {
      name: 'Name',
      uri: 'URI',
      mimeType: 'MIME Type',
      none: 'No resources available'
    },
    status: {
      running: 'Running',
      stopped: 'Stopped',
      error: 'Error'
    }
  },
  addServer: {
    title: 'Add New MCP Server',
    transportType: 'Select Transport Type',
    name: 'Server Name',
    namePlaceholder: 'My New Server',
    executablePlaceholder: '/path/to/executable or npx',
    argPlaceholder: 'Argument',
    urlPlaceholder: 'http://localhost:3000/sse',
    keyPlaceholder: 'Key',
    byJson: 'By Json',
    valuePlaceholder: 'Value'
  },
  action: {
    restart: 'Restart',
    stop: 'Stop',
    start: 'Start',
    cancel: 'Cancel',
    create: 'Create Server',
    delete: 'Delete',
    save: 'Save',
    view: 'View',
    restarted: 'Server restarted',
    stopped: 'Server stopped',
    started: 'Server started',
    saved: 'Configuration saved',
    configSaved: 'Configuration saved',
    serverDeleted: 'Server deleted',
    logsCleared: 'Logs cleared',
    logsCopied: 'Logs copied to clipboard'
  },
  error: {
    stdioCommandRequired: 'STDIO server requires a valid command',
    sseUrlRequired: 'SSE server requires a valid URL',
    httpUrlRequired: 'Streamable HTTP server requires a valid URL',
    unsupportedTransportType: 'Unsupported transport type',
    connectionFailed: 'Failed to connect to server',
    invalidServerConfig: 'Invalid server configuration'
  },
  tools: {
    title: 'MCP Tool Gateway',
    searchPlaceholder: "Search all tools (e.g., 'file', 'database', 'list')...",
    systemTools: 'Gateway System Tools',
    aggregatedTools: 'Aggregated Server Tools',
    noToolsFound: 'No tools found. Connect some servers to get started.',
    call: 'Call',
    detailsCall: 'Details / Call',
    noDescription: 'No description provided',
    systemTag: 'System',
    online: 'Online',
    offline: 'Offline',
    systemToolsList: {
      listServers: {
        name: 'list_mcp_servers',
        description: 'List all backend MCP servers currently connected to this gateway.'
      },
      searchTools: {
        name: 'search_aggregated_tools',
        description: 'Search for tools across all connected servers based on a query string.'
      },
      callTool: {
        name: 'call_tool_generic',
        description: 'Invokes a specific tool on a target server with provided arguments.'
      }
    }
  }
}
