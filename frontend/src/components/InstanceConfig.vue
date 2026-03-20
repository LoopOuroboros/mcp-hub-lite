<!--
  InstanceConfig Component

  Displays both template configuration (read-only) and instance configuration override (editable)
  in a side-by-side layout. The template configuration is shown on the left with a gray,
  disabled appearance to indicate it cannot be edited directly. The instance configuration
  override is shown on the right and can be edited.

  Features:
  - Side-by-side comparison of template and instance configurations
  - Template configuration is read-only with grayed-out styling
  - Instance configuration override is fully editable
  - Highlights fields that differ from the template
  - Shows merged final configuration preview

  This component helps users understand the relationship between template and instance configurations.
-->
<template>
  <div class="instance-config">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
      {{ $t('serverDetail.instanceConfig.title') }}
    </h3>

    <!-- Two-column layout -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left: Template Configuration (Read-only) -->
      <div class="template-config">
        <div class="flex items-center gap-2 mb-4">
          <h4 class="text-md font-medium text-gray-700 dark:text-gray-300">
            {{ $t('serverDetail.instanceConfig.template') }}
          </h4>
          <el-tag size="small" type="info">
            {{ $t('serverDetail.instanceConfig.readOnly') }}
          </el-tag>
        </div>

        <div
          class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
          <el-form label-position="top" class="template-form">
            <!-- Transport -->
            <el-form-item :label="$t('serverDetail.config.transport')">
              <el-select :model-value="templateConfig.type" disabled class="w-full">
                <el-option :label="$t('serverDetail.config.transportStdio')" value="stdio" />
                <el-option :label="$t('serverDetail.config.transportSse')" value="sse" />
                <el-option
                  :label="$t('serverDetail.config.transportHttp')"
                  value="streamable-http"
                />
              </el-select>
            </el-form-item>

            <!-- Stdio specific fields -->
            <template v-if="templateConfig.type === 'stdio'">
              <el-form-item :label="$t('serverDetail.config.executable')">
                <el-input :model-value="templateConfig.command" disabled />
              </el-form-item>
              <el-form-item :label="$t('serverDetail.config.args')">
                <div class="w-full flex flex-col gap-2">
                  <div
                    v-for="(_, index) in templateConfig.args"
                    :key="index"
                    class="flex gap-2 w-full"
                  >
                    <el-input :model-value="templateConfig.args?.[index]" disabled />
                  </div>
                  <div
                    v-if="!templateConfig.args || templateConfig.args.length === 0"
                    class="text-gray-400 text-sm italic"
                  >
                    {{ $t('serverDetail.instanceConfig.noArgs') }}
                  </div>
                </div>
              </el-form-item>
            </template>

            <!-- Remote specific fields -->
            <template v-else>
              <el-form-item :label="$t('serverDetail.config.url')">
                <el-input :model-value="templateConfig.url" disabled />
              </el-form-item>
            </template>

            <!-- Timeout -->
            <el-form-item :label="$t('serverDetail.config.timeout')">
              <el-input-number
                :model-value="templateConfig.timeout ? templateConfig.timeout / 1000 : 60"
                disabled
                :min="0"
                :step="1"
              />
            </el-form-item>

            <!-- Description -->
            <el-form-item :label="$t('serverDetail.config.description')">
              <el-input
                :model-value="templateConfig.description"
                type="textarea"
                :rows="3"
                disabled
              />
            </el-form-item>

            <!-- Auto-start -->
            <el-form-item :label="$t('serverDetail.config.autoStart')">
              <el-switch :model-value="templateConfig.enabled" disabled />
            </el-form-item>

            <!-- Environment Variables -->
            <el-form-item :label="$t('serverDetail.config.env')">
              <div class="w-full flex flex-col gap-2">
                <div v-for="(_, key) in templateConfig.env" :key="key" class="flex gap-2 w-full">
                  <el-input :model-value="key" disabled style="width: 30%; min-width: 150px" />
                  <el-input :model-value="templateConfig.env?.[key]" disabled style="flex: 1" />
                </div>
                <div
                  v-if="!templateConfig.env || Object.keys(templateConfig.env).length === 0"
                  class="text-gray-400 text-sm italic"
                >
                  {{ $t('serverDetail.instanceConfig.noEnv') }}
                </div>
              </div>
            </el-form-item>

            <!-- Headers (for remote types) -->
            <template v-if="templateConfig.type !== 'stdio'">
              <el-form-item :label="$t('serverDetail.config.headers')">
                <div class="w-full flex flex-col gap-2">
                  <div
                    v-for="(_, key) in templateConfig.headers"
                    :key="key"
                    class="flex gap-2 w-full"
                  >
                    <el-input :model-value="key" disabled style="width: 30%; min-width: 150px" />
                    <el-input
                      :model-value="templateConfig.headers?.[key]"
                      disabled
                      style="flex: 1"
                    />
                  </div>
                  <div
                    v-if="
                      !templateConfig.headers || Object.keys(templateConfig.headers).length === 0
                    "
                    class="text-gray-400 text-sm italic"
                  >
                    {{ $t('serverDetail.instanceConfig.noHeaders') }}
                  </div>
                </div>
              </el-form-item>
            </template>

            <!-- Tags -->
            <el-form-item :label="$t('serverDetail.config.tags')">
              <div class="w-full flex flex-col gap-2">
                <div v-for="(_, key) in templateConfig.tags" :key="key" class="flex gap-2 w-full">
                  <el-input :model-value="key" disabled style="width: 30%; min-width: 150px" />
                  <el-input :model-value="templateConfig.tags?.[key]" disabled style="flex: 1" />
                </div>
                <div
                  v-if="!templateConfig.tags || Object.keys(templateConfig.tags).length === 0"
                  class="text-gray-400 text-sm italic"
                >
                  {{ $t('serverDetail.instanceConfig.noTags') }}
                </div>
              </div>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <!-- Right: Instance Configuration Override (Editable) -->
      <div class="instance-config-override">
        <div class="flex items-center gap-2 mb-4">
          <h4 class="text-md font-medium text-gray-700 dark:text-gray-300">
            {{ $t('serverDetail.instanceConfig.override') }}
          </h4>
          <el-tag size="small" type="success">
            {{ $t('serverDetail.instanceConfig.editable') }}
          </el-tag>
        </div>

        <div
          class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
          <el-form label-position="top" class="override-form">
            <!-- Args Override -->
            <el-form-item
              :label="$t('serverDetail.config.args')"
              :class="{ 'field-diff': hasDiff('args') }"
            >
              <div class="w-full flex flex-col gap-2">
                <div
                  v-for="(_, index) in instanceConfigOverrides.args || []"
                  :key="index"
                  class="flex gap-2 w-full"
                >
                  <el-input v-model="instanceConfigOverrides.args![index]" />
                  <el-button :icon="Delete" circle plain @click="removeOverrideArg(index)" />
                </div>
                <div>
                  <el-button :icon="Plus" plain size="small" @click="addOverrideArg"
                    >+ {{ $t('serverDetail.config.addArg') }}</el-button
                  >
                </div>
              </div>
            </el-form-item>

            <!-- Env Override -->
            <el-form-item
              :label="$t('serverDetail.config.env')"
              :class="{ 'field-diff': hasDiff('env') }"
            >
              <div class="w-full flex flex-col gap-2">
                <div
                  v-for="(_, key) in instanceConfigOverrides.env || {}"
                  :key="key"
                  class="flex gap-2 w-full"
                >
                  <el-input
                    v-model="overrideEnvKeys[key as string]"
                    :placeholder="$t('addServer.keyPlaceholder')"
                    style="width: 30%; min-width: 150px"
                    @change="(val: string) => updateOverrideEnvKey(key as string, val)"
                  />
                  <el-input
                    v-model="instanceConfigOverrides.env![key]"
                    :placeholder="$t('addServer.valuePlaceholder')"
                    style="flex: 1"
                  />
                  <el-button
                    :icon="Delete"
                    circle
                    plain
                    @click="removeOverrideEnv(key as string)"
                  />
                </div>
                <div>
                  <el-button :icon="Plus" plain size="small" @click="addOverrideEnv"
                    >+ {{ $t('serverDetail.config.addEnv') }}</el-button
                  >
                </div>
              </div>
            </el-form-item>

            <!-- Headers Override (for remote types) -->
            <template v-if="templateConfig.type !== 'stdio'">
              <el-form-item
                :label="$t('serverDetail.config.headers')"
                :class="{ 'field-diff': hasDiff('headers') }"
              >
                <div class="w-full flex flex-col gap-2">
                  <div
                    v-for="(_, key) in instanceConfigOverrides.headers || {}"
                    :key="key"
                    class="flex gap-2 w-full"
                  >
                    <el-input
                      v-model="overrideHeaderKeys[key as string]"
                      :placeholder="$t('addServer.keyPlaceholder')"
                      style="width: 30%; min-width: 150px"
                      @change="(val: string) => updateOverrideHeaderKey(key as string, val)"
                    />
                    <el-input
                      v-model="instanceConfigOverrides.headers![key]"
                      :placeholder="$t('addServer.valuePlaceholder')"
                      style="flex: 1"
                    />
                    <el-button
                      :icon="Delete"
                      circle
                      plain
                      @click="removeOverrideHeader(key as string)"
                    />
                  </div>
                  <div>
                    <el-button :icon="Plus" plain size="small" @click="addOverrideHeader"
                      >+ {{ $t('serverDetail.config.addHeader') }}</el-button
                    >
                  </div>
                </div>
              </el-form-item>
            </template>

            <!-- Tags Override -->
            <el-form-item
              :label="$t('serverDetail.config.tags')"
              :class="{ 'field-diff': hasDiff('tags') }"
            >
              <div class="w-full flex flex-col gap-2">
                <div
                  v-for="(_, key) in instanceConfigOverrides.tags || {}"
                  :key="key"
                  class="flex gap-2 w-full"
                >
                  <el-input
                    v-model="overrideTagKeys[key as string]"
                    :placeholder="$t('addServer.keyPlaceholder')"
                    style="width: 30%; min-width: 150px"
                    @change="(val: string) => updateOverrideTagKey(key as string, val)"
                  />
                  <el-input
                    v-model="instanceConfigOverrides.tags![key]"
                    :placeholder="$t('addServer.valuePlaceholder')"
                    style="flex: 1"
                  />
                  <el-button
                    :icon="Delete"
                    circle
                    plain
                    @click="removeOverrideTag(key as string)"
                  />
                </div>
                <div>
                  <el-button :icon="Plus" plain size="small" @click="addOverrideTag"
                    >+ {{ $t('serverDetail.instanceConfig.addTag') }}</el-button
                  >
                </div>
              </div>
            </el-form-item>

            <!-- Save Button -->
            <div class="flex gap-2">
              <el-button type="primary" class="mt-4" @click="saveOverrideConfig">
                {{ $t('serverDetail.config.save') }}
              </el-button>
            </div>
          </el-form>
        </div>
      </div>
    </div>

    <!-- Merged Final Configuration Preview -->
    <div class="mt-6">
      <h4 class="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
        {{ $t('serverDetail.instanceConfig.mergedPreview') }}
      </h4>
      <div
        class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800"
      >
        <pre class="text-sm font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">{{
          JSON.stringify(mergedConfig, null, 2)
        }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Delete, Plus } from '@element-plus/icons-vue';
import type { ServerConfig } from '@shared-models/server.model';

/**
 * Instance configuration override interface
 */
interface InstanceConfigOverrides {
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  displayName?: string;
}

/**
 * Props interface for InstanceConfig component
 *
 * @interface InstanceConfigProps
 * @property {ServerConfig} templateConfig - The template configuration (read-only)
 * @property {InstanceConfigOverrides} instanceConfig - The instance configuration overrides
 * @property {string} serverName - Name of the server
 */
interface InstanceConfigProps {
  templateConfig: ServerConfig;
  instanceConfig: InstanceConfigOverrides;
  serverName: string;
}

/**
 * Emits interface for InstanceConfig component
 *
 * @interface InstanceConfigEmits
 * @property {function} update - Emitted when configuration is updated
 */
interface InstanceConfigEmits {
  (e: 'update', config: Partial<InstanceConfigOverrides>): void;
}

const props = defineProps<InstanceConfigProps>();
const emit = defineEmits<InstanceConfigEmits>();

// Local state for instance configuration overrides
const instanceConfigOverrides = ref<InstanceConfigOverrides>({
  ...props.instanceConfig
});

// Key tracking for dynamic fields
const overrideEnvKeys = ref<Record<string, string>>({});
const overrideHeaderKeys = ref<Record<string, string>>({});
const overrideTagKeys = ref<Record<string, string>>({});

// Initialize keys when props change
watch(
  () => props.instanceConfig,
  (newConfig) => {
    instanceConfigOverrides.value = { ...newConfig };

    // Initialize env keys
    overrideEnvKeys.value = {};
    if (newConfig.env) {
      Object.keys(newConfig.env).forEach((k) => {
        overrideEnvKeys.value[k] = k;
      });
    }

    // Initialize header keys
    overrideHeaderKeys.value = {};
    if (newConfig.headers) {
      Object.keys(newConfig.headers).forEach((k) => {
        overrideHeaderKeys.value[k] = k;
      });
    }

    // Initialize tag keys
    overrideTagKeys.value = {};
    if (newConfig.tags) {
      Object.keys(newConfig.tags).forEach((k) => {
        overrideTagKeys.value[k] = k;
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
  if (instanceConfigOverrides.value.args && instanceConfigOverrides.value.args.length > 0) {
    merged.args = instanceConfigOverrides.value.args;
  }

  if (
    instanceConfigOverrides.value.env &&
    Object.keys(instanceConfigOverrides.value.env).length > 0
  ) {
    merged.env = {
      ...(props.templateConfig.env || {}),
      ...instanceConfigOverrides.value.env
    };
  }

  if (
    instanceConfigOverrides.value.headers &&
    Object.keys(instanceConfigOverrides.value.headers).length > 0
  ) {
    merged.headers = {
      ...(props.templateConfig.headers || {}),
      ...instanceConfigOverrides.value.headers
    };
  }

  if (
    instanceConfigOverrides.value.tags &&
    Object.keys(instanceConfigOverrides.value.tags).length > 0
  ) {
    merged.tags = {
      ...(props.templateConfig.tags || {}),
      ...instanceConfigOverrides.value.tags
    };
  }

  if (instanceConfigOverrides.value.displayName) {
    merged.displayName = instanceConfigOverrides.value.displayName;
  }

  return merged;
});

/**
 * Checks if a field has differences from the template
 *
 * @param {string} field - The field to check
 * @returns {boolean} True if the field has differences
 */
function hasDiff(field: string): boolean {
  switch (field) {
    case 'args':
      return !!(
        instanceConfigOverrides.value.args &&
        instanceConfigOverrides.value.args.length > 0 &&
        JSON.stringify(instanceConfigOverrides.value.args) !==
          JSON.stringify(props.templateConfig.args || [])
      );
    case 'env':
      return !!(
        instanceConfigOverrides.value.env &&
        Object.keys(instanceConfigOverrides.value.env).length > 0
      );
    case 'headers':
      return !!(
        instanceConfigOverrides.value.headers &&
        Object.keys(instanceConfigOverrides.value.headers).length > 0
      );
    case 'tags':
      return !!(
        instanceConfigOverrides.value.tags &&
        Object.keys(instanceConfigOverrides.value.tags).length > 0
      );
    default:
      return false;
  }
}

/**
 * Saves the override configuration
 */
function saveOverrideConfig() {
  emit('update', instanceConfigOverrides.value);
}

// Args helpers
function addOverrideArg() {
  if (!instanceConfigOverrides.value.args) {
    instanceConfigOverrides.value.args = [];
  }
  instanceConfigOverrides.value.args.push('');
}

function removeOverrideArg(index: number) {
  if (instanceConfigOverrides.value.args) {
    instanceConfigOverrides.value.args.splice(index, 1);
  }
}

// Env helpers
function addOverrideEnv() {
  if (!instanceConfigOverrides.value.env) {
    instanceConfigOverrides.value.env = {};
  }
  const newKey = `NEW_ENV_${Date.now()}`;
  instanceConfigOverrides.value.env[newKey] = '';
  overrideEnvKeys.value[newKey] = newKey;
}

function removeOverrideEnv(key: string) {
  if (instanceConfigOverrides.value.env) {
    delete instanceConfigOverrides.value.env[key];
    delete overrideEnvKeys.value[key];
  }
}

function updateOverrideEnvKey(oldKey: string, newKey: string) {
  if (!instanceConfigOverrides.value.env || !oldKey || !newKey || oldKey === newKey) return;

  const value = instanceConfigOverrides.value.env[oldKey] ?? '';
  delete instanceConfigOverrides.value.env[oldKey];
  delete overrideEnvKeys.value[oldKey];
  instanceConfigOverrides.value.env[newKey] = value;
  overrideEnvKeys.value[newKey] = newKey;
}

// Headers helpers
function addOverrideHeader() {
  if (!instanceConfigOverrides.value.headers) {
    instanceConfigOverrides.value.headers = {};
  }
  const newKey = `X-New-Header-${Date.now()}`;
  instanceConfigOverrides.value.headers[newKey] = '';
  overrideHeaderKeys.value[newKey] = newKey;
}

function removeOverrideHeader(key: string) {
  if (instanceConfigOverrides.value.headers) {
    delete instanceConfigOverrides.value.headers[key];
    delete overrideHeaderKeys.value[key];
  }
}

function updateOverrideHeaderKey(oldKey: string, newKey: string) {
  if (!instanceConfigOverrides.value.headers || !oldKey || !newKey || oldKey === newKey) return;

  const value = instanceConfigOverrides.value.headers[oldKey] ?? '';
  delete instanceConfigOverrides.value.headers[oldKey];
  delete overrideHeaderKeys.value[oldKey];
  instanceConfigOverrides.value.headers[newKey] = value;
  overrideHeaderKeys.value[newKey] = newKey;
}

// Tags helpers
function addOverrideTag() {
  if (!instanceConfigOverrides.value.tags) {
    instanceConfigOverrides.value.tags = {};
  }
  const newKey = `new-tag-${Date.now()}`;
  instanceConfigOverrides.value.tags[newKey] = '';
  overrideTagKeys.value[newKey] = newKey;
}

function removeOverrideTag(key: string) {
  if (instanceConfigOverrides.value.tags) {
    delete instanceConfigOverrides.value.tags[key];
    delete overrideTagKeys.value[key];
  }
}

function updateOverrideTagKey(oldKey: string, newKey: string) {
  if (!instanceConfigOverrides.value.tags || !oldKey || !newKey || oldKey === newKey) return;

  const value = instanceConfigOverrides.value.tags[oldKey] ?? '';
  delete instanceConfigOverrides.value.tags[oldKey];
  delete overrideTagKeys.value[oldKey];
  instanceConfigOverrides.value.tags[newKey] = value;
  overrideTagKeys.value[newKey] = newKey;
}
</script>

<style scoped>
.instance-config {
  @apply w-full;
}

.template-form .el-input__wrapper,
.template-form .el-select__wrapper,
.template-form .el-input-number__wrapper {
  @apply bg-gray-100 dark:bg-gray-700;
}

.field-diff {
  @apply border-l-4 border-yellow-400 pl-2;
}

.field-diff .el-form-item__label {
  @apply text-yellow-600 dark:text-yellow-400 font-semibold;
}
</style>
