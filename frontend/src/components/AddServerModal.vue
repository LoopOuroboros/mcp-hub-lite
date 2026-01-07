<template>
  <el-dialog
    v-model="dialogVisible"
    :title="$t('addServer.title')"
    width="600px"
    class="custom-dialog"
    :before-close="handleClose"
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
          <div v-for="(arg, index) in form.args" :key="index" class="flex gap-2 mb-2">
            <el-input v-model="form.args[index]" :placeholder="$t('addServer.argPlaceholder')" />
            <el-button :icon="Delete" circle plain @click="removeArg(index)" />
          </div>
          <el-button :icon="Plus" plain size="small" @click="addArg">+ {{ $t('serverDetail.config.addArg') }}</el-button>
        </el-form-item>
      </template>

      <template v-else>
        <el-form-item :label="$t('serverDetail.config.url')">
          <el-input v-model="form.url" :placeholder="$t('addServer.urlPlaceholder')" />
        </el-form-item>
      </template>

      <el-form-item :label="$t('serverDetail.config.env')">
          <div v-for="(item, index) in envItems" :key="index" class="flex gap-2 mb-2">
            <el-input v-model="item.key" :placeholder="$t('addServer.keyPlaceholder')" class="w-1/3" />
            <el-input v-model="item.value" :placeholder="$t('addServer.valuePlaceholder')" class="flex-1" />
            <el-button :icon="Delete" circle plain @click="removeEnv(index)" />
          </div>
          <el-button :icon="Plus" plain size="small" @click="addEnv">+ {{ $t('serverDetail.config.addEnv') }}</el-button>
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">{{ $t('action.cancel') }}</el-button>
        <el-button type="primary" @click="createServer">{{ $t('action.create') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { useServerStore } from '../stores/server'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const store = useServerStore()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const form = ref({
  transport: 'stdio' as 'stdio' | 'sse',
  name: '',
  command: '',
  args: [] as string[],
  url: '',
})

const envItems = ref<{key: string, value: string}[]>([])

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
    url: ''
  }
  envItems.value = []
}

function createServer() {
  const env = envItems.value.reduce((acc, item) => {
    if (item.key) acc[item.key] = item.value
    return acc
  }, {} as Record<string, string>)

  store.addServer({
    id: Math.random().toString(36).substr(2, 9),
    name: form.value.name || 'Unnamed Server',
    status: 'stopped',
    type: form.value.transport === 'stdio' ? 'local' : 'remote',
    config: {
      transport: form.value.transport,
      command: form.value.command,
      args: form.value.args.filter(a => a),
      url: form.value.url,
      env
    },
    logs: []
  })
  
  handleClose()
}
</script>

<style>
.custom-dialog {
  background-color: #1e293b;
  border: 1px solid #334155;
}
.custom-dialog .el-dialog__title {
  color: white;
}
.custom-dialog .el-dialog__body {
  color: white;
}
</style>
