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

                  <el-form-item :label="$t('settings.gatewayDebug')">
                    <el-switch v-model="config.system.logging.gatewayDebug" />
                  </el-form-item>

                  <el-form-item :label="$t('settings.showTraceContext')">
                    <el-switch v-model="config.system.logging.showTraceContext" />
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

          <!-- Startup Settings -->
          <el-tab-pane name="startup">
            <template #label>
              <span class="flex items-center gap-2">
                <el-icon><Promotion /></el-icon>
                <span>{{ $t('settings.startupTab') }}</span>
              </span>
            </template>

            <div class="pt-4">
              <el-form
                :model="config.system"
                label-position="left"
                label-width="260px"
                v-if="config.system"
              >
                <!-- Startup Delay -->
                <div class="flex items-center gap-4">
                  <span class="w-[260px] text-sm font-medium text-gray-700 dark:text-gray-300">{{
                    $t('settings.startupDelay')
                  }}</span>
                  <div class="flex items-center gap-2">
                    <el-input-number
                      v-model="startupDelayValue"
                      style="width: 128px; flex-shrink: 0"
                    />
                    <el-select v-model="startupDelayUnit" style="width: 128px; flex-shrink: 0">
                      <el-option :label="$t('settings.timeUnits.seconds')" value="seconds" />
                      <el-option :label="$t('settings.timeUnits.minutes')" value="minutes" />
                    </el-select>
                  </div>
                </div>

                <!-- Ready Timeout -->
                <div class="flex items-center gap-4 mt-4">
                  <span class="w-[260px] text-sm font-medium text-gray-700 dark:text-gray-300">{{
                    $t('settings.readyTimeout')
                  }}</span>
                  <div class="flex items-center gap-2">
                    <el-input-number
                      v-model="readyTimeoutValue"
                      style="width: 128px; flex-shrink: 0"
                    />
                    <el-select v-model="readyTimeoutUnit" style="width: 128px; flex-shrink: 0">
                      <el-option :label="$t('settings.timeUnits.seconds')" value="seconds" />
                      <el-option :label="$t('settings.timeUnits.minutes')" value="minutes" />
                    </el-select>
                  </div>
                </div>

                <!-- Max Connect Retries -->
                <div class="flex items-center gap-4 mt-4">
                  <span class="w-[260px] text-sm font-medium text-gray-700 dark:text-gray-300">{{
                    $t('settings.maxConnectRetries')
                  }}</span>
                  <el-input-number
                    v-model="maxConnectRetries"
                    :min="0"
                    :max="10"
                    style="width: 128px; flex-shrink: 0"
                  />
                </div>

                <!-- Connect Retry Delay -->
                <div class="flex items-center gap-4 mt-4">
                  <span class="w-[260px] text-sm font-medium text-gray-700 dark:text-gray-300">{{
                    $t('settings.connectRetryDelay')
                  }}</span>
                  <div class="flex items-center gap-2">
                    <el-input-number
                      v-model="connectRetryDelayValue"
                      style="width: 128px; flex-shrink: 0"
                    />
                    <el-select v-model="connectRetryDelayUnit" style="width: 128px; flex-shrink: 0">
                      <el-option :label="$t('settings.timeUnits.seconds')" value="seconds" />
                      <el-option :label="$t('settings.timeUnits.minutes')" value="minutes" />
                    </el-select>
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

          <!-- Gateway Settings -->
          <el-tab-pane name="gateway">
            <template #label>
              <span class="flex items-center gap-2">
                <el-icon><Connection /></el-icon>
                <span>{{ $t('settings.sessionTab') }}</span>
              </span>
            </template>

            <div class="pt-4">
              <el-form
                :model="config.system.session"
                label-position="left"
                label-width="260px"
                v-if="config.system.session"
              >
                <el-form-item :label="$t('settings.sessionDefaultSessionMode')">
                  <el-radio-group v-model="config.system.session.defaultSessionMode">
                    <el-radio value="stateful">{{ $t('settings.sessionStateful') }}</el-radio>
                    <el-radio value="stateless">{{ $t('settings.sessionStateless') }}</el-radio>
                  </el-radio-group>
                </el-form-item>

                <div class="flex items-center my-4">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100 mr-4">{{
                    $t('settings.sessionPatternRules')
                  }}</span>
                  <div class="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                </div>

                <!-- Stateful UA Patterns -->
                <div class="mb-6">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ $t('settings.sessionStatefulPatterns') }}
                    </h4>
                    <el-button size="small" @click="addPattern('stateful')">
                      ＋ {{ $t('action.add') }}
                    </el-button>
                  </div>
                  <div class="flex items-center gap-2 mb-2">
                    <el-input
                      v-model="statefulInput"
                      placeholder="claude-code"
                      class="flex-1"
                      size="small"
                      @keyup.enter="addPattern('stateful')"
                    />
                  </div>
                  <div
                    class="border border-gray-200 dark:border-gray-700 rounded p-2 min-h-[36px] max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-800"
                  >
                    <template v-if="statefulPatterns.length === 0">
                      <span class="text-gray-400 text-sm">{{
                        $t('settings.sessionNoPatterns')
                      }}</span>
                    </template>
                    <el-tag
                      v-for="pattern in statefulPatterns"
                      :key="pattern"
                      closable
                      size="default"
                      class="mr-1 mb-1"
                      @close="removePattern('stateful', pattern)"
                    >
                      {{ pattern }}
                    </el-tag>
                  </div>
                </div>

                <!-- Stateless UA Patterns -->
                <div class="mb-2">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ $t('settings.sessionStatelessPatterns') }}
                    </h4>
                    <el-button size="small" @click="addPattern('stateless')">
                      ＋ {{ $t('action.add') }}
                    </el-button>
                  </div>
                  <div class="flex items-center gap-2 mb-2">
                    <el-input
                      v-model="statelessInput"
                      placeholder="cherrystudio"
                      class="flex-1"
                      size="small"
                      @keyup.enter="addPattern('stateless')"
                    />
                  </div>
                  <div
                    class="border border-gray-200 dark:border-gray-700 rounded p-2 min-h-[36px] max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-800"
                  >
                    <template v-if="statelessPatterns.length === 0">
                      <span class="text-gray-400 text-sm">{{
                        $t('settings.sessionNoPatterns')
                      }}</span>
                    </template>
                    <el-tag
                      v-for="pattern in statelessPatterns"
                      :key="pattern"
                      closable
                      size="default"
                      class="mr-1 mb-1"
                      @close="removePattern('stateless', pattern)"
                    >
                      {{ pattern }}
                    </el-tag>
                  </div>
                  <div class="text-xs text-gray-500 mt-1">
                    {{ $t('settings.sessionPatternsHint') }}
                  </div>
                </div>
              </el-form>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Check,
  Connection,
  Document,
  Lock,
  Setting,
  Sunny,
  Moon,
  Monitor,
  PriceTag,
  Promotion
} from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { useSystemStore } from '@stores/system';
import { storeToRefs } from 'pinia';
import TagManager from '@components/TagManager.vue';
import { type TimeUnit, unitFactors, getOptimalUnit } from '@frontend-types/time';
import { useUnitConversionWatcher } from '@composables/use-unit-conversion';

const { t } = useI18n();
const systemStore = useSystemStore();
const { config, loading } = storeToRefs(systemStore);
const saving = ref(false);
const activeTab = ref('system');

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

// Startup configuration computed properties
// Startup delay (0-60000ms, display as seconds or minutes)
const startupDelayUnit = ref<TimeUnit>('seconds');
const startupDelayValue = computed({
  get: () => {
    const ms = config.value?.system?.startup?.startupDelay ?? 3000;
    const seconds = ms / 1000;
    return Math.round(seconds / unitFactors[startupDelayUnit.value]);
  },
  set: (val: number | undefined | null) => {
    if (!config.value.system) {
      return;
    }
    if (!config.value.system.startup) {
      config.value.system.startup = {
        startupDelay: 3000,
        readyTimeout: 120000,
        maxConnectRetries: 3,
        connectRetryDelay: 5000
      };
    }
    if (val !== undefined && val !== null) {
      const ms = val * unitFactors[startupDelayUnit.value] * 1000;
      // Clamp to valid range: 0-60000ms
      const clampedMs = Math.max(0, Math.min(60000, ms));
      config.value.system.startup.startupDelay = clampedMs;
    }
  }
});

// Ready timeout (10000-300000ms, display as seconds or minutes)
const readyTimeoutUnit = ref<TimeUnit>('seconds');
const readyTimeoutValue = computed({
  get: () => {
    const ms = config.value?.system?.startup?.readyTimeout ?? 120000;
    const seconds = ms / 1000;
    return Math.round(seconds / unitFactors[readyTimeoutUnit.value]);
  },
  set: (val: number | undefined | null) => {
    if (!config.value.system?.startup) {
      return;
    }
    if (val !== undefined && val !== null) {
      const ms = val * unitFactors[readyTimeoutUnit.value] * 1000;
      // Clamp to valid range: 10000-300000ms
      const clampedMs = Math.max(10000, Math.min(300000, ms));
      config.value.system.startup.readyTimeout = clampedMs;
    }
  }
});

// Max connect retries (just a number)
const maxConnectRetries = computed({
  get: () => config.value?.system?.startup?.maxConnectRetries ?? 3,
  set: (val: number) => {
    if (!config.value.system?.startup) {
      return;
    }
    config.value.system.startup.maxConnectRetries = val;
  }
});

// Connect retry delay (1000-30000ms, display as seconds or minutes)
const connectRetryDelayUnit = ref<TimeUnit>('seconds');
const connectRetryDelayValue = computed({
  get: () => {
    const ms = config.value?.system?.startup?.connectRetryDelay ?? 5000;
    const seconds = ms / 1000;
    return Math.round(seconds / unitFactors[connectRetryDelayUnit.value]);
  },
  set: (val: number | undefined | null) => {
    if (!config.value.system?.startup) {
      return;
    }
    if (val !== undefined && val !== null) {
      const ms = val * unitFactors[connectRetryDelayUnit.value] * 1000;
      // Clamp to valid range: 1000-30000ms
      const clampedMs = Math.max(1000, Math.min(30000, ms));
      config.value.system.startup.connectRetryDelay = clampedMs;
    }
  }
});

// Automatically convert values when unit changes
useUnitConversionWatcher(connectionTimeoutUnit, connectionTimeoutValue);
useUnitConversionWatcher(idleConnectionTimeoutUnit, idleConnectionTimeoutValue);
useUnitConversionWatcher(startupDelayUnit, startupDelayValue);
useUnitConversionWatcher(readyTimeoutUnit, readyTimeoutValue);
useUnitConversionWatcher(connectRetryDelayUnit, connectRetryDelayValue);

// Session pattern inputs
const statefulInput = ref('');
const statelessInput = ref('');

const statefulPatterns = computed({
  get: () => config.value?.system?.session?.sessionModeRules?.stateful ?? [],
  set: (val: string[]) => {
    if (config.value?.system?.session?.sessionModeRules) {
      config.value.system.session.sessionModeRules.stateful = val;
    }
  }
});

const statelessPatterns = computed({
  get: () => config.value?.system?.session?.sessionModeRules?.stateless ?? [],
  set: (val: string[]) => {
    if (config.value?.system?.session?.sessionModeRules) {
      config.value.system.session.sessionModeRules.stateless = val;
    }
  }
});

function ensureSessionModeRules() {
  if (!config.value?.system?.session) {
    config.value.system.session = {
      sessionModeRules: { stateful: [], stateless: [] },
      defaultSessionMode: 'stateful'
    };
  }
  if (!config.value.system.session?.sessionModeRules) {
    config.value.system.session.sessionModeRules = { stateful: [], stateless: [] };
  }
  if (!config.value.system.session?.sessionModeRules?.stateful) {
    config.value.system.session.sessionModeRules.stateful = [];
  }
  if (!config.value.system.session?.sessionModeRules?.stateless) {
    config.value.system.session.sessionModeRules.stateless = [];
  }
}

function addPattern(type: 'stateful' | 'stateless') {
  const input = type === 'stateful' ? statefulInput : statelessInput;
  const val = input.value.trim();
  if (!val) return;
  ensureSessionModeRules();
  const list = type === 'stateful' ? statefulPatterns : statelessPatterns;
  const current = list.value;
  if (!current.includes(val)) {
    list.value = [...current, val];
  }
  input.value = '';
}

async function removePattern(type: 'stateful' | 'stateless', pattern: string) {
  try {
    await ElMessageBox.confirm(
      t('settings.sessionPatternDeleteConfirm', { pattern }),
      t('settings.sessionPatternDeleteTitle'),
      {
        confirmButtonText: t('action.confirm'),
        cancelButtonText: t('action.cancel'),
        type: 'warning'
      }
    );
    ensureSessionModeRules();
    const list = type === 'stateful' ? statefulPatterns : statelessPatterns;
    list.value = list.value.filter((p) => p !== pattern);
  } catch {
    // user cancelled
  }
}

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

  // Initialize startup time units
  if (config.value?.system?.startup) {
    startupDelayUnit.value = getOptimalUnit(
      (config.value.system.startup.startupDelay || 3000) / 1000
    );
    readyTimeoutUnit.value = getOptimalUnit(
      (config.value.system.startup.readyTimeout || 120000) / 1000
    );
    connectRetryDelayUnit.value = getOptimalUnit(
      (config.value.system.startup.connectRetryDelay || 5000) / 1000
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
