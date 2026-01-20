<template>
  <el-dialog
    v-model="dialogVisible"
    :title="$t('addServer.title')"
    width="600px"
    class="custom-dialog"
    :before-close="handleClose"
    append-to-body
    align-center
  >
    <el-form :model="form" label-position="top">
      <el-form-item :label="$t('addServer.transportType')">
        <div class="flex gap-4 w-full">
          <div
            class="flex-1 p-4 border rounded-lg cursor-pointer text-center transition-all"
            :class="form.transport === 'stdio' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-600 hover:border-gray-500'"
            @click="form.transport = 'stdio'"
          >
            <div class="font-bold mb-1">stdio</div>
            <div class="text-xs text-gray-400">({{ $t('serverDetail.config.transportStdio') }})</div>
          </div>
          <div
            class="flex-1 p-4 border rounded-lg cursor-pointer text-center transition-all"
            :class="form.transport === 'sse' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-600 hover:border-gray-500'"
            @click="form.transport = 'sse'"
          >
            <div class="font-bold mb-1">SSE</div>
            <div class="text-xs text-gray-400">({{ $t('serverDetail.config.transportSse') }})</div>
          </div>
          <div
            class="flex-1 p-4 border rounded-lg cursor-pointer text-center transition-all"
            :class="form.transport === 'streamable-http' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-600 hover:border-gray-500'"
            @click="form.transport = 'streamable-http'"
          >
            <div class="font-bold mb-1">Streamable HTTP</div>
            <div class="text-xs text-gray-400">({{ $t('serverDetail.config.transportHttp') }})</div>
          </div>
        </div>
      </el-form-item>

      <el-form-item :label="$t('addServer.name')">
        <el-input v-model="form.name" :placeholder="$t('addServer.namePlaceholder')" />
      </el-form-item>

      <template v-if="form.transport === 'stdio'">
        <el-form-item :label="$t('serverDetail.config.executable')">
          <el-input v-model="form.command" :placeholder="$t('addServer.executablePlaceholder')" />
        </el-form-item>
        <el-form-item :label="$t('serverDetail.config.args')">
          <div class="w-full flex flex-col gap-2" style="display: flex; flex-direction: column; width: 100%;">
            <div v-for="(arg, index) in form.args" :key="index" class="flex gap-2 w-full">
              <el-input v-model="form.args[index]" :placeholder="$t('addServer.argPlaceholder')" />
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
          <el-input v-model="form.url" :placeholder="$t('addServer.urlPlaceholder')" />
        </el-form-item>
      </template>

      <el-form-item :label="$t('serverDetail.config.timeout')">
        <el-input-number v-model="form.timeout" :min="0" :step="10" />
      </el-form-item>
      
      <el-form-item :label="$t('serverDetail.config.autoStart')">
        <el-switch v-model="form.autoStart" />
      </el-form-item>

      <el-form-item :label="$t('serverDetail.config.env')">
          <div class="w-full flex flex-col gap-2" style="display: flex; flex-direction: column; width: 100%;">
            <div v-for="(item, index) in envItems" :key="index" class="flex gap-2 w-full" style="display: flex; gap: 0.5rem; width: 100%;">
              <el-input v-model="item.key" :placeholder="$t('addServer.keyPlaceholder')" class="w-1/3" />
              <el-input v-model="item.value" :placeholder="$t('addServer.valuePlaceholder')" class="flex-1" />
              <el-button :icon="Delete" circle plain @click="removeEnv(index)" />
            </div>
            <div>
              <el-button :icon="Plus" plain size="small" @click="addEnv">+ {{ $t('serverDetail.config.addEnv') }}</el-button>
            </div>
          </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer flex justify-between w-full">
        <el-button @click="showImportJson = true">{{ $t('addServer.byJson') }}</el-button>
        <div>
          <el-button @click="handleClose" :disabled="isSubmitting">{{ $t('action.cancel') }}</el-button>
          <el-button type="primary" @click="createServer" :loading="isSubmitting">{{ $t('action.create') }}</el-button>
        </div>
      </div>
    </template>

    <el-dialog
      v-model="showImportJson"
      title="Import JSON Config"
      width="500px"
      append-to-body
      class="custom-dialog"
    >
      <el-input
        v-model="jsonConfig"
        type="textarea"
        :rows="10"
        placeholder='{ "mcpServers": { "name": { "command": "...", ... } } }'
      />
      <template #footer>
        <el-button @click="showImportJson = false">Cancel</el-button>
        <el-button type="primary" @click="importJson">Import</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { useServerStore } from '../stores/server'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
  initialMode?: 'form' | 'json'
}>()

const emit = defineEmits(['update:modelValue'])

const store = useServerStore()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const showImportJson = ref(false)

watch(dialogVisible, (val) => {
  if (val && props.initialMode === 'json') {
    showImportJson.value = true
  }
})
const defaultJsonConfig = `{\n  "mcpServers": {\n  }\n}`
const jsonConfig = ref(defaultJsonConfig)

const form = ref({
  transport: 'stdio' as 'stdio' | 'sse' | 'streamable-http',
  name: '',
  command: '',
  args: [] as string[],
  url: '',
  timeout: 60,
  autoStart: true
})

const envItems = ref<{key: string, value: string}[]>([])

function importJson() {
  try {
    const parsed = JSON.parse(jsonConfig.value)
    // Support { "mcpServers": { "name": { ... } } } or just { ... }
    let configToUse = parsed
    let nameToUse = ''

    if (parsed.mcpServers) {
      const keys = Object.keys(parsed.mcpServers)
      if (keys.length > 0) {
        nameToUse = keys[0] || ''
        configToUse = parsed.mcpServers[nameToUse]
      }
    }

    if (nameToUse) {
      form.value.name = nameToUse
    }

    if (configToUse.command) {
      form.value.transport = 'stdio'
      form.value.command = configToUse.command
      form.value.args = configToUse.args || []
    } else if (configToUse.url) {
      // Check if it's Streamable HTTP transport based on type or other indicators
      if (configToUse.type === 'streamable-http' || configToUse.type === 'http') {
        form.value.transport = 'streamable-http'
      } else {
        form.value.transport = 'sse'
      }
      form.value.url = configToUse.url
    }

    if (configToUse.timeout) {
      form.value.timeout = configToUse.timeout / 1000
    }
    
    if (configToUse.enabled !== undefined) {
      form.value.autoStart = configToUse.enabled
    }

    if (configToUse.env) {
      envItems.value = Object.entries(configToUse.env).map(([key, value]) => ({
        key,
        value: String(value)
      }))
    }

    showImportJson.value = false
    ElMessage.success('Configuration imported successfully')
  } catch (e: any) {
    ElMessage.error('Invalid JSON configuration: ' + e.message)
  }
}

function addArg() {
  form.value.args.push('')
}

function removeArg(index: number) {
  form.value.args.splice(index, 1)
}

function addEnv() {
  envItems.value.push({ key: '', value: '' })
}

function removeEnv(index: number) {
  envItems.value.splice(index, 1)
}

function handleClose() {
  dialogVisible.value = false
  resetForm()
}

function resetForm() {
  form.value = {
    transport: 'stdio',
    name: '',
    command: '',
    args: [],
    url: '',
    timeout: 60,
    autoStart: true
  }
  envItems.value = []
  jsonConfig.value = defaultJsonConfig
  showImportJson.value = false
}

const isSubmitting = ref(false)

async function createServer() {
  if (isSubmitting.value) return
  isSubmitting.value = true
  
  const env = envItems.value.reduce((acc, item) => {
    if (item.key) acc[item.key] = item.value
    return acc
  }, {} as Record<string, string>)

  try {
    await store.addServer({
      name: form.value.name || 'Unnamed Server',
      status: 'stopped',
      type: form.value.transport === 'stdio' ? 'local' : 'remote',
      config: {
        transport: form.value.transport,
        command: form.value.command,
        args: form.value.args.filter(a => a),
        url: form.value.url,
        timeout: form.value.timeout * 1000,
        enabled: form.value.autoStart,
        allowedTools: [],
        env
      },
      logs: []
    })
    
    ElMessage.success('Server added successfully')
    handleClose()
  } catch (error: any) {
    ElMessage.error(error.message || 'Failed to add server')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style>
/* 适配暗色模式，仅在 dark 下应用深色背景 */
html.dark .custom-dialog {
  --el-dialog-bg-color: #1e293b;
  border: 1px solid #334155;
}

/* 确保标题和关闭按钮颜色正确 */
html.dark .custom-dialog .el-dialog__title {
  color: white;
}
</style>
