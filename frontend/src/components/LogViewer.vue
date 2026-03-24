<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between gap-2 mb-2 shrink-0">
      <div class="flex items-center gap-2">
        <el-checkbox
          v-model="localAutoScroll"
          :label="$t('serverDetail.logs.autoScroll')"
          class="text-gray-600 dark:text-gray-400"
          @update:model-value="handleAutoScrollChange"
        />
        <el-button size="small" :icon="Delete" plain @click="handleClear">{{
          $t('serverDetail.logs.clear')
        }}</el-button>
        <el-button size="small" :icon="CopyDocument" plain @click="handleCopy">{{
          $t('serverDetail.logs.copy')
        }}</el-button>
      </div>
    </div>
    <div
      class="bg-gray-900 dark:bg-black p-4 rounded-lg font-mono text-sm flex-1 min-h-0 overflow-y-auto text-gray-300"
      ref="logsContainer"
    >
      <div v-for="(log, index) in logs" :key="index" class="mb-1 break-words">
        <span :class="getLogLevelColor(log.level)">
          {{ formatTimestamp(log.timestamp) }} [{{ log.level.toUpperCase() }}]
          {{ log.message }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { Delete, CopyDocument } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import type { CheckboxValueType } from 'element-plus';

interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
}

interface Props {
  logs: LogEntry[];
  autoScroll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoScroll: true
});

const emit = defineEmits<{
  (e: 'update:autoScroll', value: boolean): void;
  (e: 'clear'): void;
  (e: 'copy'): void;
}>();

useI18n();
const logsContainer = ref<HTMLElement | null>(null);
const localAutoScroll = ref(props.autoScroll);

watch(
  () => props.autoScroll,
  (newVal) => {
    localAutoScroll.value = newVal;
  }
);

watch(
  () => props.logs.length,
  () => {
    if (localAutoScroll.value) {
      nextTick(() => {
        if (logsContainer.value) {
          logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
        }
      });
    }
  }
);

function handleAutoScrollChange(val: CheckboxValueType) {
  const value = Boolean(val);
  localAutoScroll.value = value;
  emit('update:autoScroll', value);
}

function handleClear() {
  emit('clear');
}

function handleCopy() {
  emit('copy');
}

function getLogLevelColor(level: string) {
  switch (level) {
    case 'debug':
      return 'text-gray-400';
    case 'info':
      return 'text-blue-400';
    case 'warn':
      return 'text-yellow-400';
    case 'error':
      return 'text-red-400';
    default:
      return 'text-gray-300';
  }
}

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}
</script>
