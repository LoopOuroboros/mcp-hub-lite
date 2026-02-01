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
            <el-form :model="config" label-position="left">
               <div class="flex flex-col gap-2">
                 <el-form-item :label="$t('settings.host')">
                   <el-input v-model="config.system.host" class="w-[200px]" />
                 </el-form-item>
                 <el-form-item :label="$t('settings.port')">
                   <el-input-number v-model="config.system.port" :min="1" :max="65535" class="w-[200px]" />
                 </el-form-item>
               </div>
               
               <div class="flex items-center my-4">
                 <span class="text-sm font-medium text-gray-900 dark:text-gray-100 mr-4">{{ $t('settings.appearance') }}</span>
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
            <el-form :model="config.system.logging" label-position="left" v-if="config.system.logging">
              <el-form-item :label="$t('settings.logLevel')">
                <el-select v-model="config.system.logging.level" class="w-full md:w-64">
                  <el-option label="DEBUG" value="debug" />
                  <el-option label="INFO" value="info" />
                  <el-option label="WARN" value="warn" />
                  <el-option label="ERROR" value="error" />
                </el-select>
              </el-form-item>
              
              <div class="flex items-center my-4">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100 mr-4">{{ $t('settings.logRotation') }}</span>
                <div class="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
              </div>
              
              <el-form-item>
                <el-checkbox v-model="config.system.logging.rotation.enabled">{{ $t('settings.enableRotation') }}</el-checkbox>
              </el-form-item>
              
              <div class="flex flex-col gap-2" v-if="config.system.logging.rotation.enabled">
                <el-form-item :label="$t('settings.maxAge')">
                  <el-input-number v-model="maxAgeDays" :min="1" class="w-[150px]" />
                </el-form-item>
                <el-form-item :label="$t('settings.maxSize')">
                  <el-input v-model="maxSizeValue" type="number" class="w-[240px]">
                    <template #append>
                      <el-select v-model="maxSizeUnit" style="width: 80px">
                        <el-option label="KB" value="KB" />
                        <el-option label="MB" value="MB" />
                        <el-option label="GB" value="GB" />
                      </el-select>
                    </template>
                  </el-input>
                </el-form-item>
                <el-form-item :label="$t('settings.compress')">
                   <div class="h-8 flex items-center">
                     <el-switch v-model="config.system.logging.rotation.compress" />
                   </div>
                </el-form-item>
              </div>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- Observability Settings -->
        <el-tab-pane name="observability">
          <template #label>
            <span class="flex items-center gap-2">
              <el-icon><DataAnalysis /></el-icon>
              <span>{{ $t('settings.observability') }}</span>
            </span>
          </template>

          <div class="pt-4">
            <el-form :model="config.observability" label-position="left" v-if="config.observability">
              <div class="flex items-center my-4">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100 mr-4">{{ $t('settings.tracing') }}</span>
                <div class="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
              </div>

              <el-form-item>
                <el-checkbox v-model="config.observability.tracing.enabled">{{ $t('settings.tracingEnabled') }}</el-checkbox>
              </el-form-item>

              <div class="flex flex-col gap-2" v-if="config.observability.tracing.enabled">
                <el-form-item :label="$t('settings.exporter')">
                  <el-select v-model="config.observability.tracing.exporter" class="w-full md:w-64">
                    <el-option :label="$t('settings.exporterConsole')" value="console" />
                    <el-option :label="$t('settings.exporterOtlp')" value="otlp" />
                    <el-option :label="$t('settings.exporterJaeger')" value="jaeger" />
                    <el-option :label="$t('settings.exporterZipkin')" value="zipkin" />
                  </el-select>
                </el-form-item>

                <el-form-item :label="$t('settings.endpoint')" v-if="config.observability.tracing.exporter !== 'console'">
                  <el-input v-model="config.observability.tracing.endpoint" class="w-full md:w-64" />
                </el-form-item>

                <el-form-item :label="$t('settings.sampleRate')">
                  <el-slider
                    v-model="config.observability.tracing.sampleRate"
                    :min="0"
                    :max="1"
                    :step="0.01"
                    :format-tooltip="formatSampleRate"
                    class="w-full md:w-64"
                  />
                </el-form-item>
              </div>
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
            <el-form :model="config.security" label-position="left" v-if="config.security">
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
                 <div class="text-xs text-gray-500 mt-1">{{ $t('settings.allowedNetworksHint') }}</div>
              </el-form-item>

              <div class="flex flex-col gap-2">
                <el-form-item :label="$t('settings.maxConcurrentConnections')">
                   <el-input-number v-model="config.security.maxConcurrentConnections" :min="1" :max="1000" class="w-[150px]" />
                </el-form-item>
                <el-form-item :label="$t('settings.maxConnections')">
                   <el-input-number v-model="config.security.maxConnections" :min="1" :max="1000" class="w-[150px]" />
                </el-form-item>
                <el-form-item :label="$t('settings.connectionTimeout') + ' (s)'">
                   <el-input-number v-model="connectionTimeoutSeconds" :min="1" :step="1" class="w-[150px]" />
                </el-form-item>
                <el-form-item :label="$t('settings.idleConnectionTimeout') + ' (s)'">
                   <el-input-number v-model="idleConnectionTimeoutSeconds" :min="1" :step="1" class="w-[150px]" />
                </el-form-item>
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
import { ref, onMounted, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Check, Document, Lock, Setting, Sunny, Moon, Monitor, DataAnalysis } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '@composables/useTheme';
import { useSystemStore } from '@stores/system';
import { storeToRefs } from 'pinia';

const { t, locale } = useI18n();
const { theme, setTheme } = useTheme();
const systemStore = useSystemStore();
const { config, loading } = storeToRefs(systemStore);
const saving = ref(false);
const activeTab = ref('system');

const maxAgeDays = computed({
    get: () => {
      const val = config.value?.logging?.rotation?.maxAge || '7d';
      return parseInt(val.replace(/[^\d]/g, '')) || 7;
    },
    set: (val: number | undefined | null) => {
      if (config.value?.logging?.rotation && val) {
        config.value.logging.rotation.maxAge = `${val}d`;
      }
    }
  });

  const maxSizeValue = computed({
    get: () => {
      const val = config.value?.logging?.rotation?.maxSize || '100MB';
      const match = val.match(/^(\d+(\.\d+)?)/);
      return match ? Number(match[1]) : 100;
    },
    set: (val: string | number) => {
      const currentUnit = maxSizeUnit.value;
      if (config.value?.logging?.rotation) {
        config.value.logging.rotation.maxSize = `${val}${currentUnit}`;
      }
    }
  });

  const maxSizeUnit = computed({
    get: () => {
      const val = config.value?.logging?.rotation?.maxSize || '100MB';
      const match = val.match(/([a-zA-Z]+)$/);
      return (match && match[1]) ? match[1].toUpperCase() : 'MB';
    },
    set: (val: string) => {
      const currentValue = maxSizeValue.value;
      if (config.value?.logging?.rotation) {
        config.value.logging.rotation.maxSize = `${currentValue}${val}`;
      }
    }
  });

  const connectionTimeoutSeconds = computed({
    get: () => {
      return (config.value?.security?.connectionTimeout || 30000) / 1000;
    },
    set: (val: number | undefined | null) => {
      if (config.value?.security && val) {
        config.value.security.connectionTimeout = val * 1000;
      }
    }
  });

  const idleConnectionTimeoutSeconds = computed({
    get: () => {
      return (config.value?.security?.idleConnectionTimeout || 300000) / 1000;
    },
    set: (val: number | undefined | null) => {
      if (config.value?.security && val) {
        config.value.security.idleConnectionTimeout = val * 1000;
      }
    }
  });

  // Format sample rate for slider tooltip
  const formatSampleRate = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  onMounted(async () => {
  // Config is already fetched by App.vue usually
  if (!config.value.host) {
    await systemStore.fetchConfig();
  }
});

async function saveConfig() {
  saving.value = true;
  try {
    await systemStore.updateConfig(config.value);
    ElMessage.success(t('settings.saveSuccess'));
  } catch (error: any) {
    ElMessage.error(t('settings.saveError') + ': ' + error.message);
  } finally {
    saving.value = false;
  }
}
</script>
