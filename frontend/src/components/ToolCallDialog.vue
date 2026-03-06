<!--
  ToolCallDialog Component

  A modal dialog component for executing MCP tools with parameter input and result display.
  Supports both system tools and server-specific tools with instance selection.

  Features:
  - JSON argument input with syntax formatting
  - Input schema display based on tool definition
  - Server instance selection for multi-instance servers
  - Real-time result/error display with color coding
  - Automatic template generation from input schema
  - Internationalization support via vue-i18n
  - Responsive layout with split view for arguments and results
-->
<template>
  <el-dialog
    v-model="visible"
    :title="t('toolCallDialog.title', { toolName })"
    width="800px"
    class="tool-call-dialog"
    destroy-on-close
  >
    <div class="flex flex-col h-[60vh]">
      <!-- Tool Info -->
      <div
        v-if="description"
        class="mb-4 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50 max-h-32 overflow-y-auto"
      >
        {{ description }}
      </div>

      <!-- Server Instance Selection -->
      <div v-if="serverName && serverName !== 'mcp-hub-lite'" class="mb-4 flex items-center">
        <span class="font-medium text-gray-700 dark:text-gray-300 mr-2 whitespace-nowrap">{{
          t('toolCallDialog.instance')
        }}</span>
        <el-select
          v-model="selectedInstanceId"
          :placeholder="t('toolCallDialog.selectInstance')"
          size="small"
          class="flex-1"
          @change="handleInstanceChange"
        >
          <el-option
            v-for="instance in serverInstances"
            :key="instance.id"
            :label="formatInstanceLabel(instance)"
            :value="instance.id"
          />
        </el-select>
      </div>

      <div class="flex-1 flex gap-4 min-h-0">
        <!-- Input Area -->
        <div class="flex-1 flex flex-col min-w-0">
          <div class="flex justify-between items-center mb-2">
            <span class="font-medium text-gray-700 dark:text-gray-300">{{
              t('toolCallDialog.arguments')
            }}</span>
            <el-button link type="primary" size="small" @click="formatJson">{{
              t('toolCallDialog.formatJson')
            }}</el-button>
          </div>
          <el-input
            v-model="argsJson"
            type="textarea"
            class="flex-1 font-mono custom-textarea"
            :input-style="{ height: '100%', fontFamily: 'monospace' }"
            placeholder='{"key": "value"}'
            resize="none"
            maxlength="1000000"
            show-word-limit
          />
        </div>

        <!-- Schema/Result Area -->
        <div
          class="flex-1 flex flex-col min-w-0 border-l border-gray-200 dark:border-gray-700 pl-4"
        >
          <div class="flex justify-between items-center mb-2">
            <span class="font-medium text-gray-700 dark:text-gray-300">
              {{
                showInputSchema
                  ? t('toolCallDialog.inputSchema')
                  : result || error
                    ? t('toolCallDialog.response')
                    : t('toolCallDialog.inputSchema')
              }}
            </span>
            <el-button
              v-if="result || error || showInputSchema"
              link
              type="info"
              size="small"
              @click="toggleSchemaView"
            >
              {{
                showInputSchema
                  ? t('toolCallDialog.showResponse')
                  : t('toolCallDialog.showInputSchema')
              }}
            </el-button>
          </div>

          <div
            class="flex-1 overflow-auto bg-gray-50 dark:bg-[#0f172a] rounded-lg border border-gray-200 dark:border-gray-700 p-4 font-mono text-sm"
          >
            <pre
              v-if="showInputSchema"
              class="whitespace-pre-wrap break-words text-gray-600 dark:text-gray-400"
              >{{ formattedSchema }}</pre
            >
            <pre
              v-else-if="result"
              class="whitespace-pre-wrap break-words text-green-600 dark:text-green-400"
              >{{ result }}</pre
            >
            <pre
              v-else-if="error"
              class="whitespace-pre-wrap break-words text-red-600 dark:text-red-400"
              >{{ error }}</pre
            >
            <pre v-else class="whitespace-pre-wrap break-words text-gray-600 dark:text-gray-400">{{
              formattedSchema
            }}</pre>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center">
        <div class="text-xs text-gray-500">
          <span v-if="loading">{{ t('toolCallDialog.executing') }}</span>
        </div>
        <div class="flex gap-2">
          <el-button @click="visible = false">{{ t('action.cancel') }}</el-button>
          <el-button type="primary" :loading="loading" @click="handleCall">{{
            t('toolCallDialog.execute')
          }}</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { http, HttpError } from '@utils/http';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

import type { JsonSchema } from '@shared-models/tool.model';
import type { ServerInstanceConfig } from '@shared-models/server.model';

/**
 * Extended server instance type that includes runtime properties
 *
 * @typedef {Object} ServerInstance
 * @property {string} id - Unique instance identifier
 * @property {string} status - Current instance status
 * @property {number} [pid] - Process ID for stdio instances (optional)
 * @property {number} [startTime] - Instance start timestamp (optional)
 */
type ServerInstance = ServerInstanceConfig & {
  pid?: number;
  startTime?: number;
};

/**
 * Props interface for ToolCallDialog component
 *
 * @interface ToolCallDialogProps
 * @property {boolean} modelValue - Dialog visibility state (v-model binding)
 * @property {string} [serverName] - Optional server name for server-specific tools
 * @property {string} toolName - Name of the tool to execute
 * @property {string} [description] - Optional tool description
 * @property {JsonSchema} [inputSchema] - Optional JSON schema for tool parameters
 */
const props = defineProps<{
  modelValue: boolean;
  serverName?: string;
  toolName: string;
  description?: string;
  inputSchema?: JsonSchema;
}>();

/**
 * Emits interface for ToolCallDialog component
 *
 * @interface ToolCallDialogEmits
 * @event update:modelValue - Updates the dialog visibility state
 */
const emit = defineEmits(['update:modelValue']);

/**
 * Computed property for two-way binding of dialog visibility
 *
 * @type {ComputedRef<boolean>}
 */
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

/**
 * Reactive state variables for component functionality
 *
 * @type {Ref<string>} argsJson - JSON string of tool arguments
 * @type {Ref<string|null>} result - Execution result (null when not executed)
 * @type {Ref<string|null>} error - Execution error (null when no error)
 * @type {Ref<boolean>} loading - Loading state during tool execution
 * @type {Ref<boolean>} showInputSchema - Toggle for showing input schema vs results
 * @type {Ref<ServerInstance[]>} serverInstances - Available server instances
 * @type {Ref<string|null>} selectedInstanceId - Currently selected instance ID
 */
const argsJson = ref('{}');
const result = ref<string | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const showInputSchema = ref(false);
const serverInstances = ref<ServerInstance[]>([]);
const selectedInstanceId = ref<string | null>(null);

/**
 * Computed property that formats the input schema as pretty-printed JSON
 *
 * @returns {string} Formatted JSON schema or '{}' if no schema provided
 */
const formattedSchema = computed(() => {
  if (!props.inputSchema) return '{}';
  return JSON.stringify(props.inputSchema, null, 2);
});

/**
 * Fetches available server instances from the API when serverName is provided
 *
 * Makes an HTTP GET request to retrieve server instances and handles errors gracefully.
 * Automatically selects the first instance if available.
 *
 * @async
 * @returns {Promise<void>}
 */
const fetchServerInstances = async () => {
  if (props.serverName) {
    try {
      const response = await http.get(`/web/server-instances/${props.serverName}`);
      const instances = Array.isArray(response) ? response : [];
      serverInstances.value = instances as ServerInstance[];
      if (instances.length > 0) {
        selectedInstanceId.value = instances[0].id;
      }
    } catch (error) {
      console.error('Failed to fetch server instances:', error);
      serverInstances.value = [];
      selectedInstanceId.value = null;
    }
  }
};

/**
 * Watches for serverName changes and fetches instances accordingly
 */
watch(
  () => props.serverName,
  () => {
    fetchServerInstances();
  }
);

/**
 * Watches for dialog visibility changes and initializes component state
 *
 * When the dialog opens, it generates a template from the input schema,
 * resets result/error states, and fetches server instances.
 */
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      // Try to generate a template based on schema
      const template = generateTemplate(props.inputSchema);
      argsJson.value = JSON.stringify(template, null, 2);
      result.value = null;
      error.value = null;
      // Fetch instances when dialog is opened
      fetchServerInstances();
    }
  },
  { immediate: true }
);

/**
 * Generates a template object based on the provided JSON schema
 *
 * Creates default values for each property based on its type:
 * - strings: empty string
 * - numbers/integers: 0
 * - booleans: false
 * - arrays: empty array
 * - objects: empty object
 * - others: null
 *
 * @param {JsonSchema|undefined} schema - Input schema to generate template from
 * @returns {Record<string, unknown>} Template object with default values
 */
function generateTemplate(schema: JsonSchema | undefined) {
  if (!schema || !schema.properties) return {};
  const template: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema.properties)) {
    const prop = value as JsonSchema;
    if (prop.default !== undefined) {
      template[key] = prop.default;
    } else if (prop.type === 'string') {
      template[key] = '';
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

/**
 * Formats the current JSON arguments with proper indentation
 *
 * Parses and re-stringifies the JSON with 2-space indentation for better readability.
 * Shows a warning message if the JSON is invalid.
 */
function formatJson() {
  try {
    const parsed = JSON.parse(argsJson.value);
    argsJson.value = JSON.stringify(parsed, null, 2);
  } catch {
    ElMessage.warning(t('toolCallDialog.invalidJson'));
  }
}

/**
 * Toggles between showing input schema and execution results
 */
function toggleSchemaView() {
  showInputSchema.value = !showInputSchema.value;
}

/**
 * Formats the display label for server instances in the dropdown
 *
 * @param {ServerInstance} instance - Server instance object
 * @returns {string} Formatted label string
 */
function formatInstanceLabel(instance: ServerInstance) {
  return `${instance.id}`;
}

/**
 * Handles changes to the selected server instance
 *
 * Logs the selected instance ID for debugging purposes.
 */
function handleInstanceChange() {
  console.log('Selected instance:', selectedInstanceId.value);
}

/**
 * Executes the tool call with the provided arguments
 *
 * Handles both system tools (no serverName) and server-specific tools.
 * Includes comprehensive error handling for different error types:
 * - Standard JavaScript errors
 * - HttpError with detailed response data
 * - Legacy Axios error format
 *
 * Shows appropriate success/error messages using Element Plus notifications.
 *
 * @async
 * @returns {Promise<void>}
 */
async function handleCall() {
  try {
    let args: unknown;
    try {
      args = JSON.parse(argsJson.value);
    } catch {
      ElMessage.error(t('toolCallDialog.invalidJsonArguments'));
      return;
    }

    loading.value = true;
    result.value = null;
    error.value = null;
    showInputSchema.value = false;

    let response;
    if (props.serverName && props.serverName !== 'mcp-hub-lite') {
      response = await http.post(
        `/web/hub-tools/servers/${props.serverName}/tools/${props.toolName}/call`,
        {
          toolArgs: args,
          requestOptions: selectedInstanceId.value
            ? { sessionId: selectedInstanceId.value }
            : undefined
        }
      );
    } else {
      // Call system tool (either no serverName or serverName is 'mcp-hub-lite')
      response = await http.post(`/web/hub-tools/system/${props.toolName}/call`, {
        toolArgs: args
      });
    }

    result.value = JSON.stringify(response, null, 2);
    ElMessage.success(t('toolCallDialog.executionSuccessful'));
  } catch (e: unknown) {
    console.error('Tool execution failed:', e);

    // Default error message
    if (e instanceof Error) {
      error.value = e.message || String(e);
    } else {
      error.value = String(e);
    }

    // Handle HttpError with detailed data
    if (e instanceof HttpError && e.data) {
      error.value = typeof e.data === 'string' ? e.data : JSON.stringify(e.data, null, 2);
    }
    // Legacy/Axios fallback (just in case)
    else if (
      typeof e === 'object' &&
      e !== null &&
      'response' in e &&
      (e as { response?: { data?: unknown } }).response?.data
    ) {
      error.value = JSON.stringify(
        (e as { response?: { data?: unknown } }).response!.data!,
        null,
        2
      );
    }

    ElMessage.error(t('toolCallDialog.executionFailed'));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
/**
 * Custom textarea styling to ensure full height usage
 *
 * Overrides Element Plus default textarea height to fill container.
 */
.custom-textarea :deep(.el-textarea__inner) {
  height: 100%;
}
</style>
