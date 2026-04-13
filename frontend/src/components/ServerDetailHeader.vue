<template>
  <div class="flex items-center justify-between shrink-0">
    <div class="flex items-center gap-4">
      <el-button :icon="ArrowLeft" plain @click="handleBack" class="shrink-0">
        {{ $t('action.back') }}
      </el-button>
      <div class="flex flex-col items-start gap-2">
        <div class="flex items-center gap-2">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ server.name }}</h2>
          <el-tag v-if="server.version" size="small" class="ml-2">
            {{ server.version }}
          </el-tag>
        </div>
        <ServerStatusTags :server="server" />
      </div>
    </div>
    <div class="flex gap-2">
      <template v-if="offlineInstanceCount > 0">
        <el-button type="success" :icon="VideoPlay" @click="handleStartAll">
          {{ $t('action.startAll') }} ({{ offlineInstanceCount }})
        </el-button>
      </template>
      <template v-if="onlineInstanceCount > 0">
        <el-button type="primary" :icon="Refresh" @click="handleRestartAll">
          {{ $t('action.restartAll') }} ({{ totalInstanceCount }})
        </el-button>
      </template>
      <template v-if="onlineInstanceCount > 0">
        <el-button type="warning" :icon="VideoPause" @click="handleStopAll">
          {{ $t('action.stopAll') }} ({{ onlineInstanceCount }})
        </el-button>
      </template>
      <el-button type="danger" :icon="Delete" @click="handleDelete">
        {{ $t('action.deleteServer') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Delete, Refresh, VideoPlay, VideoPause } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import ServerStatusTags from '@components/ServerStatusTags.vue';
import type { Server } from '@shared-models/server.model';

interface Props {
  server: Server;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'delete'): void;
  (e: 'restart-all'): void;
  (e: 'start-all'): void;
  (e: 'stop-all'): void;
}>();

useI18n();

// Compute instance counts
const configuredInstanceCount = computed(() => {
  if (props.server.rawV11Config?.instances?.length) {
    return props.server.rawV11Config.instances.length;
  }
  if (props.server.instances?.length) {
    return props.server.instances.length;
  }
  return 1;
});

const totalInstanceCount = computed(() => configuredInstanceCount.value);

const onlineInstanceCount = computed(() => {
  if (props.server.instances?.length) {
    return props.server.instances.filter((instance) => instance.status === 'online').length;
  }
  return props.server.status === 'online' ? 1 : 0;
});

const offlineInstanceCount = computed(() => {
  if (props.server.instances?.length) {
    return props.server.instances.filter((instance) => instance.status !== 'online').length;
  }
  if (configuredInstanceCount.value > 1) {
    return configuredInstanceCount.value - onlineInstanceCount.value;
  }
  return props.server.status !== 'online' ? 1 : 0;
});

function handleBack() {
  emit('back');
}

function handleDelete() {
  emit('delete');
}

function handleRestartAll() {
  emit('restart-all');
}

function handleStartAll() {
  emit('start-all');
}

function handleStopAll() {
  emit('stop-all');
}
</script>
