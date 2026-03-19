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
            :class="
              form.transport === 'stdio'
                ? 'border-blue-500 bg-blue-900/20'
                : 'border-gray-600 hover:border-gray-500'
            "
            @click="form.transport = 'stdio'"
          >
            <div class="font-bold mb-1">stdio</div>
            <div class="text-xs text-gray-400">
              ({{ $t('serverDetail.config.transportStdio') }})
            </div>
          </div>
          <div
            class="flex-1 p-4 border rounded-lg cursor-pointer text-center transition-all"
            :class="
              form.transport === 'sse'
                ? 'border-blue-500 bg-blue-900/20'
                : 'border-gray-600 hover:border-gray-500'
            "
            @click="form.transport = 'sse'"
          >
            <div class="font-bold mb-1">SSE</div>
            <div class="text-xs text-gray-400">({{ $t('serverDetail.config.transportSse') }})</div>
          </div>
          <div
            class="flex-1 p-4 border rounded-lg cursor-pointer text-center transition-all"
            :class="
              form.transport === 'streamable-http'
                ? 'border-blue-500 bg-blue-900/20'
                : 'border-gray-600 hover:border-gray-500'
            "
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

      <el-form-item :label="$t('addServer.description')">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          :placeholder="$t('addServer.descriptionPlaceholder')"
        />
      </el-form-item>

      <template v-if="form.transport === 'stdio'">
        <el-form-item :label="$t('serverDetail.config.executable')">
          <el-input v-model="form.command" :placeholder="$t('addServer.executablePlaceholder')" />
        </el-form-item>
        <el-form-item :label="$t('serverDetail.config.args')">
          <div
            class="w-full flex flex-col gap-2"
            style="display: flex; flex-direction: column; width: 100%"
          >
            <div v-for="(_, index) in form.args" :key="index" class="flex gap-2 w-full">
              <el-input v-model="form.args[index]" :placeholder="$t('addServer.argPlaceholder')" />
              <el-button :icon="Delete" circle plain @click="removeArg(index)" />
            </div>
            <div>
              <el-button :icon="Plus" plain size="small" @click="addArg"
                >+ {{ $t('serverDetail.config.addArg') }}</el-button
              >
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
        <div
          class="w-full flex flex-col gap-2"
          style="display: flex; flex-direction: column; width: 100%"
        >
          <div
            v-for="(item, index) in envItems"
            :key="index"
            class="flex gap-2 w-full"
            style="display: flex; gap: 0.5rem; width: 100%"
          >
            <el-input
              v-model="item.key"
              :placeholder="$t('addServer.keyPlaceholder')"
              style="width: 30%; min-width: 150px"
            />
            <el-input
              v-model="item.value"
              :placeholder="$t('addServer.valuePlaceholder')"
              style="flex: 1"
            />
            <el-button :icon="Delete" circle plain @click="removeEnv(index)" />
          </div>
          <div>
            <el-button :icon="Plus" plain size="small" @click="addEnv"
              >+ {{ $t('serverDetail.config.addEnv') }}</el-button
            >
          </div>
        </div>
      </el-form-item>

      <template v-if="form.transport !== 'stdio'">
        <el-form-item :label="$t('serverDetail.config.headers')">
          <div
            class="w-full flex flex-col gap-2"
            style="display: flex; flex-direction: column; width: 100%"
          >
            <div
              v-for="(item, index) in headerItems"
              :key="index"
              class="flex gap-2 w-full"
              style="display: flex; gap: 0.5rem; width: 100%"
            >
              <el-input
                v-model="item.key"
                :placeholder="$t('addServer.keyPlaceholder')"
                style="width: 30%; min-width: 150px"
              />
              <el-input
                v-model="item.value"
                :placeholder="$t('addServer.valuePlaceholder')"
                style="flex: 1"
              />
              <el-button :icon="Delete" circle plain @click="removeHeader(index)" />
            </div>
            <div>
              <el-button :icon="Plus" plain size="small" @click="addHeader"
                >+ {{ $t('serverDetail.config.addHeader') }}</el-button
              >
            </div>
          </div>
        </el-form-item>
      </template>
    </el-form>

    <template #footer>
      <div class="dialog-footer flex justify-between w-full">
        <div class="flex gap-2">
          <el-button @click="showImportJson = true">{{ $t('addServer.byJson') }}</el-button>
          <el-button @click="showBatchImport = true">{{ $t('addServer.importBatch') }}</el-button>
        </div>
        <div>
          <el-button @click="handleClose" :disabled="isSubmitting">{{
            $t('action.cancel')
          }}</el-button>
          <el-button type="primary" @click="createServer" :loading="isSubmitting">{{
            $t('action.create')
          }}</el-button>
        </div>
      </div>
    </template>

    <el-dialog
      v-model="showImportJson"
      :title="$t('addServer.byJson')"
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
        <el-button @click="showImportJson = false">{{ $t('action.cancel') }}</el-button>
        <el-button type="primary" @click="importJson">{{ $t('action.save') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showBatchImport"
      :title="$t('addServer.batchImportTitle')"
      width="600px"
      append-to-body
      class="custom-dialog"
    >
      <el-input
        v-model="batchJsonConfig"
        type="textarea"
        :rows="12"
        placeholder='{ "mcpServers": { "server1": { "command": "npx @anthropic-ai/mcp", "args": ["--model", "claude-3-opus-20250620"] }, "server2": { "url": "http://localhost:3000", "headers": { "Authorization": "Bearer token" } } } }'
      />
      <template #footer>
        <el-button @click="showBatchImport = false">{{ $t('action.cancel') }}</el-button>
        <el-button type="primary" @click="importBatchJson" :loading="isSubmitting">{{
          $t('addServer.importAll')
        }}</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showImportResult"
      :title="$t('addServer.batchImportTitle')"
      width="600px"
      append-to-body
      class="custom-dialog"
    >
      <div v-if="importResult.success.length > 0" class="mb-4">
        <h4 class="text-green-500 mb-2">{{ $t('action.serverAdded') }}</h4>
        <el-card class="mb-4">
          <template #header>
            <div class="card-header">
              <span>{{ $t('action.serverAdded') }}</span>
            </div>
          </template>
          <div class="space-y-2">
            <div
              v-for="server in importResult.success"
              :key="server.id"
              class="p-2 bg-green-50 dark:bg-green-900/20 rounded"
            >
              {{ server.name }}
            </div>
          </div>
        </el-card>
      </div>
      <div v-if="importResult.errors.length > 0" class="mb-4">
        <h4 class="text-red-500 mb-2">{{ $t('error.addServerFailed') }}</h4>
        <el-card class="mb-4">
          <template #header>
            <div class="card-header">
              <span>{{ $t('error.addServerFailed') }}</span>
            </div>
          </template>
          <div class="space-y-2">
            <div
              v-for="(error, index) in importResult.errors"
              :key="index"
              class="p-2 bg-red-50 dark:bg-red-900/20 rounded"
            >
              <div class="font-bold">{{ error.name }}</div>
              <div class="text-sm text-gray-400">{{ error.error }}</div>
            </div>
          </div>
        </el-card>
      </div>
      <template #footer>
        <el-button @click="showImportResult = false">Close</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Plus, Delete } from '@element-plus/icons-vue';
import { useServerStore } from '@stores/server';
import { ElMessage } from 'element-plus';

// Server type for import result
interface ImportedServer {
  id: string;
  name: string;
  [key: string]: unknown;
}

const props = defineProps<{
  modelValue: boolean;
  initialMode?: 'form' | 'json';
}>();

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const store = useServerStore();

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const showImportJson = ref(false);
const showBatchImport = ref(false);
const showImportResult = ref(false);

watch(dialogVisible, (val) => {
  if (val && props.initialMode === 'json') {
    showImportJson.value = true;
  }
});
const defaultJsonConfig = `{\n  "mcpServers": {\n  }\n}`;
const jsonConfig = ref(defaultJsonConfig);
const batchJsonConfig = ref(
  `{\n  "mcpServers": {\n    "server1": {\n      "command": "npx @anthropic-ai/mcp",\n      "args": ["--model", "claude-3-opus-20250620"],\n      "enabled": true,\n      "description": "A sample MCP server using stdio transport"\n    },\n    "server2": {\n      "type": "streamable-http",\n      "url": "http://localhost:3000",\n      "headers": { "Authorization": "Bearer token" },\n      "enabled": true,\n      "description": "A sample MCP server using HTTP transport"\n    }\n  }\n}`
);

const importResult = ref({
  success: [] as ImportedServer[],
  errors: [] as { name: string; error: string }[]
});

const form = ref({
  transport: 'stdio' as 'stdio' | 'sse' | 'streamable-http',
  name: '',
  description: '',
  command: '',
  args: [] as string[],
  url: '',
  timeout: 60,
  autoStart: true
});

const envItems = ref<{ key: string; value: string }[]>([]);
const headerItems = ref<{ key: string; value: string }[]>([]);

function importJson() {
  try {
    const parsed = JSON.parse(jsonConfig.value);
    // Support { "mcpServers": { "name": { ... } } } or just { ... }
    let configToUse = parsed;
    let nameToUse = '';

    if (parsed.mcpServers) {
      const keys = Object.keys(parsed.mcpServers);
      if (keys.length > 0) {
        nameToUse = keys[0] || '';
        configToUse = parsed.mcpServers[nameToUse];
      }
    }

    if (nameToUse) {
      form.value.name = nameToUse;
    }

    if (configToUse.command) {
      form.value.transport = 'stdio';
      form.value.command = configToUse.command;
      form.value.args = configToUse.args || [];
    } else if (configToUse.url) {
      // Only use sse if explicitly specified, otherwise default to streamable-http
      form.value.transport = configToUse.type === 'sse' ? 'sse' : 'streamable-http';
      form.value.url = configToUse.url;
    }

    if (configToUse.timeout) {
      form.value.timeout = configToUse.timeout / 1000;
    }

    if (configToUse.enabled !== undefined) {
      form.value.autoStart = configToUse.enabled;
    }

    if (configToUse.env) {
      envItems.value = Object.entries(configToUse.env).map(([key, value]) => ({
        key,
        value: String(value)
      }));
    }

    if (configToUse.headers) {
      headerItems.value = Object.entries(configToUse.headers).map(([key, value]) => ({
        key,
        value: String(value)
      }));
    }

    if (configToUse.description) {
      form.value.description = configToUse.description;
    }

    showImportJson.value = false;
    ElMessage.success(t('action.configImported'));
  } catch (e: unknown) {
    if (e instanceof Error) {
      ElMessage.error(t('error.invalidJsonConfig') + ': ' + e.message);
    } else {
      ElMessage.error(t('error.invalidJsonConfig') + ': ' + String(e));
    }
  }
}

async function importBatchJson() {
  try {
    const parsed = JSON.parse(batchJsonConfig.value);

    if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
      ElMessage.error('Invalid JSON format: missing "mcpServers" object');
      return;
    }

    // Close dialogs immediately
    showBatchImport.value = false;
    handleClose();
    ElMessage.success(t('action.serverAdded'));

    // Run import asynchronously
    store.importServersFromJson(parsed).catch((e: unknown) => {
      console.error('Import error:', e);
      if (e instanceof Error) {
        ElMessage.error('Import failed: ' + e.message);
      } else {
        ElMessage.error('Import failed: ' + String(e));
      }
    });
  } catch (e: unknown) {
    console.error('Import error:', e); // Add error debugging information
    if (e instanceof Error) {
      ElMessage.error('Import failed: ' + e.message);
    } else {
      ElMessage.error('Import failed: ' + String(e));
    }
  }
}

function addArg() {
  form.value.args.push('');
}

function removeArg(index: number) {
  form.value.args.splice(index, 1);
}

function addEnv() {
  envItems.value.push({ key: '', value: '' });
}

function removeEnv(index: number) {
  envItems.value.splice(index, 1);
}

function addHeader() {
  headerItems.value.push({ key: '', value: '' });
}

function removeHeader(index: number) {
  headerItems.value.splice(index, 1);
}

function handleClose() {
  dialogVisible.value = false;
  resetForm();
}

function resetForm() {
  form.value = {
    transport: 'stdio',
    name: '',
    description: '',
    command: '',
    args: [],
    url: '',
    timeout: 60,
    autoStart: true
  };
  envItems.value = [];
  headerItems.value = [];
  jsonConfig.value = defaultJsonConfig;
  batchJsonConfig.value = `{\n  "mcpServers": {\n    "server1": {\n      "command": "npx @anthropic-ai/mcp",\n      "args": ["--model", "claude-3-opus-20250620"],\n      "enabled": true,\n      "description": "A sample MCP server using stdio transport"\n    },\n    "server2": {\n      "type": "streamable-http",\n      "url": "http://localhost:3000",\n      "headers": { "Authorization": "Bearer token" },\n      "enabled": true,\n      "description": "A sample MCP server using HTTP transport"\n    }\n  }\n}`;
  importResult.value = {
    success: [],
    errors: []
  };
  showImportJson.value = false;
  showBatchImport.value = false;
  showImportResult.value = false;
}

const isSubmitting = ref(false);

async function createServer() {
  if (isSubmitting.value) return;
  isSubmitting.value = true;

  const env = envItems.value.reduce(
    (acc, item) => {
      if (item.key) acc[item.key] = item.value;
      return acc;
    },
    {} as Record<string, string>
  );

  const headers = headerItems.value.reduce(
    (acc, item) => {
      if (item.key) acc[item.key] = item.value;
      return acc;
    },
    {} as Record<string, string>
  );

  try {
    await store.addServer({
      name: form.value.name || 'Unnamed Server',
      status: 'offline',
      type: form.value.transport === 'stdio' ? 'local' : 'remote',
      config: {
        type: form.value.transport,
        command: form.value.command,
        args: form.value.args.filter((a) => a),
        url: form.value.url,
        timeout: form.value.timeout * 1000,
        enabled: form.value.autoStart,
        allowedTools: [],
        env,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        description: form.value.description || undefined
      },
      logs: []
    });

    ElMessage.success(t('action.serverAdded'));
    handleClose();
  } catch (error: unknown) {
    if (error instanceof Error) {
      ElMessage.error(error.message || t('error.addServerFailed'));
    } else {
      ElMessage.error(t('error.addServerFailed'));
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style>
/* Adapt to dark mode, apply dark background only in dark mode */
html.dark .custom-dialog {
  --el-dialog-bg-color: #1e293b;
  border: 1px solid #334155;
}

/* Ensure title and close button colors are correct */
html.dark .custom-dialog .el-dialog__title {
  color: white;
}
</style>
