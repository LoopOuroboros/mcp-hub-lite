<template>
  <div v-if="server" class="server-detail h-full flex flex-col p-6 overflow-hidden transition-colors duration-300">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 shrink-0">
      <div class="flex flex-col items-start gap-2">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ server.name }}</h2>
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Status -->
          <div class="flex items-center gap-2 px-3 py-1 rounded-full text-sm transition-colors border border-transparent"
               :class="getStatusBadgeClass(server.status)">
            <div class="w-2 h-2 rounded-full" :class="getStatusDotClass(server.status)"></div>
            {{ $t(`serverDetail.status.${server.status}`) }}
          </div>

          <!-- Transport -->
          <div class="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            <span class="opacity-75">{{ $t('serverDetail.config.transport') }}:</span>
            <span class="font-medium">{{ server.config.type }}</span>
          </div>

          <!-- Version -->
          <div v-if="server.version" class="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            <span class="opacity-75">{{ $t('serverDetail.version') }}:</span>
            <span class="font-medium">{{ server.version }}</span>
          </div>

          <!-- PID (Only for stdio) -->
          <div v-if="server.config.type === 'stdio'" class="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            <span class="opacity-75">PID:</span>
            <span class="font-mono">{{ server.pid || 'N/A' }}</span>
          </div>

          <!-- Uptime -->
          <div class="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            <span class="opacity-75">Uptime:</span>
            <span class="font-mono">{{ formattedUptime }}</span>
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <el-button :icon="Refresh" plain @click="restartServer">{{ $t('action.restart') }}</el-button>
        <el-button v-if="server.status === 'running'" type="warning" plain :icon="SwitchButton" @click="stopServer">{{ $t('action.stop') }}</el-button>
        <el-button v-else type="success" :icon="VideoPlay" @click="startServer">{{ $t('action.start') }}</el-button>
        <el-button type="danger" :icon="Delete" @click="deleteServer">{{ $t('action.delete') }}</el-button>
      </div>
    </div>

    <!-- Tabs -->
    <el-tabs v-model="activeTab" class="flex-1 flex flex-col overflow-hidden custom-tabs">
      <!-- Config Tab -->
      <el-tab-pane :label="$t('serverDetail.tabs.config')" name="config" class="h-full overflow-y-auto">
        <div class="max-w-3xl">
          <el-form label-position="top" class="mt-4">
            <el-form-item :label="$t('serverDetail.config.transport')">
              <el-select v-model="server.config.type" class="w-full">
                <el-option :label="$t('serverDetail.config.transportStdio')" value="stdio" />
                <el-option :label="$t('serverDetail.config.transportSse')" value="sse" />
                <el-option :label="$t('serverDetail.config.transportHttp')" value="streamable-http" />
              </el-select>
            </el-form-item>
            
            <template v-if="server.config.type === 'stdio'">
              <el-form-item :label="$t('serverDetail.config.executable')">
                <el-input v-model="server.config.command" />
              </el-form-item>
              <el-form-item :label="$t('serverDetail.config.args')">
                <div class="w-full flex flex-col gap-2">
                  <div v-for="(arg, index) in server.config.args" :key="index" class="flex gap-2 w-full">
                    <el-input v-model="server.config.args![index]" />
                    <el-button :icon="Delete" circle plain @click="removeArg(index)" />
                  </div>
                  <div>
                    <el-button :icon="Plus" plain size="small" @click="addArg">+ {{ $t('serverDetail.config.addArg') }}</el-button>
                  </div>
                </div>
              </el-form-item>
            </template>
            
            <template v-else>
              <el-form-item :label="$t('serverDetail.config.url')">
                <el-input v-model="server.config.url" />
              </el-form-item>
            </template>

            <el-form-item :label="$t('serverDetail.config.timeout')">
              <el-input-number v-model="timeoutInSeconds" :min="0" :step="1" />
            </el-form-item>

            <el-form-item :label="$t('serverDetail.config.autoStart')">
               <el-switch v-model="server.config.enabled" />
            </el-form-item>

            <el-form-item :label="$t('serverDetail.config.env')">
               <div class="w-full flex flex-col gap-2">
                 <div v-for="(value, key) in server.config.env" :key="key" class="flex gap-2 w-full">
                    <el-input v-model="envKeys[key as string]" :placeholder="$t('addServer.keyPlaceholder')" class="w-1/3" @change="(val: string) => updateEnvKey(key as string, val)" />
                    <el-input v-model="server.config.env![key]" :placeholder="$t('addServer.valuePlaceholder')" class="flex-1" />
                    <el-button :icon="Delete" circle plain @click="removeEnv(key as string)" />
                 </div>
                 <div>
                    <el-button :icon="Plus" plain size="small" @click="addEnv">+ {{ $t('serverDetail.config.addEnv') }}</el-button>
                 </div>
               </div>
            </el-form-item>

            <div class="flex gap-2">
               <el-button type="primary" class="mt-4" @click="saveConfig">{{ $t('serverDetail.config.save') }}</el-button>
               <el-button class="mt-4" :icon="Edit" @click="openEditJson">{{ $t('serverDetail.config.editByJson') }}</el-button>
            </div>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- Logs Tab -->
      <el-tab-pane :label="$t('serverDetail.tabs.logs')" name="logs" class="h-full flex flex-col">
        <div class="flex justify-end gap-2 mb-2">
            <el-checkbox v-model="autoScroll" :label="$t('serverDetail.logs.autoScroll')" class="text-gray-600 dark:text-gray-400" />
            <el-button size="small" :icon="Delete" plain @click="clearLogs">{{ $t('serverDetail.logs.clear') }}</el-button>
            <el-button size="small" :icon="CopyDocument" plain @click="copyLogs">{{ $t('serverDetail.logs.copy') }}</el-button>
        </div>
        <div class="bg-gray-900 dark:bg-black p-4 rounded-lg font-mono text-sm h-full overflow-y-auto text-gray-300" ref="logsContainer">
          <div v-for="(log, index) in server.logs" :key="index" class="mb-1 break-words">
            <span :class="getLogLevelColor(log.level)">
              {{ formatTimestamp(log.timestamp) }} [{{ log.level.toUpperCase() }}] {{ log.message }}
            </span>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tools Tab -->
      <el-tab-pane :label="`${$t('serverDetail.tabs.tools')} (${server.toolsCount || 0})`" name="tools" class="h-full flex flex-col">
         <div class="flex h-full gap-4">
            <!-- Available Tools List -->
            <div class="w-1/3 border-r border-gray-200 dark:border-gray-700 pr-4 overflow-y-auto">
               <h3 class="font-bold mb-4">{{ $t('serverDetail.tools.available') }}</h3>
               <div v-if="server.tools && server.tools.length > 0" class="space-y-2">
                  <div 
                    v-for="tool in server.tools" 
                    :key="tool.name"
                    class="p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
                    :class="selectedTool?.name === tool.name ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'"
                    @click="selectTool(tool)"
                  >
                     <div class="min-w-0 flex-1 mr-2">
                        <div class="font-medium truncate">{{ tool.name }}</div>
                     </div>
                     <el-switch
                       :model-value="isToolAllowed(tool.name)"
                       @update:model-value="(val: boolean) => updateToolVisibility(tool.name, val)"
                       class="mr-4"
                       :active-text="$t('serverDetail.tools.aggregated')"
                     />
                  </div>
               </div>
               <div v-else class="text-gray-500 text-sm italic">
                  {{ $t('serverDetail.tools.none') }}
               </div>
            </div>
            
            <!-- Tool Details -->
            <div class="flex-1 overflow-y-auto pl-2">
               <div class="flex justify-between items-center mb-4">
                  <h3 class="font-bold">{{ $t('serverDetail.tools.details') }}: {{ selectedTool?.name || '' }}</h3>
                  <el-button v-if="selectedTool" type="primary" size="small" @click="showCallDialog = true">
                    {{ $t('serverDetail.tools.call') }}
                  </el-button>
               </div>
               <div v-if="selectedTool">
                  <p class="mb-4 text-gray-600 dark:text-gray-300">{{ selectedTool.description }}</p>
                  
                  <h4 class="font-medium mb-2">{{ $t('serverDetail.tools.schema') }}</h4>
                  <pre class="bg-gray-50 dark:bg-[#0f172a] p-4 rounded-lg overflow-x-auto text-sm font-mono border border-gray-200 dark:border-gray-700">{{ JSON.stringify(selectedTool.inputSchema, null, 2) }}</pre>
               </div>
               <div v-else class="flex h-full items-center justify-center text-gray-400">
                  {{ $t('serverDetail.tools.selectHint') }}
               </div>
            </div>
         </div>
      </el-tab-pane>

      <!-- Resources Tab -->
      <el-tab-pane :label="`${$t('serverDetail.tabs.resources')} (${server.resourcesCount || 0})`" name="resources" class="h-full flex flex-col">
         <div class="h-full overflow-y-auto">
             <el-table :data="server.resources || []" style="width: 100%" class="custom-table">
                <el-table-column prop="name" :label="$t('serverDetail.resources.name')" width="200">
                   <template #default="{ row }">
                      <div class="flex items-center gap-2">
                         <el-icon><Document /></el-icon>
                         <span class="font-medium">{{ row.name }}</span>
                      </div>
                   </template>
                </el-table-column>
                <el-table-column prop="uri" :label="$t('serverDetail.resources.uri')" min-width="300" />
                <el-table-column prop="mimeType" :label="$t('serverDetail.resources.mimeType')" width="150" />
                <el-table-column label="" width="100" align="right">
                   <template #default>
                      <el-button size="small" plain>{{ $t('action.view') }}</el-button>
                   </template>
                </el-table-column>
             </el-table>
             <div v-if="!server.resources || server.resources.length === 0" class="text-center py-8 text-gray-500">
                {{ $t('serverDetail.resources.none') }}
             </div>
         </div>
      </el-tab-pane>
    </el-tabs>

    <!-- JSON Config Dialog -->
    <el-dialog
      v-model="showEditJson"
      title="Edit JSON Config"
      width="600px"
    >
      <el-input
        v-model="jsonConfig"
        type="textarea"
        :rows="15"
        font-family="monospace"
      />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showEditJson = false">{{ $t('action.cancel') }}</el-button>
          <el-button type="primary" @click="saveJsonConfig">{{ $t('action.save') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Tool Call Dialog -->
    <ToolCallDialog
      v-if="selectedTool"
      v-model="showCallDialog"
      :server-id="server.id"
      :tool-name="selectedTool.name"
      :description="selectedTool.description"
      :input-schema="selectedTool.inputSchema"
    />
  </div>
  <div v-else class="h-full flex items-center justify-center text-gray-400">
    {{ $t('serverDetail.noServerSelected') }}
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useServerStore } from '../stores/server'
import { useWebSocketStore } from '../stores/websocket'
import ToolCallDialog from './ToolCallDialog.vue'
import { VideoPlay, SwitchButton, Refresh, Delete, Plus, Edit, CopyDocument, Document } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'

const store = useServerStore()
const wsStore = useWebSocketStore()
const { t } = useI18n()

// Computed property for the selected server
const server = computed(() => store.selectedServer)

// State
const activeTab = ref('config')
const autoScroll = ref(true)
const logsContainer = ref<HTMLElement | null>(null)
const envKeys = ref<Record<string, string>>({})
const showEditJson = ref(false)
const jsonConfig = ref('')
const selectedTool = ref<any>(null)
const showCallDialog = ref(false)

// Computed property for timeout in seconds
const timeoutInSeconds = computed({
  get: () => {
    if (server.value?.config.timeout) {
      return server.value.config.timeout / 1000
    }
    return 60 // Default 60s
  },
  set: (val: number) => {
    if (server.value) {
      server.value.config.timeout = val * 1000
    }
  }
})

// Initialize env keys when server changes
watch(server, (newServer) => {
  if (newServer?.config.env) {
    envKeys.value = {}
    Object.keys(newServer.config.env).forEach(k => {
      envKeys.value[k] = k
    })
  }
}, { immediate: true })

// Auto-switch tabs based on status when server changes
watch(() => server.value?.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    activeTab.value = server.value?.status === 'running' ? 'logs' : 'config'
    selectedTool.value = null
  }
}, { immediate: true })

// Auto-scroll logs
watch(() => server.value?.logs.length, () => {
  if (autoScroll.value) {
    nextTick(() => {
      if (logsContainer.value) {
        logsContainer.value.scrollTop = logsContainer.value.scrollHeight
      }
    })
  }
})

// Tab switching logic
watch(activeTab, async (tab) => {
  if (!server.value?.id) return

  if (tab === 'tools') {
    await store.fetchTools(server.value.id)
  } else if (tab === 'resources') {
    await store.fetchResources(server.value.id)
  } else if (tab === 'logs') {
    store.fetchLogs(server.value.id) // 不再是异步方法
  }
}, { immediate: true })

function selectTool(tool: any) {
  selectedTool.value = tool
}

function openCallDialog(tool: any) {
  selectedTool.value = tool
  showCallDialog.value = true
}

function isToolAllowed(toolName: string) {
  if (!server.value?.config) return false
  const allowed = server.value.config.allowedTools
  if (allowed === undefined || allowed === null || allowed.length === 0) return false
  if (Array.isArray(allowed)) {
    return allowed.includes(toolName)
  }
  return false
}

// Helper functions for status styling
function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'running': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'stopped': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    case 'error': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'starting': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }
}

function getStatusDotClass(status: string) {
  switch (status) {
    case 'running': return 'bg-green-500'
    case 'stopped': return 'bg-gray-500'
    case 'error': return 'bg-red-500'
    case 'starting': return 'bg-yellow-500'
    default: return 'bg-gray-500'
  }
}

// Helper functions for log styling
function getLogLevelColor(level: string) {
  switch (level) {
    case 'debug': return 'text-gray-400'
    case 'info': return 'text-blue-400'
    case 'warn': return 'text-yellow-400'
    case 'error': return 'text-red-400'
    default: return 'text-gray-300'
  }
}

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`
}

// Uptime Logic
const formattedUptime = ref('00:00:00')
let uptimeInterval: ReturnType<typeof setInterval> | null = null

const updateUptime = () => {
  if (server.value?.startTime && server.value.status === 'running') {
    const diff = Math.floor((Date.now() - server.value.startTime) / 1000)
    if (diff < 0) {
       formattedUptime.value = '00:00:00'
       return
    }
    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)
    const seconds = diff % 60
    formattedUptime.value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  } else {
    formattedUptime.value = '00:00:00'
  }
}

onMounted(() => {
  uptimeInterval = setInterval(updateUptime, 1000)
  updateUptime()
})

onUnmounted(() => {
  if (uptimeInterval) clearInterval(uptimeInterval)
})

watch(() => server.value?.startTime, () => {
  updateUptime()
})

// Actions
const restartServer = async () => {
  if (server.value) {
    try {
      if (server.value.status === 'running') {
        await store.stopServer(server.value.id)
      }
      await store.startServer(server.value.id)
      ElMessage.success(t('action.restarted'))
    } catch (e: any) {
      ElMessage.error(e.message)
    }
  }
}

const stopServer = async () => {
  if (server.value) {
    try {
      await store.stopServer(server.value.id)
      ElMessage.success(t('action.stopped'))
    } catch (e: any) {
      ElMessage.error(e.message)
    }
  }
}

const startServer = async () => {
  if (server.value) {
    try {
      await store.startServer(server.value.id)
      ElMessage.success(t('action.started'))
    } catch (e: any) {
      ElMessage.error(e.message)
    }
  }
}

const deleteServer = async () => {
  if (server.value) {
    try {
      await ElMessageBox.confirm(
        t('serverDetail.deleteConfirm'),
        t('action.delete'),
        {
          confirmButtonText: t('action.delete'),
          cancelButtonText: t('action.cancel'),
          type: 'warning'
        }
      )
      
      await store.deleteServer(server.value.id)
      ElMessage.success(t('action.serverDeleted'))
      store.selectedServerId = null
    } catch (e: any) {
      if (e !== 'cancel') {
        ElMessage.error(e.message || 'Failed to delete server')
      }
    }
  }
}

const updateToolVisibility = async (toolName: string, enabled: boolean) => {
  if (!server.value) return

  let currentAllowed = server.value.config.allowedTools

  // If allowedTools is undefined, it means "All Allowed".
  // When modifying, we must convert this implicit "All" to an explicit list of all tools
  // so that removing one tool works as expected (all others remain allowed).
  if (currentAllowed === undefined || currentAllowed === null) {
    if (server.value.tools) {
      currentAllowed = server.value.tools.map((t: any) => t.name)
    } else {
      currentAllowed = []
    }
  }

  if (enabled) {
    if (!currentAllowed.includes(toolName)) {
      currentAllowed = [...currentAllowed, toolName]
    }
  } else {
    currentAllowed = currentAllowed.filter((t: string) => t !== toolName)
  }

  // Optimistic update
  server.value.config.allowedTools = currentAllowed

  try {
    await store.updateServer(server.value.id, {
      config: server.value.config
    })
    ElMessage.success(t('action.configSaved'))
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

const saveConfig = async () => {
  if (server.value) {
    try {
      await store.updateServer(server.value.id, {
        config: server.value.config
      })
      ElMessage.success(t('action.configSaved'))
    } catch (e: any) {
      ElMessage.error(e.message)
    }
  }
}

const openEditJson = () => {
  if (!server.value) return
  
  const configObj: any = {
    env: server.value.config.env || {},
    enabled: server.value.config.enabled
  }

  if (server.value.config.timeout) {
    configObj.timeout = server.value.config.timeout
  }
  
  if (server.value.config.type === 'stdio') {
    configObj.command = server.value.config.command
    configObj.args = server.value.config.args || []
  } else {
    configObj.url = server.value.config.url
  }

  const fullConfig = {
    mcpServers: {
      [server.value.name]: configObj
    }
  }
  
  jsonConfig.value = JSON.stringify(fullConfig, null, 2)
  showEditJson.value = true
}

const saveJsonConfig = async () => {
  try {
    const parsed = JSON.parse(jsonConfig.value)
    if (!parsed.mcpServers) throw new Error('Missing mcpServers key')
    
    const names = Object.keys(parsed.mcpServers)
    if (names.length === 0) throw new Error('No server config found')
    
    const name = names[0] || ''
    const newConfig = parsed.mcpServers[name]
    
    if (server.value) {
      const updatedConfig = { ...server.value.config }

      if (newConfig.command) {
        updatedConfig.type = 'stdio'
        updatedConfig.command = newConfig.command
        updatedConfig.args = newConfig.args || []
        delete (updatedConfig as any).url
      } else if (newConfig.url) {
        if (newConfig.type === 'streamable-http' || newConfig.type === 'http') {
          updatedConfig.type = 'streamable-http'
        } else {
          updatedConfig.type = 'sse'
        }
        updatedConfig.url = newConfig.url
        delete (updatedConfig as any).command
        delete (updatedConfig as any).args
      }
      
      if (newConfig.env) {
        updatedConfig.env = newConfig.env
      }

      if (newConfig.timeout !== undefined) {
        updatedConfig.timeout = newConfig.timeout
      }

      if (newConfig.enabled !== undefined) {
        updatedConfig.enabled = newConfig.enabled
      }

      await store.updateServer(server.value.id, {
        name: name !== server.value.name ? name : undefined,
        config: updatedConfig
      })

      if (updatedConfig.env) {
        envKeys.value = {}
        Object.keys(updatedConfig.env).forEach(k => {
          envKeys.value[k] = k
        })
      }
      
      showEditJson.value = false
      ElMessage.success(t('action.configSaved'))
    }
  } catch (e: any) {
    ElMessage.error('Invalid JSON: ' + e.message)
  }
}

// Config helpers
const addArg = () => {
  if (!server.value!.config.args) server.value!.config.args = []
  server.value!.config.args.push('')
}

const removeArg = (index: number) => {
  server.value!.config.args?.splice(index, 1)
}

const addEnv = () => {
  if (!server.value!.config.env) server.value!.config.env = {}
  const newKey = `NEW_VAR_${Object.keys(server.value!.config.env).length}`
  server.value!.config.env[newKey] = ''
  envKeys.value[newKey] = newKey
}

const removeEnv = (key: string) => {
  delete server.value!.config.env![key]
  delete envKeys.value[key]
}

const updateEnvKey = (oldKey: string, newKey: string) => {
  if (oldKey === newKey) return
  const val = server.value!.config.env![oldKey] || ''
  delete server.value!.config.env![oldKey]
  server.value!.config.env![newKey] = val
  delete envKeys.value[oldKey]
  envKeys.value[newKey] = newKey
}

const clearLogs = async () => {
  if (server.value) {
    await store.clearLogs(server.value.id)
    ElMessage.success(t('action.logsCleared'))
  }
}

const copyLogs = () => {
  if (server.value) {
    const logText = server.value.logs.map(log =>
      `${formatTimestamp(log.timestamp)} [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n')
    navigator.clipboard.writeText(logText)
    ElMessage.success(t('action.logsCopied'))
  }
}
</script>

<style scoped>
/* Tabs styling adjustments if needed */
.custom-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}
.custom-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  padding-top: 1rem;
}
</style>