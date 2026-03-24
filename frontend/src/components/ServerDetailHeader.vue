<template>
  <div class="flex items-center justify-between shrink-0">
    <div class="flex items-center gap-4">
      <el-button :icon="ArrowLeft" plain @click="handleBack" class="shrink-0">
        {{ $t('action.back') }}
      </el-button>
      <div class="flex flex-col items-start gap-2">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ server.name }}</h2>
        <ServerStatusTags
          :server="server"
          :include-uptime="true"
          :formatted-uptime="formattedUptime"
        />
      </div>
    </div>
    <div class="flex gap-2">
      <el-button :icon="Refresh" plain @click="handleRestart">{{ $t('action.restart') }}</el-button>
      <el-button
        v-if="server.status === 'online'"
        type="warning"
        plain
        :icon="SwitchButton"
        @click="handleStop"
        >{{ $t('action.stop') }}</el-button
      >
      <el-button v-else type="success" :icon="VideoPlay" @click="handleStart">{{
        $t('action.start')
      }}</el-button>
      <el-button type="danger" :icon="Delete" @click="handleDelete">{{
        $t('action.delete')
      }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Refresh, SwitchButton, VideoPlay, Delete } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import ServerStatusTags from '@components/ServerStatusTags.vue';
import type { Server } from '@shared-models/server.model';

interface Props {
  server: Server;
  formattedUptime: string;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'restart'): void;
  (e: 'start'): void;
  (e: 'stop'): void;
  (e: 'delete'): void;
}>();

useI18n();

function handleBack() {
  emit('back');
}

function handleRestart() {
  emit('restart');
}

function handleStart() {
  emit('start');
}

function handleStop() {
  emit('stop');
}

function handleDelete() {
  emit('delete');
}
</script>
