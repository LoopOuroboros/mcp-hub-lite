<template>
  <div class="config-template-form h-full flex flex-col min-h-0">
    <div class="space-y-4 flex-1 overflow-y-auto min-h-0">
      <!-- Transport Type -->
      <div class="px-4">
        <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{{
          $t('serverDetail.config.transport')
        }}</label>
        <el-radio-group v-model="localConfig.template.type" class="flex gap-4">
          <el-radio value="stdio">{{ $t('serverDetail.config.transportStdio') }}</el-radio>
          <el-radio value="sse">{{ $t('serverDetail.config.transportSse') }}</el-radio>
          <el-radio value="streamable-http">{{ $t('serverDetail.config.transportHttp') }}</el-radio>
        </el-radio-group>
      </div>

      <!-- Command / URL -->
      <div v-if="localConfig.template.type === 'stdio'" class="px-4">
        <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{{
          $t('serverDetail.config.executable')
        }}</label>
        <el-input v-model="localConfig.template.command" />
      </div>
      <div v-else class="px-4">
        <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{{
          $t('serverDetail.config.url')
        }}</label>
        <el-input v-model="localConfig.template.url" />
      </div>

      <!-- Arguments (stdio only) -->
      <div v-if="localConfig.template.type === 'stdio'" class="px-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-bold text-gray-700 dark:text-gray-300">{{
            $t('serverDetail.config.args')
          }}</label>
          <el-button size="small" :icon="Plus" @click="addArg">{{
            $t('serverDetail.config.addArg')
          }}</el-button>
        </div>
        <div
          v-if="localConfig.template.args && localConfig.template.args.length > 0"
          class="space-y-2"
        >
          <div v-for="(_, index) in localConfig.template.args" :key="index" class="flex gap-2 px-4">
            <el-input v-model="localConfig.template.args![index]" class="flex-1" />
            <el-button size="small" type="danger" :icon="Delete" @click="removeArg(index)" />
          </div>
        </div>
      </div>

      <!-- Environment Variables -->
      <div class="px-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-bold text-gray-700 dark:text-gray-300">{{
            $t('serverDetail.config.env')
          }}</label>
          <el-button size="small" :icon="Plus" @click="addEnv">{{
            $t('serverDetail.config.addEnv')
          }}</el-button>
        </div>
        <div
          v-if="localConfig.template.env && Object.keys(localConfig.template.env).length > 0"
          class="space-y-2"
        >
          <div
            v-for="(_, key) in localConfig.template.env"
            :key="envIds[key]"
            class="flex gap-2 items-start px-4"
            style="display: flex; gap: 0.5rem; width: 100%"
          >
            <el-input
              :model-value="key"
              style="width: 30%; min-width: 150px"
              :placeholder="$t('addServer.keyPlaceholder')"
              @update:model-value="(newKey: string) => updateEnvKey(key, newKey)"
            />
            <el-input
              v-model="localConfig.template.env![key]"
              style="flex: 1"
              :placeholder="$t('addServer.valuePlaceholder')"
            />
            <el-button size="small" type="danger" :icon="Delete" @click="removeEnv(key)" />
          </div>
        </div>
      </div>

      <!-- Headers (non-stdio only) -->
      <div v-if="localConfig.template.type !== 'stdio'" class="px-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-bold text-gray-700 dark:text-gray-300">{{
            $t('serverDetail.config.headers')
          }}</label>
          <el-button size="small" :icon="Plus" @click="addHeader">{{
            $t('serverDetail.config.addHeader')
          }}</el-button>
        </div>
        <div
          v-if="
            localConfig.template.headers && Object.keys(localConfig.template.headers).length > 0
          "
          class="space-y-2"
        >
          <div
            v-for="(_, key) in localConfig.template.headers"
            :key="headerIds[key]"
            class="flex gap-2 items-start px-4"
            style="display: flex; gap: 0.5rem; width: 100%"
          >
            <el-input
              :model-value="key"
              style="width: 30%; min-width: 150px"
              :placeholder="$t('addServer.keyPlaceholder')"
              @update:model-value="(newKey: string) => updateHeaderKey(key, newKey)"
            />
            <el-input
              v-model="localConfig.template.headers![key]"
              style="flex: 1"
              :placeholder="$t('addServer.valuePlaceholder')"
            />
            <el-button size="small" type="danger" :icon="Delete" @click="removeHeader(key)" />
          </div>
        </div>
      </div>

      <!-- Timeout -->
      <div class="px-4">
        <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{{
          $t('serverDetail.config.timeout')
        }}</label>
        <el-input-number v-model="timeoutInSeconds" :min="1" :max="3600" />
      </div>

      <!-- Proxy (non-stdio only) -->
      <div v-if="localConfig.template.type !== 'stdio'" class="px-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-bold text-gray-700 dark:text-gray-300">
            {{ $t('serverDetail.config.proxy') }}
          </label>
          <el-button
            size="small"
            :icon="Plus"
            @click="toggleProxy"
            v-if="!localConfig.template.proxy"
          >
            {{ $t('serverDetail.config.addProxy') }}
          </el-button>
          <el-button size="small" type="danger" :icon="Delete" @click="toggleProxy" v-else>
            {{ $t('serverDetail.config.removeProxy') }}
          </el-button>
        </div>
        <div v-if="localConfig.template.proxy" class="flex gap-2 items-start">
          <el-input
            v-model="localConfig.template.proxy.url"
            :placeholder="$t('serverDetail.config.proxyPlaceholder')"
          />
        </div>
      </div>

      <!-- Instance Selection Strategy -->
      <div class="px-4">
        <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{{
          $t('serverDetail.config.instanceSelectionStrategy')
        }}</label>
        <el-select
          v-model="localConfig.instanceSelectionStrategy"
          :placeholder="$t('serverDetail.config.strategyRandom') + '（默认）'"
        >
          <el-option value="random" :label="$t('serverDetail.config.strategyRandom')" />
          <el-option value="round-robin" :label="$t('serverDetail.config.strategyRoundRobin')" />
          <el-option
            value="tag-match-unique"
            :label="$t('serverDetail.config.strategyTagMatchUnique')"
          />
        </el-select>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 px-4">
        <el-button type="primary" @click="handleSave">{{
          $t('serverDetail.config.save')
        }}</el-button>
        <el-button @click="handleEditJson">{{ $t('serverDetail.config.editByJson') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Plus, Delete } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import type { ServerConfig, ServerTemplate } from '@shared-models/server.model';

interface Props {
  config: ServerConfig;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:template', config: ServerTemplate): void;
  (e: 'update:server-config', config: Partial<ServerConfig>): void;
  (e: 'save'): void;
  (e: 'edit-json'): void;
}>();

useI18n();

const localConfig = ref<ServerConfig>({
  ...props.config,
  instanceSelectionStrategy: props.config.instanceSelectionStrategy || 'random'
});

// ID counters for stable keys
let envIdCounter = 0;
let headerIdCounter = 0;

// Stable ID tracking for dynamic fields (key -> stableId)
const envIds = ref<Record<string, string>>({});
const headerIds = ref<Record<string, string>>({});

watch(
  () => props.config,
  (newConfig) => {
    localConfig.value = { ...newConfig };
    initializeEnvKeys();
    initializeHeaderKeys();
  },
  { immediate: true }
);

const timeoutInSeconds = computed({
  get: () => {
    if (localConfig.value?.template?.timeout) {
      return localConfig.value.template.timeout / 1000;
    }
    return 60;
  },
  set: (val: number) => {
    if (localConfig.value) {
      localConfig.value.template.timeout = val * 1000;
    }
  }
});

function initializeEnvKeys() {
  if (localConfig.value?.template?.env) {
    envIds.value = {};
    Object.keys(localConfig.value.template.env).forEach((k) => {
      envIds.value[k] = `env-${envIdCounter++}`;
    });
  }
}

function initializeHeaderKeys() {
  if (localConfig.value?.template?.headers) {
    headerIds.value = {};
    Object.keys(localConfig.value.template.headers).forEach((k) => {
      headerIds.value[k] = `header-${headerIdCounter++}`;
    });
  }
}

function addArg() {
  if (!localConfig.value.template.args) localConfig.value.template.args = [];
  localConfig.value.template.args.push('');
  emit('update:template', { ...localConfig.value.template });
}

function removeArg(index: number) {
  localConfig.value.template.args?.splice(index, 1);
  emit('update:template', { ...localConfig.value.template });
}

function addEnv() {
  if (!localConfig.value.template.env) localConfig.value.template.env = {};
  const newKey = `NEW_VAR_${Object.keys(localConfig.value.template.env).length}`;
  localConfig.value.template.env[newKey] = '';
  envIds.value[newKey] = `env-${envIdCounter++}`;
  emit('update:template', { ...localConfig.value.template });
}

function removeEnv(key: string) {
  delete localConfig.value.template.env![key];
  delete envIds.value[key];
  emit('update:template', { ...localConfig.value.template });
}

function updateEnvKey(oldKey: string, newKey: string) {
  if (oldKey === newKey) return;
  const val = localConfig.value.template.env![oldKey] || '';
  const stableId = envIds.value[oldKey] || `env-${envIdCounter++}`;
  delete localConfig.value.template.env![oldKey];
  delete envIds.value[oldKey];
  localConfig.value.template.env![newKey] = val;
  envIds.value[newKey] = stableId;
  emit('update:template', { ...localConfig.value.template });
}

function addHeader() {
  if (!localConfig.value.template.headers) localConfig.value.template.headers = {};
  const newKey = `NEW_HEADER_${Object.keys(localConfig.value.template.headers).length}`;
  localConfig.value.template.headers[newKey] = '';
  headerIds.value[newKey] = `header-${headerIdCounter++}`;
  emit('update:template', { ...localConfig.value.template });
}

function removeHeader(key: string) {
  delete localConfig.value.template.headers![key];
  delete headerIds.value[key];
  emit('update:template', { ...localConfig.value.template });
}

function updateHeaderKey(oldKey: string, newKey: string) {
  if (oldKey === newKey) return;
  const val = localConfig.value.template.headers![oldKey] || '';
  const stableId = headerIds.value[oldKey] || `header-${headerIdCounter++}`;
  delete localConfig.value.template.headers![oldKey];
  delete headerIds.value[oldKey];
  localConfig.value.template.headers![newKey] = val;
  headerIds.value[newKey] = stableId;
  emit('update:template', { ...localConfig.value.template });
}

function toggleProxy() {
  if (localConfig.value.template.proxy) {
    localConfig.value.template.proxy = undefined;
  } else {
    localConfig.value.template.proxy = { url: '' };
  }
  emit('update:template', { ...localConfig.value.template });
}

function handleSave() {
  // Extract template configuration
  const templateConfig = {
    command: localConfig.value.template.command,
    args: localConfig.value.template.args,
    env: localConfig.value.template.env,
    headers: localConfig.value.template.headers,
    type: localConfig.value.template.type,
    timeout: localConfig.value.template.timeout,
    url: localConfig.value.template.url,
    aggregatedTools: localConfig.value.template.aggregatedTools,
    description: localConfig.value.template.description,
    proxy: localConfig.value.template.proxy
  };

  // Emit template update event
  emit('update:template', templateConfig);

  // If instance selection strategy is not default, emit server config update event
  if (localConfig.value.instanceSelectionStrategy !== 'random') {
    emit('update:server-config', {
      instanceSelectionStrategy: localConfig.value.instanceSelectionStrategy
    });
  }

  emit('save');
}

function handleEditJson() {
  emit('edit-json');
}
</script>

<style scoped>
.config-template-form {
  @apply w-full h-full flex flex-col;
}
</style>
