<template>
  <div class="h-full w-full overflow-y-auto">
    <div class="p-6">
      <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ $t('settings.title') }}</h1>
      <el-button type="primary" @click="saveConfig" :loading="saving">
        <el-icon class="mr-1"><Check /></el-icon>
        {{ $t('settings.save') }}
      </el-button>
    </div>

    <div v-loading="loading" class="space-y-6 pb-10">
      <!-- Logging Settings -->
      <el-card shadow="never" class="border-gray-200 dark:border-gray-700 dark:bg-gray-800">
        <template #header>
          <div class="flex items-center gap-2 font-medium text-lg text-gray-900 dark:text-white">
            <el-icon><Document /></el-icon>
            {{ $t('settings.logging') }}
          </div>
        </template>
        
        <el-form :model="config.logging" label-position="top" v-if="config.logging">
          <el-form-item :label="$t('settings.logLevel')">
            <el-select v-model="config.logging.level" class="w-full md:w-64">
              <el-option label="DEBUG" value="debug" />
              <el-option label="INFO" value="info" />
              <el-option label="WARN" value="warn" />
              <el-option label="ERROR" value="error" />
            </el-select>
          </el-form-item>
          
          <el-divider content-position="left">{{ $t('settings.logRotation') }}</el-divider>
          
          <el-form-item>
            <el-checkbox v-model="config.logging.rotation.enabled">{{ $t('settings.enableRotation') }}</el-checkbox>
          </el-form-item>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6" v-if="config.logging.rotation.enabled">
            <el-form-item :label="$t('settings.maxAge')">
              <el-input-number v-model="maxAgeDays" :min="1" class="w-full" />
            </el-form-item>
            <el-form-item :label="$t('settings.maxSize')">
              <el-input v-model="maxSizeValue" type="number" class="w-full">
                <template #append>
                  <el-select v-model="maxSizeUnit" style="width: 80px">
                    <el-option label="KB" value="KB" />
                    <el-option label="MB" value="MB" />
                    <el-option label="GB" value="GB" />
                  </el-select>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item :label="$t('settings.compress')" class="flex flex-col">
               <div class="h-8 flex items-center">
                 <el-switch v-model="config.logging.rotation.compress" />
               </div>
            </el-form-item>
          </div>
        </el-form>
      </el-card>

      <!-- Security Settings -->
      <el-card shadow="never" class="border-gray-200 dark:border-gray-700 dark:bg-gray-800">
        <template #header>
          <div class="flex items-center gap-2 font-medium text-lg text-gray-900 dark:text-white">
            <el-icon><Lock /></el-icon>
            {{ $t('settings.security') }}
          </div>
        </template>
        
        <el-form :model="config.security" label-position="top" v-if="config.security">
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

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             <el-form-item :label="$t('settings.maxConcurrentConnections')">
                <el-input-number v-model="config.security.maxConcurrentConnections" :min="1" :max="1000" class="w-full" />
             </el-form-item>
             <el-form-item :label="$t('settings.maxConnections')">
                <el-input-number v-model="config.security.maxConnections" :min="1" :max="1000" class="w-full" />
             </el-form-item>
             <el-form-item :label="$t('settings.connectionTimeout') + ' (ms)'">
                <el-input-number v-model="config.security.connectionTimeout" :min="1000" :step="1000" class="w-full" />
             </el-form-item>
             <el-form-item :label="$t('settings.idleConnectionTimeout') + ' (ms)'">
                <el-input-number v-model="config.security.idleConnectionTimeout" :min="1000" :step="1000" class="w-full" />
             </el-form-item>
          </div>
        </el-form>
      </el-card>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Check, Document, Lock } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { http } from '../utils/http';

const { t } = useI18n();
const loading = ref(true);
const saving = ref(false);

interface Config {
  logging: {
    level: string;
    rotation: {
      enabled: boolean;
      maxAge: string;
      maxSize: string;
      compress: boolean;
    };
  };
  security: {
    allowedNetworks: string[];
    maxConcurrentConnections: number;
    connectionTimeout: number;
    idleConnectionTimeout: number;
    maxConnections: number;
  };
  // other fields are preserved but not edited here
  [key: string]: any;
}

const config = ref<Config>({
  logging: {
    level: 'info',
    rotation: {
      enabled: true,
      maxAge: '7d',
      maxSize: '100MB',
      compress: false
    }
  },
  security: {
    allowedNetworks: [],
    maxConcurrentConnections: 50,
    connectionTimeout: 30000,
    idleConnectionTimeout: 300000,
    maxConnections: 50
  }
});

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
 
  onMounted(async () => {
  await fetchConfig();
});

async function fetchConfig() {
  loading.value = true;
  try {
    const data = await http.get<Config>('/web/config');
    config.value = data;
  } catch (error: any) {
    ElMessage.error(t('settings.fetchError') + ': ' + error.message);
  } finally {
    loading.value = false;
  }
}

async function saveConfig() {
  saving.value = true;
  try {
    await http.put('/web/config', config.value);
    ElMessage.success(t('settings.saveSuccess'));
  } catch (error: any) {
    ElMessage.error(t('settings.saveError') + ': ' + error.message);
  } finally {
    saving.value = false;
  }
}
</script>
