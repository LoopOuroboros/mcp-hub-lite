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
    tabs: {
      config: '配置',
      logs: '日志',
      tools: '工具与资源'
    },
    config: {
      transport: '传输方式',
      transportStdio: 'stdio (本地进程)',
      transportSse: 'sse (远程服务器)',
      executable: '可执行文件',
      args: '参数',
      url: 'URL',
      env: '环境变量',
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
      construction: '工具与资源视图正在开发中。'
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
    save: '保存',
    restarted: '服务器已重启',
    stopped: '服务器已停止',
    started: '服务器已启动',
    saved: '配置已保存'
  }
}
