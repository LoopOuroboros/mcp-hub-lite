<template>
  <el-tag :type="badgeType" :title="tooltipText">
    {{ badgeText }}
  </el-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  connected?: boolean;
  error?: string;
  enabled?: boolean;
}

const props = defineProps<Props>();
const { t } = useI18n();

const badgeType = computed(() => {
  if (props.error) return 'danger';
  if (props.connected) return 'success';
  if (props.enabled !== undefined) {
    return props.enabled ? 'success' : 'danger';
  }
  return 'info';
});

const badgeText = computed(() => {
  if (props.error) return t('server.error');
  if (props.connected !== undefined) {
    return props.connected ? t('server.connected') : t('server.disconnected');
  }
  if (props.enabled !== undefined) {
    return props.enabled ? t('server.enabled') : t('server.disabled');
  }
  return '';
});

const tooltipText = computed(() => props.error || '');
</script>
