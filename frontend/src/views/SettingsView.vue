<template>
  <div class="h-full w-full overflow-y-auto">
    <div class="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ $t('settings.title') }}</h1>
        <el-button type="primary" @click="saveConfig" :loading="saving">
          <el-icon class="mr-1"><Check /></el-icon>
          {{ $t('settings.save') }}
        </el-button>
      </div>

      <div v-loading="loading" class="pb-10">
        <el-tabs v-model="activeTab" class="demo-tabs">
          <!-- System Settings -->
          <el-tab-pane name="system">
            <template #label>
              <span class="flex items-center gap-2">
                <el-icon><Setting /></el-icon>
                <span>{{ $t('settings.systemTab') }}</span>
              </span>
            </template>

            <div class="pt-4">
              <el-form :model="config" label-position="left" label-width="260px">
                <div class="flex flex-col gap-2">
                  <el-form-item :label="$t('settings.host')">
                    <el-input v-model="config.system.host" class="w-[200px]" />
                  </el-form-item>
                  <el-form-item :label="$t('settings.port')">
                    <el-input-number
                      v-model="config.system.port"
                      :min="1"
                      :max="65535"
                      class="w-[200px]"
                    />
                  </el-form-item>
                </div>

                <div class="flex items-center my-4">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100 mr-4">{{
                    $t('settings.appearance')
                  }}</span>
                  <div class="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                </div>

                <el-form-item :label="$t('settings.theme')">
                  <el-select v-model="config.system.theme" class="w-[200px]">
                    <el-option :label="$t('settings.themeLight')" value="light">
                      <span class="flex items-center gap-2">
                        <el-icon><Sunny /></el-icon>
                        <span>{{ $t('settings.themeLight') }}</span>
                      </span>
                    </el-option>
                    <el-option :label="$t('settings.themeDark')" value="dark">
                      <span class="flex items-center gap-2">
                        <el-icon><Moon /></el-icon>
                        <span>{{ $t('settings.themeDark') }}</span>
                      </span>
                    </el-option>
                    <el-option :label="$t('settings.themeSystem')" value="system">
                      <span class="flex items-center gap-2">
                        <el-icon><Monitor /></el-icon>
                        <span>{{ $t('settings.themeSystem') }}</span>
                      </span>
                    </el-option>
                  </el-select>
                </el-form-item>

                <el-form-item :label="$t('settings.language')">
                  <el-select v-model="config.system.language" class="w-[200px]">
                    <el-option :label="$t('settings.langEn')" value="en" />
                    <el-option :label="$t('settings.langZh')" value="zh" />
                  </el-select>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>

          <!-- Logging Settings -->
          <el-tab-pane name="logging">
            <template #label>
              <span class="flex items-center gap-2">
                <el-icon><Document /></el-icon>
                <span>{{ $t('settings.logging') }}</span>
              </span>
            </template>

            <div class="pt-4">
              <el-form
                :model="config.system.logging"
                label-position="left"
                label-width="260px"
                v-if="config.system.logging"
              >
                <el-form-item :label="$t('settings.logLevel')">
                  <el-select v-model="config.system.logging.level" class="w-full md:w-64">
                    <el-option label="DEBUG" value="debug" />
                    <el-option label="INFO" value="info" />
                    <el-option label="WARN" value="warn" />
                    <el-option label="ERROR" value="error" />
                  </el-select>
                </el-form-item>

                <el-form-item :label="$t('settings.maxAge')">
                  <el-input-number v-model="maxAgeDays" :min="1" class="w-[150px]" />
                </el-form-item>

                <div class="flex items-center my-4">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100 mr-4">{{
                    $t('settings.debugOptions')
                  }}</span>
                  <div class="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                </div>

                <template v-if="config.system.logging.level === 'debug' || config.isDevMode">
                  <el-form-item :label="$t('settings.jsonPretty')">
                    <el-switch v-model="config.system.logging.jsonPretty" />
                  </el-form-item>

                  <el-form-item :label="$t('settings.mcpCommDebug')">
                    <el-switch v-model="config.system.logging.mcpCommDebug" />
                  </el-form-item>

                  <el-form-item :label="$t('settings.apiDebug')">
                    <el-switch v-model="config.system.logging.apiDebug" />
                  </el-form-item>
                </template>
              </el-form>
            </div>
          </el-tab-pane>

          <!-- Security Settings -->
          <el-tab-pane name="security">
            <template #label>
              <span class="flex items-center gap-2">
                <el-icon><Lock /></el-icon>
                <span>{{ $t('settings.security') }}</span>
              </span>
            </template>

            <div class="pt-4">
              <el-form
                :model="config.security"
                label-position="left"
                label-width="260px"
                v-if="config.security"
              >
                <el-form-item :label="$t('settings.allowedNetworks')">
                  <el-select
                    v-model="config.security.allowedNetworks"
                    multiple
                    filterable
                    allow-create
                    default-first-option
                    :reserve-keyword="false"
                    placeholder="Enter IP CIDR"
                    class="w-full"
                  >
                    <el-option
                      v-for="ip in config.security.allowedNetworks"
                      :key="ip"
                      :label="ip"
                      :value="ip"
                    />
                  </el-select>
                  <div class="text-xs text-gray-500 mt-1">
                    {{ $t('settings.allowedNetworksHint') }}
                  </div>
                </el-form-item>

                <div class="space-y-4">
                  <!-- Maximum concurrent connections -->
                  <div class="flex items-center gap-4">
                    <span class="w-[260px] text-sm font-medium text-gray-700 dark:text-gray-300">{{
                      $t('settings.maxConcurrentConnections')
                    }}</span>
                    <el-input-number
                      v-model="config.security.maxConcurrentConnections"
                      :min="1"
                      :max="1000"
                      style="width: 128px; flex-shrink: 0"
                    />
                  </div>

                  <!-- Maximum connections -->
                  <div class="flex items-center gap-4">
                    <span class="w-[260px] text-sm font-medium text-gray-700 dark:text-gray-300">{{
                      $t('settings.maxConnections')
                    }}</span>
                    <el-input-number
                      v-model="config.security.maxConnections"
                      :min="1"
                      :max="1000"
                      style="width: 128px; flex-shrink: 0"
                    />
                  </div>

                  <!-- Connection timeout -->
                  <div class="flex items-center gap-4">
                    <span class="w-[260px] text-sm font-medium text-gray-700 dark:text-gray-300">{{
                      $t('settings.connectionTimeout')
                    }}</span>
                    <div class="flex items-center gap-2">
                      <el-input-number
                        v-model="connectionTimeoutValue"
                        :min="1"
                        :step="1"
                        style="width: 128px; flex-shrink: 0"
                      />
                      <el-select
                        v-model="connectionTimeoutUnit"
                        style="width: 128px; flex-shrink: 0"
                      >
                        <el-option :label="$t('settings.timeUnits.seconds')" value="seconds" />
                        <el-option :label="$t('settings.timeUnits.minutes')" value="minutes" />
                        <el-option :label="$t('settings.timeUnits.hours')" value="hours" />
                        <el-option :label="$t('settings.timeUnits.days')" value="days" />
                      </el-select>
                    </div>
                  </div>

                  <!-- Idle connection timeout -->
                  <div class="flex items-center gap-4">
                    <span class="w-[260px] text-sm font-medium text-gray-700 dark:text-gray-300">{{
                      $t('settings.idleConnectionTimeout')
                    }}</span>
                    <div class="flex items-center gap-2">
                      <el-input-number
                        v-model="idleConnectionTimeoutValue"
                        :min="1"
                        :step="1"
                        style="width: 128px; flex-shrink: 0"
                      />
                      <el-select
                        v-model="idleConnectionTimeoutUnit"
                        style="width: 128px; flex-shrink: 0"
                      >
                        <el-option :label="$t('settings.timeUnits.seconds')" value="seconds" />
                        <el-option :label="$t('settings.timeUnits.minutes')" value="minutes" />
                        <el-option :label="$t('settings.timeUnits.hours')" value="hours" />
                        <el-option :label="$t('settings.timeUnits.days')" value="days" />
                      </el-select>
                    </div>
                  </div>
                </div>
              </el-form>
            </div>
          </el-tab-pane>

          <!-- Tags Settings -->
          <el-tab-pane name="tags">
            <template #label>
              <span class="flex items-center gap-2">
                <el-icon><PriceTag /></el-icon>
                <span>{{ $t('settings.tagsTab') }}</span>
              </span>
            </template>

            <div class="pt-4">
              <TagManager v-model="config.tagDefinitions" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Check,
  Document,
  Lock,
  Setting,
  Sunny,
  Moon,
  Monitor,
  PriceTag
} from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { useSystemStore } from '@stores/system';
import { storeToRefs } from 'pinia';
import TagManager from '@components/TagManager.vue';

const { t } = useI18n();
const systemStore = useSystemStore();
const { config, loading } = storeToRefs(systemStore);
const saving = ref(false);
const activeTab = ref('system');

// Unit conversion factors
type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';
const unitFactors: Record<TimeUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400
};

// Unit priority (from largest to smallest)
const unitPriority: TimeUnit[] = ['days', 'hours', 'minutes', 'seconds'];

// Automatically select the most appropriate unit based on seconds
const getOptimalUnit = (seconds: number): TimeUnit => {
  for (const unit of unitPriority) {
    const factor = unitFactors[unit];
    // Correct unit selection logic:
    // - Use the unit for values greater than or equal to its complete value
    // - For example: >= 86400 seconds → days
    // -             >= 3600 seconds → hours
    // -             >= 60 seconds → minutes
    // -             < 60 seconds → seconds
    if (seconds >= factor) {
      return unit;
    }
  }
  return 'seconds';
};

const maxAgeDays = computed({
  get: () => {
    const val = config.value?.system?.logging?.rotationAge || '7d';
    const result = parseInt(val.replace(/[^\d]/g, '')) || 7;
    return Number(Math.round(result));
  },
  set: (val: number | undefined | null) => {
    if (config.value?.system?.logging && val !== undefined && val !== null) {
      config.value.system.logging.rotationAge = `${val}d`;
    }
  }
});

// Connection timeout
const connectionTimeoutUnit = ref<TimeUnit>(
  getOptimalUnit((config.value?.security?.connectionTimeout || 30000) / 1000)
);
const connectionTimeoutValue = computed({
  get: () => {
    const ms = config.value?.security?.connectionTimeout || 30000;
    const seconds = ms / 1000;
    // Automatically select the most appropriate unit
    const optimalUnit = getOptimalUnit(seconds);
    const value = seconds / unitFactors[optimalUnit];
    return Number(Math.round(value));
  },
  set: (val: number | undefined | null) => {
    if (config.value?.security && val !== undefined && val !== null) {
      config.value.security.connectionTimeout =
        Number(val) * unitFactors[connectionTimeoutUnit.value] * 1000;
    }
  }
});

// Idle connection timeout
const idleConnectionTimeoutUnit = ref<TimeUnit>(
  getOptimalUnit((config.value?.security?.idleConnectionTimeout || 300000) / 1000)
);
const idleConnectionTimeoutValue = computed({
  get: () => {
    const ms = config.value?.security?.idleConnectionTimeout || 300000;
    const seconds = ms / 1000;
    // Automatically select the most appropriate unit
    const optimalUnit = getOptimalUnit(seconds);
    const value = seconds / unitFactors[optimalUnit];
    return Number(Math.round(value));
  },
  set: (val: number | undefined | null) => {
    if (config.value?.security && val !== undefined && val !== null) {
      config.value.security.idleConnectionTimeout =
        Number(val) * unitFactors[idleConnectionTimeoutUnit.value] * 1000;
    }
  }
});

// Automatically convert values when unit changes
watch(connectionTimeoutUnit, (newUnit, oldUnit) => {
  if (oldUnit && newUnit !== oldUnit) {
    const factor = unitFactors[newUnit] / unitFactors[oldUnit];
    const currentValue = connectionTimeoutValue.value;
    connectionTimeoutValue.value = Math.round(currentValue / factor);
  }
});

watch(idleConnectionTimeoutUnit, (newUnit, oldUnit) => {
  if (oldUnit && newUnit !== oldUnit) {
    const factor = unitFactors[newUnit] / unitFactors[oldUnit];
    const currentValue = idleConnectionTimeoutValue.value;
    idleConnectionTimeoutValue.value = Math.round(currentValue / factor);
  }
});

onMounted(async () => {
  // Config is already fetched by App.vue usually
  if (!config.value.host) {
    await systemStore.fetchConfig();
  }

  // Initialize time units based on actual config values
  if (config.value?.security) {
    connectionTimeoutUnit.value = getOptimalUnit(
      (config.value.security.connectionTimeout || 30000) / 1000
    );
    idleConnectionTimeoutUnit.value = getOptimalUnit(
      (config.value.security.idleConnectionTimeout || 300000) / 1000
    );
  }
});

async function saveConfig() {
  saving.value = true;
  try {
    await systemStore.updateConfig(config.value);
    ElMessage.success(t('settings.saveSuccess'));
  } catch (error: unknown) {
    ElMessage.error(t('settings.saveError') + ': ' + (error as Error).message);
  } finally {
    saving.value = false;
  }
}
</script>
