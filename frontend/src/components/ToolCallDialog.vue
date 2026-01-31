<template>
  <el-dialog
    v-model="visible"
    :title="`Call Tool: ${toolName}`"
    width="800px"
    class="tool-call-dialog"
    destroy-on-close
  >
    <div class="flex flex-col h-[60vh]">
      <!-- Tool Info -->
      <div v-if="description" class="mb-4 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50 max-h-32 overflow-y-auto">
        {{ description }}
      </div>

      <div class="flex-1 flex gap-4 min-h-0">
        <!-- Input Area -->
        <div class="flex-1 flex flex-col min-w-0">
          <div class="flex justify-between items-center mb-2">
            <span class="font-medium text-gray-700 dark:text-gray-300">Arguments (JSON)</span>
            <el-button link type="primary" size="small" @click="formatJson">Format JSON</el-button>
          </div>
          <el-input
            v-model="argsJson"
            type="textarea"
            class="flex-1 font-mono custom-textarea"
            :input-style="{ height: '100%', fontFamily: 'monospace' }"
            placeholder='{ "key": "value" }'
            resize="none"
            maxlength="1000000"
            show-word-limit
          />
        </div>

        <!-- Schema/Result Area -->
        <div class="flex-1 flex flex-col min-w-0 border-l border-gray-200 dark:border-gray-700 pl-4">
          <div class="flex justify-between items-center mb-2">
            <span class="font-medium text-gray-700 dark:text-gray-300">
              {{ result ? 'Result' : 'Input Schema' }}
            </span>
            <el-button v-if="result" link type="info" size="small" @click="clearResult">Show Schema</el-button>
          </div>
          
          <div class="flex-1 overflow-auto bg-gray-50 dark:bg-[#0f172a] rounded-lg border border-gray-200 dark:border-gray-700 p-4 font-mono text-sm">
            <pre v-if="result" class="whitespace-pre-wrap break-words text-green-600 dark:text-green-400">{{ result }}</pre>
            <pre v-else-if="error" class="whitespace-pre-wrap break-words text-red-600 dark:text-red-400">{{ error }}</pre>
            <pre v-else class="whitespace-pre-wrap break-words text-gray-600 dark:text-gray-400">{{ formattedSchema }}</pre>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center">
        <div class="text-xs text-gray-500">
          <span v-if="loading">Executing...</span>
        </div>
        <div class="flex gap-2">
          <el-button @click="visible = false">Close</el-button>
          <el-button type="primary" :loading="loading" @click="handleCall">Execute</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { http, HttpError } from '@utils/http';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  modelValue: boolean;
  serverId?: string;
  toolName: string;
  description?: string;
  inputSchema?: any;
}>();

const emit = defineEmits(['update:modelValue']);

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const argsJson = ref('{}');
const result = ref<string | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);

const formattedSchema = computed(() => {
  if (!props.inputSchema) return '{}';
  return JSON.stringify(props.inputSchema, null, 2);
});

watch(() => props.modelValue, (val) => {
  if (val) {
    // Try to generate a template based on schema
    const template = generateTemplate(props.inputSchema);
    argsJson.value = JSON.stringify(template, null, 2);
    result.value = null;
    error.value = null;
  }
});

function generateTemplate(schema: any) {
  if (!schema || !schema.properties) return {};
  const template: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(schema.properties)) {
    const prop = value as any;
    if (prop.default !== undefined) {
      template[key] = prop.default;
    } else if (prop.type === 'string') {
      template[key] = "";
    } else if (prop.type === 'number' || prop.type === 'integer') {
      template[key] = 0;
    } else if (prop.type === 'boolean') {
      template[key] = false;
    } else if (prop.type === 'array') {
      template[key] = [];
    } else if (prop.type === 'object') {
      template[key] = {};
    } else {
      template[key] = null;
    }
  }
  return template;
}

function formatJson() {
  try {
    const parsed = JSON.parse(argsJson.value);
    argsJson.value = JSON.stringify(parsed, null, 2);
  } catch (e) {
    ElMessage.warning('Invalid JSON');
  }
}

function clearResult() {
  result.value = null;
  error.value = null;
}

async function handleCall() {
  try {
    let args: any;
    try {
      args = JSON.parse(argsJson.value);
    } catch (e) {
      ElMessage.error('Invalid JSON arguments');
      return;
    }

    loading.value = true;
    result.value = null;
    error.value = null;

    let response;
    if (props.serverId) {
        response = await http.post(`/web/hub-tools/servers/${props.serverId}/tools/${props.toolName}/call`, {
            toolArgs: args
        });
    } else {
         response = await http.post(`/web/hub-tools/system/${props.toolName}/call`, { toolArgs: args });
    }

    result.value = JSON.stringify(response, null, 2);
    ElMessage.success('Tool execution successful');
  } catch (e: any) {
    console.error('Tool execution failed:', e);
    
    // Default error message
    error.value = e.message || String(e);

    // Handle HttpError with detailed data
    if (e instanceof HttpError && e.data) {
        error.value = typeof e.data === 'string' 
            ? e.data 
            : JSON.stringify(e.data, null, 2);
    } 
    // Legacy/Axios fallback (just in case)
    else if (e.response && e.response.data) {
        error.value = JSON.stringify(e.response.data, null, 2);
    }
    
    ElMessage.error('Tool execution failed');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.custom-textarea :deep(.el-textarea__inner) {
  height: 100%;
}
</style>
