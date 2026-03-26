<!--
  InstanceConfig Component

  Displays a unified configuration form for instance configuration:
  - Uses the same layout as ConfigTemplateForm for consistency
  - Template-defined fields are read-only/disabled with gray background
  - Instance-added fields are fully editable
  - Supports adding new editable fields in each section (args, env, headers, tags)
  - Keeps the "view merged configuration" feature

  Features:
  - Unified single-column layout matching ConfigTemplateForm
  - Template fields: read-only, grayed out, with "from template" indicator
  - Instance fields: fully editable, can be deleted
  - Add buttons for each section to add new instance-specific fields
  - Merged configuration preview via modal dialog button

  This component provides a more intuitive experience for understanding
  the relationship between template and instance configurations.
-->
<template>
  <div class="instance-config">
    <!-- Header with title, action buttons, and preview button -->
    <div class="header-bar flex justify-between items-center mb-4 pr-4">
      <div class="flex items-center gap-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ $t('serverDetail.instanceConfig.title') }}
        </h3>
        <!-- Instance Control Buttons -->
        <div class="flex gap-2">
          <el-button :icon="Refresh" plain @click="handleRestart">
            {{ $t('action.restart') }}
          </el-button>
          <el-button
            v-if="instanceStatus === 'online'"
            type="warning"
            plain
            :icon="SwitchButton"
            @click="handleStop"
          >
            {{ $t('action.stop') }}
          </el-button>
          <el-button v-else type="success" :icon="VideoPlay" @click="handleStart">
            {{ $t('action.start') }}
          </el-button>
        </div>
      </div>
      <el-button @click="showPreview = true">
        <el-icon><View /></el-icon>
        {{ $t('serverDetail.instanceConfig.viewMerged') }}
      </el-button>
    </div>

    <!-- Unified configuration form -->
    <div class="config-form space-y-4">
      <!-- Transport Type (from template, read-only) -->
      <div class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ $t('serverDetail.config.transport') }}
        </label>
        <div class="flex items-center gap-2">
          <el-tag size="small" type="info">
            {{ getTransportLabel(templateConfig.type) }}
          </el-tag>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('serverDetail.instanceConfig.fromTemplate') }}
          </span>
        </div>
      </div>

      <!-- Command / URL (from template, read-only) -->
      <div class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{
            templateConfig.type === 'stdio'
              ? $t('serverDetail.config.executable')
              : $t('serverDetail.config.url')
          }}
        </label>
        <div class="flex gap-2 items-start">
          <el-input
            :model-value="
              templateConfig.type === 'stdio' ? templateConfig.command : templateConfig.url
            "
            disabled
            class="flex-1"
          />
          <span class="text-xs text-gray-500 dark:text-gray-400 pt-2 whitespace-nowrap">
            {{ $t('serverDetail.instanceConfig.fromTemplate') }}
          </span>
        </div>
      </div>

      <!-- Arguments (stdio only) -->
      <div v-if="templateConfig.type === 'stdio'" class="pr-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('serverDetail.config.args') }}
          </label>
          <el-button size="small" :icon="Plus" @click="addInstanceArg">
            {{ $t('serverDetail.config.addArg') }}
          </el-button>
        </div>

        <!-- Template args (read-only) -->
        <div v-if="hasTemplateArgs" class="space-y-2 mb-3">
          <div
            v-for="(arg, index) in templateConfig.args"
            :key="`template-arg-${index}`"
            class="flex gap-2 items-start"
          >
            <el-input :model-value="arg" disabled class="flex-1" />
            <span class="text-xs text-gray-500 dark:text-gray-400 pt-2 whitespace-nowrap">
              {{ $t('serverDetail.instanceConfig.fromTemplate') }}
            </span>
          </div>
        </div>

        <!-- Instance args (editable) -->
        <div v-if="localConfig.args && localConfig.args.length > 0" class="space-y-2">
          <div
            v-for="(_, index) in localConfig.args"
            :key="`instance-arg-${index}`"
            class="flex gap-2 items-start"
          >
            <el-input v-model="localConfig.args![index]" class="flex-1" />
            <el-button
              size="small"
              type="danger"
              :icon="Delete"
              @click="removeInstanceArg(index)"
            />
            <el-tag size="small" type="success">
              {{ $t('common.instance') }}
            </el-tag>
          </div>
        </div>
      </div>

      <!-- Environment Variables -->
      <div class="pr-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('serverDetail.config.env') }}
          </label>
          <el-button size="small" :icon="Plus" @click="addInstanceEnv">
            {{ $t('serverDetail.config.addEnv') }}
          </el-button>
        </div>

        <!-- Template env (read-only) -->
        <div v-if="hasTemplateEnv" class="space-y-2 mb-3">
          <div
            v-for="(_, key) in templateConfig.env"
            :key="`template-env-${key}`"
            class="flex gap-2 items-start"
            style="display: flex; gap: 0.5rem; width: 100%"
          >
            <el-input :model-value="key" disabled style="width: 30%; min-width: 150px" />
            <el-input :model-value="templateConfig.env![key]" disabled style="flex: 1" />
            <span class="text-xs text-gray-500 dark:text-gray-400 pt-2 whitespace-nowrap">
              {{ $t('serverDetail.instanceConfig.fromTemplate') }}
            </span>
          </div>
        </div>

        <!-- Instance env (editable) -->
        <div v-if="localConfig.env && Object.keys(localConfig.env).length > 0" class="space-y-2">
          <div
            v-for="(_, key) in localConfig.env"
            :key="`instance-env-${key}`"
            class="flex gap-2 items-start"
            style="display: flex; gap: 0.5rem; width: 100%"
          >
            <el-input
              :model-value="key"
              style="width: 30%; min-width: 150px"
              :placeholder="$t('addServer.keyPlaceholder')"
              @update:model-value="(newKey) => updateInstanceEnvKey(key, newKey as string)"
            />
            <el-input
              v-model="localConfig.env![key]"
              style="flex: 1"
              :placeholder="$t('addServer.valuePlaceholder')"
            />
            <el-button size="small" type="danger" :icon="Delete" @click="removeInstanceEnv(key)" />
            <el-tag size="small" type="success">
              {{ $t('common.instance') }}
            </el-tag>
          </div>
        </div>
      </div>

      <!-- Headers (non-stdio only) -->
      <div v-if="templateConfig.type !== 'stdio'" class="pr-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('serverDetail.config.headers') }}
          </label>
          <el-button size="small" :icon="Plus" @click="addInstanceHeader">
            {{ $t('serverDetail.config.addHeader') }}
          </el-button>
        </div>

        <!-- Template headers (read-only) -->
        <div v-if="hasTemplateHeaders" class="space-y-2 mb-3">
          <div
            v-for="(_, key) in templateConfig.headers"
            :key="`template-header-${key}`"
            class="flex gap-2 items-start"
            style="display: flex; gap: 0.5rem; width: 100%"
          >
            <el-input :model-value="key" disabled style="width: 30%; min-width: 150px" />
            <el-input :model-value="templateConfig.headers![key]" disabled style="flex: 1" />
            <span class="text-xs text-gray-500 dark:text-gray-400 pt-2 whitespace-nowrap">
              {{ $t('serverDetail.instanceConfig.fromTemplate') }}
            </span>
          </div>
        </div>

        <!-- Instance headers (editable) -->
        <div
          v-if="localConfig.headers && Object.keys(localConfig.headers).length > 0"
          class="space-y-2"
        >
          <div
            v-for="(_, key) in localConfig.headers"
            :key="`instance-header-${key}`"
            class="flex gap-2 items-start"
            style="display: flex; gap: 0.5rem; width: 100%"
          >
            <el-input
              :model-value="key"
              style="width: 30%; min-width: 150px"
              :placeholder="$t('addServer.keyPlaceholder')"
              @update:model-value="(newKey) => updateInstanceHeaderKey(key, newKey as string)"
            />
            <el-input
              v-model="localConfig.headers![key]"
              style="flex: 1"
              :placeholder="$t('addServer.valuePlaceholder')"
            />
            <el-button
              size="small"
              type="danger"
              :icon="Delete"
              @click="removeInstanceHeader(key)"
            />
            <el-tag size="small" type="success">
              {{ $t('common.instance') }}
            </el-tag>
          </div>
        </div>
      </div>

      <!-- Timeout (from template, read-only) -->
      <div class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ $t('serverDetail.config.timeout') }}
        </label>
        <div class="flex gap-2 items-center">
          <el-input-number
            :model-value="templateConfig.timeout ? templateConfig.timeout / 1000 : 60"
            disabled
            :min="1"
            :max="3600"
          />
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('serverDetail.instanceConfig.fromTemplate') }}
          </span>
        </div>
      </div>

      <!-- Description (from template, read-only) -->
      <div class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ $t('serverDetail.config.description') }}
        </label>
        <div class="flex gap-2 items-start">
          <el-input
            :model-value="templateConfig.description"
            type="textarea"
            :rows="3"
            disabled
            class="flex-1"
          />
          <span class="text-xs text-gray-500 dark:text-gray-400 pt-2 whitespace-nowrap">
            {{ $t('serverDetail.instanceConfig.fromTemplate') }}
          </span>
        </div>
      </div>

      <!-- Tags (instance only, editable) -->
      <div class="pr-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('serverDetail.config.tags') }}
          </label>
          <el-button size="small" :icon="Plus" @click="addInstanceTag">
            {{ $t('common.addTag') }}
          </el-button>
        </div>

        <!-- Instance tags (editable) -->
        <div v-if="localConfig.tags && Object.keys(localConfig.tags).length > 0" class="space-y-2">
          <div
            v-for="(_, key) in localConfig.tags"
            :key="`instance-tag-${key}`"
            class="flex gap-2 items-start"
            style="display: flex; gap: 0.5rem; width: 100%"
          >
            <el-input
              :model-value="key"
              style="width: 30%; min-width: 150px"
              :placeholder="$t('addServer.keyPlaceholder')"
              @update:model-value="(newKey) => updateInstanceTagKey(key, newKey as string)"
            />
            <el-input
              v-model="localConfig.tags![key]"
              style="flex: 1"
              :placeholder="$t('addServer.valuePlaceholder')"
            />
            <el-button size="small" type="danger" :icon="Delete" @click="removeInstanceTag(key)" />
            <el-tag size="small" type="success">
              {{ $t('common.instance') }}
            </el-tag>
          </div>
        </div>
      </div>

      <!-- Auto-start (instance only, editable) -->
      <div class="pr-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ $t('serverDetail.config.autoStart') }}
        </label>
        <div class="flex gap-2 items-center">
          <el-switch v-model="localConfig.enabled" />
          <el-tag size="small" type="success">
            {{ $t('common.instance') }}
          </el-tag>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 pr-4">
        <el-button type="primary" @click="saveInstanceConfig">
          {{ $t('serverDetail.config.save') }}
        </el-button>
      </div>
    </div>

    <!-- Merged Configuration Preview Dialog -->
    <MergedConfigPreviewDialog v-model="showPreview" :merged-config="mergedConfig" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Delete, Plus, View, Refresh, SwitchButton, VideoPlay } from '@element-plus/icons-vue';
import type { ServerTemplate } from '@shared-models/server.model';
import type { InstanceConfigOverrides } from '@/types/server-detail';
import MergedConfigPreviewDialog from './MergedConfigPreviewDialog.vue';
import { useI18n } from 'vue-i18n';

/**
 * Props interface for InstanceConfig component
 *
 * @interface InstanceConfigProps
 * @property {ServerConfig} templateConfig - The template configuration (read-only)
 * @property {InstanceConfigOverrides} instanceConfig - The instance configuration overrides
 * @property {string} serverName - Name of the server
 * @property {string} instanceStatus - Status of the instance
 */
interface InstanceConfigProps {
  templateConfig: ServerTemplate;
  instanceConfig: InstanceConfigOverrides;
  serverName: string;
  instanceStatus?: string;
}

/**
 * Emits interface for InstanceConfig component
 *
 * @interface InstanceConfigEmits
 * @property {function} update - Emitted when configuration is updated
 * @property {function} start-instance - Emitted when start button is clicked
 * @property {function} stop-instance - Emitted when stop button is clicked
 * @property {function} restart-instance - Emitted when restart button is clicked
 */
interface InstanceConfigEmits {
  (e: 'update', config: Partial<InstanceConfigOverrides>): void;
  (e: 'start-instance'): void;
  (e: 'stop-instance'): void;
  (e: 'restart-instance'): void;
}

const props = withDefaults(defineProps<InstanceConfigProps>(), {
  instanceStatus: 'offline'
});
const emit = defineEmits<InstanceConfigEmits>();
const { t } = useI18n();

/**
 * Handles the start instance button click
 */
function handleStart() {
  emit('start-instance');
}

/**
 * Handles the stop instance button click
 */
function handleStop() {
  emit('stop-instance');
}

/**
 * Handles the restart instance button click
 */
function handleRestart() {
  emit('restart-instance');
}

// Dialog visibility state
const showPreview = ref(false);

// Local state for instance configuration overrides
const localConfig = ref<InstanceConfigOverrides>({
  enabled: true,
  ...props.instanceConfig
});

// Key tracking for dynamic fields
const instanceEnvKeys = ref<Record<string, string>>({});
const instanceHeaderKeys = ref<Record<string, string>>({});
const instanceTagKeys = ref<Record<string, string>>({});

// Computed properties for template field existence
const hasTemplateArgs = computed(() => {
  return props.templateConfig.args && props.templateConfig.args.length > 0;
});

const hasTemplateEnv = computed(() => {
  return props.templateConfig.env && Object.keys(props.templateConfig.env).length > 0;
});

const hasTemplateHeaders = computed(() => {
  return props.templateConfig.headers && Object.keys(props.templateConfig.headers).length > 0;
});

// Initialize keys when props change
watch(
  () => props.instanceConfig,
  (newConfig) => {
    localConfig.value = { ...newConfig };

    // Initialize env keys
    instanceEnvKeys.value = {};
    if (newConfig.env) {
      Object.keys(newConfig.env).forEach((k) => {
        instanceEnvKeys.value[k] = k;
      });
    }

    // Initialize header keys
    instanceHeaderKeys.value = {};
    if (newConfig.headers) {
      Object.keys(newConfig.headers).forEach((k) => {
        instanceHeaderKeys.value[k] = k;
      });
    }

    // Initialize tag keys
    instanceTagKeys.value = {};
    if (newConfig.tags) {
      Object.keys(newConfig.tags).forEach((k) => {
        instanceTagKeys.value[k] = k;
      });
    }
  },
  { immediate: true }
);

/**
 * Computed property that returns the merged configuration
 */
const mergedConfig = computed(() => {
  const merged: Record<string, unknown> = {
    ...props.templateConfig
  };

  // Apply overrides
  if (localConfig.value.args && localConfig.value.args.length > 0) {
    merged.args = [...(props.templateConfig.args || []), ...localConfig.value.args];
  }

  if (localConfig.value.env && Object.keys(localConfig.value.env).length > 0) {
    merged.env = {
      ...(props.templateConfig.env || {}),
      ...localConfig.value.env
    };
  }

  if (localConfig.value.headers && Object.keys(localConfig.value.headers).length > 0) {
    merged.headers = {
      ...(props.templateConfig.headers || {}),
      ...localConfig.value.headers
    };
  }

  if (localConfig.value.tags && Object.keys(localConfig.value.tags).length > 0) {
    merged.tags = localConfig.value.tags;
  }

  if (localConfig.value.displayName) {
    merged.displayName = localConfig.value.displayName;
  }

  if (localConfig.value.enabled !== undefined) {
    merged.enabled = localConfig.value.enabled;
  }

  return merged;
});

/**
 * Gets the translated transport type label
 *
 * @param {string} type - The transport type
 * @returns {string} The translated label
 */
function getTransportLabel(type: string): string {
  switch (type) {
    case 'stdio':
      return t('serverDetail.config.transportStdio');
    case 'sse':
      return t('serverDetail.config.transportSse');
    case 'streamable-http':
      return t('serverDetail.config.transportHttp');
    default:
      return type;
  }
}

/**
 * Saves the instance configuration
 */
function saveInstanceConfig() {
  emit('update', localConfig.value);
}

// Args helpers
function addInstanceArg() {
  if (!localConfig.value.args) {
    localConfig.value.args = [];
  }
  localConfig.value.args.push('');
}

function removeInstanceArg(index: number) {
  if (localConfig.value.args) {
    localConfig.value.args.splice(index, 1);
  }
}

// Env helpers
function addInstanceEnv() {
  if (!localConfig.value.env) {
    localConfig.value.env = {};
  }
  const newKey = `NEW_ENV_${Date.now()}`;
  localConfig.value.env[newKey] = '';
  instanceEnvKeys.value[newKey] = newKey;
}

function removeInstanceEnv(key: string) {
  if (localConfig.value.env) {
    delete localConfig.value.env[key];
    delete instanceEnvKeys.value[key];
  }
}

function updateInstanceEnvKey(oldKey: string, newKey: string) {
  if (!localConfig.value.env || !oldKey || !newKey || oldKey === newKey) return;

  const value = localConfig.value.env[oldKey] ?? '';
  delete localConfig.value.env[oldKey];
  delete instanceEnvKeys.value[oldKey];
  localConfig.value.env[newKey] = value;
  instanceEnvKeys.value[newKey] = newKey;
}

// Headers helpers
function addInstanceHeader() {
  if (!localConfig.value.headers) {
    localConfig.value.headers = {};
  }
  const newKey = `X-New-Header-${Date.now()}`;
  localConfig.value.headers[newKey] = '';
  instanceHeaderKeys.value[newKey] = newKey;
}

function removeInstanceHeader(key: string) {
  if (localConfig.value.headers) {
    delete localConfig.value.headers[key];
    delete instanceHeaderKeys.value[key];
  }
}

function updateInstanceHeaderKey(oldKey: string, newKey: string) {
  if (!localConfig.value.headers || !oldKey || !newKey || oldKey === newKey) return;

  const value = localConfig.value.headers[oldKey] ?? '';
  delete localConfig.value.headers[oldKey];
  delete instanceHeaderKeys.value[oldKey];
  localConfig.value.headers[newKey] = value;
  instanceHeaderKeys.value[newKey] = newKey;
}

// Tags helpers
function addInstanceTag() {
  if (!localConfig.value.tags) {
    localConfig.value.tags = {};
  }
  const newKey = `new-tag-${Date.now()}`;
  localConfig.value.tags[newKey] = '';
  instanceTagKeys.value[newKey] = newKey;
}

function removeInstanceTag(key: string) {
  if (localConfig.value.tags) {
    delete localConfig.value.tags[key];
    delete instanceTagKeys.value[key];
  }
}

function updateInstanceTagKey(oldKey: string, newKey: string) {
  if (!localConfig.value.tags || !oldKey || !newKey || oldKey === newKey) return;

  const value = localConfig.value.tags[oldKey] ?? '';
  delete localConfig.value.tags[oldKey];
  delete instanceTagKeys.value[oldKey];
  localConfig.value.tags[newKey] = value;
  instanceTagKeys.value[newKey] = newKey;
}
</script>

<style scoped>
.instance-config {
  @apply w-full;
}

.config-form {
  @apply w-full;
}
</style>
