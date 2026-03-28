<template>
  <div class="config-template-form">
    <div class="space-y-4">
      <!-- Transport Type -->
      <div class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{
          $t('serverDetail.config.transport')
        }}</label>
        <el-radio-group v-model="localConfig.template.type" class="flex gap-4">
          <el-radio value="stdio">{{ $t('serverDetail.config.transportStdio') }}</el-radio>
          <el-radio value="sse">{{ $t('serverDetail.config.transportSse') }}</el-radio>
          <el-radio value="streamable-http">{{ $t('serverDetail.config.transportHttp') }}</el-radio>
        </el-radio-group>
      </div>

      <!-- Command / URL -->
      <div v-if="localConfig.template.type === 'stdio'" class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{
          $t('serverDetail.config.executable')
        }}</label>
        <el-input v-model="localConfig.template.command" />
      </div>
      <div v-else class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{
          $t('serverDetail.config.url')
        }}</label>
        <el-input v-model="localConfig.template.url" />
      </div>

      <!-- Arguments (stdio only) -->
      <div v-if="localConfig.template.type === 'stdio'" class="pr-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{
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
          <div v-for="(_, index) in localConfig.template.args" :key="index" class="flex gap-2 pr-4">
            <el-input v-model="localConfig.template.args![index]" class="flex-1" />
            <el-button size="small" type="danger" :icon="Delete" @click="removeArg(index)" />
          </div>
        </div>
      </div>

      <!-- Environment Variables -->
      <div class="pr-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{
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
            :key="key"
            class="flex gap-2 items-start pr-4"
            style="display: flex; gap: 0.5rem; width: 100%"
          >
            <el-input
              :model-value="key"
              style="width: 30%; min-width: 150px"
              :placeholder="$t('addServer.keyPlaceholder')"
              @update:model-value="(newKey) => updateEnvKey(key, newKey as string)"
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
      <div v-if="localConfig.template.type !== 'stdio'" class="pr-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{
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
            :key="key"
            class="flex gap-2 items-start pr-4"
            style="display: flex; gap: 0.5rem; width: 100%"
          >
            <el-input
              :model-value="key"
              style="width: 30%; min-width: 150px"
              :placeholder="$t('addServer.keyPlaceholder')"
              @update:model-value="(newKey) => updateHeaderKey(key, newKey as string)"
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
      <div class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{
          $t('serverDetail.config.timeout')
        }}</label>
        <el-input-number v-model="timeoutInSeconds" :min="1" :max="3600" />
      </div>

      <!-- Description -->
      <div class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{
          $t('common.description')
        }}</label>
        <el-input
          v-model="localConfig.template.description"
          type="textarea"
          :rows="3"
          :placeholder="$t('serverDetail.config.descriptionPlaceholder')"
        />
      </div>

      <!-- Instance Selection Strategy -->
      <div class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{
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
      <div class="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 pr-4">
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
const envKeys = ref<Record<string, string>>({});
const headerKeys = ref<Record<string, string>>({});

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
    envKeys.value = {};
    Object.keys(localConfig.value.template.env).forEach((k) => {
      envKeys.value[k] = k;
    });
  }
}

function initializeHeaderKeys() {
  if (localConfig.value?.template?.headers) {
    headerKeys.value = {};
    Object.keys(localConfig.value.template.headers).forEach((k) => {
      headerKeys.value[k] = k;
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
  envKeys.value[newKey] = newKey;
  emit('update:template', { ...localConfig.value.template });
}

function removeEnv(key: string) {
  delete localConfig.value.template.env![key];
  delete envKeys.value[key];
  emit('update:template', { ...localConfig.value.template });
}

function updateEnvKey(oldKey: string, newKey: string) {
  if (oldKey === newKey) return;
  const val = localConfig.value.template.env![oldKey] || '';
  delete localConfig.value.template.env![oldKey];
  localConfig.value.template.env![newKey] = val;
  delete envKeys.value[oldKey];
  envKeys.value[newKey] = newKey;
  emit('update:template', { ...localConfig.value.template });
}

function addHeader() {
  if (!localConfig.value.template.headers) localConfig.value.template.headers = {};
  const newKey = `NEW_HEADER_${Object.keys(localConfig.value.template.headers).length}`;
  localConfig.value.template.headers[newKey] = '';
  headerKeys.value[newKey] = newKey;
  emit('update:template', { ...localConfig.value.template });
}

function removeHeader(key: string) {
  delete localConfig.value.template.headers![key];
  delete headerKeys.value[key];
  emit('update:template', { ...localConfig.value.template });
}

function updateHeaderKey(oldKey: string, newKey: string) {
  if (oldKey === newKey) return;
  const val = localConfig.value.template.headers![oldKey] || '';
  delete localConfig.value.template.headers![oldKey];
  localConfig.value.template.headers![newKey] = val;
  delete headerKeys.value[oldKey];
  headerKeys.value[newKey] = newKey;
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
    description: localConfig.value.template.description
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
