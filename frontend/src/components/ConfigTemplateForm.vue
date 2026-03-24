<template>
  <div class="config-template-form">
    <div class="space-y-4">
      <!-- Transport Type -->
      <div class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{
          $t('serverDetail.config.transport')
        }}</label>
        <el-radio-group v-model="localConfig.type" class="flex gap-4">
          <el-radio value="stdio">{{ $t('serverDetail.config.transportStdio') }}</el-radio>
          <el-radio value="sse">{{ $t('serverDetail.config.transportSse') }}</el-radio>
          <el-radio value="streamable-http">{{ $t('serverDetail.config.transportHttp') }}</el-radio>
        </el-radio-group>
      </div>

      <!-- Command / URL -->
      <div v-if="localConfig.type === 'stdio'" class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{
          $t('serverDetail.config.executable')
        }}</label>
        <el-input v-model="localConfig.command" />
      </div>
      <div v-else class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{
          $t('serverDetail.config.url')
        }}</label>
        <el-input v-model="localConfig.url" />
      </div>

      <!-- Arguments (stdio only) -->
      <div v-if="localConfig.type === 'stdio'" class="pr-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{
            $t('serverDetail.config.args')
          }}</label>
          <el-button size="small" :icon="Plus" @click="addArg">{{
            $t('serverDetail.config.addArg')
          }}</el-button>
        </div>
        <div v-if="localConfig.args && localConfig.args.length > 0" class="space-y-2">
          <div v-for="(_, index) in localConfig.args" :key="index" class="flex gap-2 pr-4">
            <el-input v-model="localConfig.args![index]" class="flex-1" />
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
        <div v-if="localConfig.env && Object.keys(localConfig.env).length > 0" class="space-y-2">
          <div
            v-for="(_, key) in localConfig.env"
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
              v-model="localConfig.env![key]"
              style="flex: 1"
              :placeholder="$t('addServer.valuePlaceholder')"
            />
            <el-button size="small" type="danger" :icon="Delete" @click="removeEnv(key)" />
          </div>
        </div>
      </div>

      <!-- Headers (non-stdio only) -->
      <div v-if="localConfig.type !== 'stdio'" class="pr-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{
            $t('serverDetail.config.headers')
          }}</label>
          <el-button size="small" :icon="Plus" @click="addHeader">{{
            $t('serverDetail.config.addHeader')
          }}</el-button>
        </div>
        <div
          v-if="localConfig.headers && Object.keys(localConfig.headers).length > 0"
          class="space-y-2"
        >
          <div
            v-for="(_, key) in localConfig.headers"
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
              v-model="localConfig.headers![key]"
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
          $t('serverDetail.config.description')
        }}</label>
        <el-input
          v-model="localConfig.description"
          type="textarea"
          :rows="3"
          :placeholder="$t('serverDetail.config.descriptionPlaceholder')"
        />
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
import type { ServerTemplate } from '@shared-models/server.model';

interface Props {
  config: ServerTemplate;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:config', config: ServerTemplate): void;
  (e: 'save'): void;
  (e: 'edit-json'): void;
}>();

useI18n();

const localConfig = ref<ServerTemplate>({ ...props.config });
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
    if (localConfig.value?.timeout) {
      return localConfig.value.timeout / 1000;
    }
    return 60;
  },
  set: (val: number) => {
    if (localConfig.value) {
      localConfig.value.timeout = val * 1000;
    }
  }
});

function initializeEnvKeys() {
  if (localConfig.value?.env) {
    envKeys.value = {};
    Object.keys(localConfig.value.env).forEach((k) => {
      envKeys.value[k] = k;
    });
  }
}

function initializeHeaderKeys() {
  if (localConfig.value?.headers) {
    headerKeys.value = {};
    Object.keys(localConfig.value.headers).forEach((k) => {
      headerKeys.value[k] = k;
    });
  }
}

function addArg() {
  if (!localConfig.value.args) localConfig.value.args = [];
  localConfig.value.args.push('');
  emit('update:config', { ...localConfig.value });
}

function removeArg(index: number) {
  localConfig.value.args?.splice(index, 1);
  emit('update:config', { ...localConfig.value });
}

function addEnv() {
  if (!localConfig.value.env) localConfig.value.env = {};
  const newKey = `NEW_VAR_${Object.keys(localConfig.value.env).length}`;
  localConfig.value.env[newKey] = '';
  envKeys.value[newKey] = newKey;
  emit('update:config', { ...localConfig.value });
}

function removeEnv(key: string) {
  delete localConfig.value.env![key];
  delete envKeys.value[key];
  emit('update:config', { ...localConfig.value });
}

function updateEnvKey(oldKey: string, newKey: string) {
  if (oldKey === newKey) return;
  const val = localConfig.value.env![oldKey] || '';
  delete localConfig.value.env![oldKey];
  localConfig.value.env![newKey] = val;
  delete envKeys.value[oldKey];
  envKeys.value[newKey] = newKey;
  emit('update:config', { ...localConfig.value });
}

function addHeader() {
  if (!localConfig.value.headers) localConfig.value.headers = {};
  const newKey = `NEW_HEADER_${Object.keys(localConfig.value.headers).length}`;
  localConfig.value.headers[newKey] = '';
  headerKeys.value[newKey] = newKey;
  emit('update:config', { ...localConfig.value });
}

function removeHeader(key: string) {
  delete localConfig.value.headers![key];
  delete headerKeys.value[key];
  emit('update:config', { ...localConfig.value });
}

function updateHeaderKey(oldKey: string, newKey: string) {
  if (oldKey === newKey) return;
  const val = localConfig.value.headers![oldKey] || '';
  delete localConfig.value.headers![oldKey];
  localConfig.value.headers![newKey] = val;
  delete headerKeys.value[oldKey];
  headerKeys.value[newKey] = newKey;
  emit('update:config', { ...localConfig.value });
}

function handleSave() {
  emit('save');
}

function handleEditJson() {
  emit('edit-json');
}
</script>
