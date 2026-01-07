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
    tabs: {
      config: 'Configuration',
      logs: 'Logs',
      tools: 'Tools & Resources'
    },
    config: {
      transport: 'Transport',
      transportStdio: 'stdio (Local Process)',
      transportSse: 'sse (Remote Server)',
      executable: 'Executable',
      args: 'Arguments',
      url: 'URL',
      env: 'Environment Variables',
      addArg: 'Add Argument',
      addEnv: 'Add Environment Variable',
      save: 'Save Configuration'
    },
    logs: {
      autoScroll: 'Auto-scroll',
      clear: 'Clear',
      copy: 'Copy',
      copied: 'Logs copied to clipboard'
    },
    tools: {
      construction: 'Tools and Resources view is under construction.'
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
    valuePlaceholder: 'Value'
  },
  action: {
    restart: 'Restart',
    stop: 'Stop',
    start: 'Start',
    cancel: 'Cancel',
    create: 'Create Server',
    save: 'Save',
    restarted: 'Server restarted',
    stopped: 'Server stopped',
    started: 'Server started',
    saved: 'Configuration saved'
  }
}
