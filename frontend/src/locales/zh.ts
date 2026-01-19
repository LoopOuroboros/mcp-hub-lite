export default {
  sidebar: {
    title: 'MCP 服务器管理器',
    dashboard: '仪表盘',
    servers: 'MCP 服务器',
    addServer: '添加新服务器'
  },
  dashboard: {
    title: '仪表盘',
    totalServers: '服务器总数',
    running: '运行中',
    errors: '错误',
    recentActivity: '近期活动'
  },
  serverDetail: {
    emptySelect: '请选择一个服务器以查看详情',
    noServerSelected: '未选择服务器',
    deleteConfirm: '确定要删除此服务器吗？',
    tabs: {
      config: '配置',
      logs: '日志',
      tools: '工具',
      resources: '资源'
    },
    config: {
      transport: '传输方式',
      transportStdio: '标准输入/输出 (stdio)',
      transportSse: '服务器发送事件 (sse)',
      transportHttp: '可流式传输的http (streamableHttp)',
      executable: '可执行文件',
      args: '参数',
      url: '服务地址',
      env: '环境变量',
      timeout: '超时时间 (秒)',
      addArg: '添加参数',
      addEnv: '添加环境变量',
      save: '保存配置',
      editByJson: '通过 JSON 编辑'
    },
    logs: {
      autoScroll: '自动滚动',
      clear: '清空',
      copy: '复制',
      copied: '日志已复制到剪贴板'
    },
    tools: {
      available: '可用工具',
      details: '工具详情',
      schema: '参数 Schema (JSON)',
      selectHint: '请选择一个工具以查看详情',
      none: '暂无可用工具'
    },
    resources: {
      name: '名称',
      uri: 'URI',
      mimeType: 'MIME 类型',
      none: '暂无可用资源'
    },
    status: {
      running: '运行中',
      stopped: '已停止',
      error: '错误'
    }
  },
  addServer: {
    title: '添加新 MCP 服务器',
    transportType: '选择传输类型',
    name: '服务器名称',
    namePlaceholder: '我的新服务器',
    executablePlaceholder: '/path/to/executable 或 npx',
    argPlaceholder: '参数',
    urlPlaceholder: 'http://localhost:3000/sse',
    keyPlaceholder: '键',
    byJson: '通过 JSON 添加',
    valuePlaceholder: '值'
  },
  action: {
    restart: '重启',
    stop: '停止',
    start: '启动',
    cancel: '取消',
    create: '创建服务器',
    delete: '删除',
    save: '保存',
    view: '查看',
    restarted: '服务器已重启',
    stopped: '服务器已停止',
    started: '服务器已启动',
    saved: '配置已保存',
    configSaved: '配置已保存',
    serverDeleted: '服务器已删除',
    logsCleared: '日志已清空',
    logsCopied: '日志已复制到剪贴板'
  },
  error: {
    stdioCommandRequired: 'STDIO 服务器需要有效的命令',
    sseUrlRequired: 'SSE 服务器需要有效的 URL',
    httpUrlRequired: '可流式传输的 HTTP 服务器需要有效的 URL',
    unsupportedTransportType: '不支持的传输类型',
    connectionFailed: '连接服务器失败',
    invalidServerConfig: '服务器配置无效'
  }
}
