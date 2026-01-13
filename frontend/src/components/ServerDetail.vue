<template>
  <div v-if="server" class="server-detail h-full flex flex-col p-6 overflow-hidden transition-colors duration-300">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 shrink-0">
      <div class="flex items-center gap-4">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ server.name }}</h2>
        <div class="flex items-center gap-2 px-3 py-1 rounded-full text-sm transition-colors"
             :class="getStatusBadgeClass(server.status)">
          <div class="w-2 h-2 rounded-full" :class="getStatusDotClass(server.status)"></div>
          {{ $t(`serverDetail.status.${server.status}`) }}
          <span class="opacity-75">| PID: {{ server.pid || 'N/A' }}</span>
          <span class="opacity-75">| Uptime: {{ server.uptime || '00:00:00' }}</span>
          <span class="opacity-75">| {{ $t('serverDetail.config.transport') }}: {{ server.config.transport }}</span>
        </div>
      </div>
      <div class="flex gap-2">
        <el-button :icon="Refresh" plain @click="restartServer">{{ $t('action.restart') }}</el-button>
        <el-button v-if="server.status === 'running'" type="danger" :icon="SwitchButton" @click="stopServer">{{ $t('action.stop') }}</el-button>
        <el-button v-else type="success" :icon="VideoPlay" @click="startServer">{{ $t('action.start') }}</el-button>
      </div>
    </div>

    <!-- Tabs -->
    <el-tabs v-model="activeTab" class="flex-1 flex flex-col overflow-hidden custom-tabs">
      <el-tab-pane :label="$t('serverDetail.tabs.config')" name="config" class="h-full overflow-y-auto">
        <div class="max-w-3xl">
          <el-form label-position="top" class="mt-4">
            <el-form-item :label="$t('serverDetail.config.transport')">
              <el-select v-model="server.config.transport" class="w-full">
                <el-option :label="$t('serverDetail.config.transportStdio')" value="stdio" />
                <el-option :label="$t('serverDetail.config.transportSse')" value="sse" />
              </el-select>
            </el-form-item>
            
            <template v-if="server.config.transport === 'stdio'">
              <el-form-item :label="$t('serverDetail.config.executable')">
                <el-input v-model="server.config.command" />
              </el-form-item>
              <el-form-item :label="$t('serverDetail.config.args')">
                <div class="w-full flex flex-col gap-2" style="display: flex; flex-direction: column; width: 100%;">
                  <div v-for="(arg, index) in server.config.args" :key="index" class="flex gap-2 w-full" style="display: flex; gap: 0.5rem; width: 100%;">
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

            <el-form-item :label="$t('serverDetail.config.env')">
               <div class="w-full flex flex-col gap-2" style="display: flex; flex-direction: column; width: 100%;">
                 <div v-for="(value, key) in server.config.env" :key="key" class="flex gap-2 w-full" style="display: flex; gap: 0.5rem; width: 100%;">
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

    <el-dialog
      v-model="showEditJson"
      title="Edit JSON Config"
      width="600px"
      append-to-body
      class="custom-dialog"
    >
      <el-input
        v-model="jsonConfig"
        type="textarea"
        :rows="15"
        placeholder='{ "mcpServers": { "name": { "command": "...", ... } } }'
      />
      <template #footer>
        <el-button @click="showEditJson = false">Cancel</el-button>
        <el-button type="primary" @click="saveJsonConfig">Update</el-button>
      </template>
    </el-dialog>
      
      <el-tab-pane :label="$t('serverDetail.tabs.logs')" name="logs" class="h-full flex flex-col">
        <div class="flex justify-end gap-2 mb-2">
            <el-checkbox v-model="autoScroll" :label="$t('serverDetail.logs.autoScroll')" class="text-gray-600 dark:text-gray-400" />
            <el-button size="small" :icon="Delete" plain @click="clearLogs">{{ $t('serverDetail.logs.clear') }}</el-button>
            <el-button size="small" :icon="CopyDocument" plain @click="copyLogs">{{ $t('serverDetail.logs.copy') }}</el-button>
        </div>
        <div class="bg-gray-900 dark:bg-black p-4 rounded-lg font-mono text-sm h-full overflow-y-auto text-gray-300" ref="logsContainer">
          <div v-for="(log, index) in server.logs" :key="index" class="mb-1 break-words">
            <span v-if="log.includes('[SYSTEM')" class="text-blue-400">{{ log }}</span>
            <span v-else-if="log.includes('[STDERR') || log.includes('Error')" class="text-red-400">{{ log }}</span>
            <span v-else-if="log.includes('[MCP REQUEST]')" class="text-green-400">{{ log }}</span>
            <span v-else-if="log.includes('[MCP RESPONSE]')" class="text-purple-400">{{ log }}</span>
            <span v-else>{{ log }}</span>
          </div>
        </div>
      </el-tab-pane>
      
      <el-tab-pane :label="$t('serverDetail.tabs.tools')" name="tools">
        <div class="p-4 text-center text-gray-500">
          {{ $t('serverDetail.tools.construction') }}
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
  <div v-else class="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
    {{ $t('serverDetail.emptySelect') }}
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useServerStore } from '../stores/server'
import { Refresh, SwitchButton, VideoPlay, Delete, Plus, CopyDocument, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  // No props needed as we use store, but good practice
}>()

const store = useServerStore()
const { t } = useI18n()
const activeTab = ref('logs')
const autoScroll = ref(true)
const logsContainer = ref<HTMLElement | null>(null)

// JSON Edit state
const showEditJson = ref(false)
const jsonConfig = ref('')

// Local state for env key editing
const envKeys = ref<Record<string, string>>({})

const server = computed(() => {
  const s = store.servers.find(s => s.id === store.selectedServerId)
  if (s && s.config.env) {
    // Initialize envKeys
    Object.keys(s.config.env).forEach(k => {
      if (!envKeys.value[k]) envKeys.value[k] = k
    })
  }
  return s
})

// Auto scroll logs
watch(() => server.value?.logs.length, () => {
  if (autoScroll.value) {
    nextTick(() => {
      if (logsContainer.value) {
        logsContainer.value.scrollTop = logsContainer.value.scrollHeight
      }
    })
  }
})

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'running': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'stopped': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    case 'error': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }
}

function getStatusDotClass(status: string) {
  switch (status) {
    case 'running': return 'bg-green-500'
    case 'stopped': return 'bg-gray-500'
    case 'error': return 'bg-red-500'
    default: return 'bg-gray-500'
  }
}

// ... Actions ...
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
    env: server.value.config.env || {}
  }
  
  if (server.value.config.transport === 'stdio') {
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
        updatedConfig.transport = 'stdio'
        updatedConfig.command = newConfig.command
        updatedConfig.args = newConfig.args || []
        delete (updatedConfig as any).url
      } else if (newConfig.url) {
        updatedConfig.transport = 'sse'
        updatedConfig.url = newConfig.url
        delete (updatedConfig as any).command
        delete (updatedConfig as any).args
      }
      
      if (newConfig.env) {
        updatedConfig.env = newConfig.env
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

const clearLogs = () => {
  if (server.value) {
    server.value.logs = []
    ElMessage.success(t('action.logsCleared'))
  }
}

const copyLogs = () => {
  if (server.value) {
    navigator.clipboard.writeText(server.value.logs.join('\n'))
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
