<template>
  <div v-if="server" class="server-detail h-full flex flex-col p-6 overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <h2 class="text-2xl font-bold text-white">{{ server.name }}</h2>
        <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-opacity-20 text-sm"
             :class="getStatusBadgeClass(server.status)">
          <div class="w-2 h-2 rounded-full" :class="getStatusDotClass(server.status)"></div>
          {{ $t(`serverDetail.status.${server.status}`) }} | PID: {{ server.pid || 'N/A' }} | Uptime: {{ server.uptime || '00:00:00' }} | {{ $t('serverDetail.config.transport') }}: {{ server.config.transport }}
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
                <div v-for="(arg, index) in server.config.args" :key="index" class="flex gap-2 mb-2">
                  <el-input v-model="server.config.args![index]" />
                  <el-button :icon="Delete" circle plain @click="removeArg(index)" />
                </div>
                <el-button :icon="Plus" plain size="small" @click="addArg">+ {{ $t('serverDetail.config.addArg') }}</el-button>
              </el-form-item>
            </template>
            
            <template v-else>
              <el-form-item :label="$t('serverDetail.config.url')">
                <el-input v-model="server.config.url" />
              </el-form-item>
            </template>

            <el-form-item :label="$t('serverDetail.config.env')">
               <div v-for="(value, key) in server.config.env" :key="key" class="flex gap-2 mb-2">
                  <el-input v-model="envKeys[key as string]" :placeholder="$t('addServer.keyPlaceholder')" class="w-1/3" @change="(val: string) => updateEnvKey(key as string, val)" />
                  <el-input v-model="server.config.env![key]" :placeholder="$t('addServer.valuePlaceholder')" class="flex-1" />
                  <el-button :icon="Delete" circle plain @click="removeEnv(key as string)" />
               </div>
               <el-button :icon="Plus" plain size="small" @click="addEnv">+ {{ $t('serverDetail.config.addEnv') }}</el-button>
            </el-form-item>

            <el-button type="primary" class="mt-4" @click="saveConfig">{{ $t('serverDetail.config.save') }}</el-button>
          </el-form>
        </div>
      </el-tab-pane>
      
      <el-tab-pane :label="$t('serverDetail.tabs.logs')" name="logs" class="h-full flex flex-col">
        <div class="flex justify-end gap-2 mb-2">
            <el-checkbox v-model="autoScroll" :label="$t('serverDetail.logs.autoScroll')" />
            <el-button size="small" :icon="Delete" plain @click="clearLogs">{{ $t('serverDetail.logs.clear') }}</el-button>
            <el-button size="small" :icon="CopyDocument" plain @click="copyLogs">{{ $t('serverDetail.logs.copy') }}</el-button>
        </div>
        <div class="bg-black p-4 rounded-lg font-mono text-sm h-full overflow-y-auto text-gray-300" ref="logsContainer">
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
  <div v-else class="h-full flex items-center justify-center text-gray-500">
    {{ $t('serverDetail.emptySelect') }}
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useServerStore } from '../stores/server'
import { Refresh, SwitchButton, VideoPlay, Delete, Plus, CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const store = useServerStore()
const { t } = useI18n()
const server = computed(() => store.selectedServer)
const activeTab = ref('logs')
const autoScroll = ref(true)
const logsContainer = ref<HTMLElement | null>(null)

// Helper to manage Env Keys editing (since object keys are immutable)
const envKeys = ref<Record<string, string>>({})

watch(server, (newServer) => {
  if (newServer && newServer.config.env) {
    envKeys.value = Object.keys(newServer.config.env).reduce((acc, key) => {
      acc[key] = key
      return acc
    }, {} as Record<string, string>)
  }
}, { immediate: true })

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'running': return 'bg-green-500 text-green-400'
    case 'stopped': return 'bg-gray-500 text-gray-400'
    case 'error': return 'bg-red-500 text-red-400'
    default: return 'bg-gray-500 text-gray-400'
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

function restartServer() {
  if (server.value) {
    store.updateServerStatus(server.value.id, 'stopped')
    setTimeout(() => {
      store.updateServerStatus(server.value!.id, 'running')
      ElMessage.success(t('action.restarted'))
    }, 1000)
  }
}

function stopServer() {
  if (server.value) {
    store.updateServerStatus(server.value.id, 'stopped')
    ElMessage.success(t('action.stopped'))
  }
}

function startServer() {
  if (server.value) {
    store.updateServerStatus(server.value.id, 'running')
    ElMessage.success(t('action.started'))
  }
}

function addArg() {
  if (server.value) {
    if (!server.value.config.args) server.value.config.args = []
    server.value.config.args.push('')
  }
}

function removeArg(index: number) {
  if (server.value && server.value.config.args) {
    server.value.config.args.splice(index, 1)
  }
}

function addEnv() {
  if (server.value) {
    if (!server.value.config.env) server.value.config.env = {}
    const newKey = `NEW_VAR_${Object.keys(server.value.config.env).length + 1}`
    server.value.config.env[newKey] = ''
    envKeys.value[newKey] = newKey
  }
}

function removeEnv(key: string) {
  if (server.value && server.value.config.env) {
    delete server.value.config.env[key]
    delete envKeys.value[key]
  }
}

function updateEnvKey(oldKey: string, newKey: string) {
  if (server.value && server.value.config.env) {
    const value = server.value.config.env[oldKey] || ''
    delete server.value.config.env[oldKey]
    server.value.config.env[newKey] = value
    delete envKeys.value[oldKey]
    envKeys.value[newKey] = newKey
  }
}

function saveConfig() {
  ElMessage.success(t('action.saved'))
}

function clearLogs() {
  if (server.value) {
    server.value.logs = []
  }
}

function copyLogs() {
  if (server.value) {
    navigator.clipboard.writeText(server.value.logs.join('\n'))
    ElMessage.success(t('serverDetail.logs.copied'))
  }
}
</script>

<style>
.custom-tabs .el-tabs__item {
  color: #94a3b8;
}
.custom-tabs .el-tabs__item.is-active {
  color: #3b82f6;
}
.custom-tabs .el-tabs__nav-wrap::after {
  background-color: #334155;
}
</style>
