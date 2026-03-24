<!--
  MergedConfigPreviewDialog Component

  Displays the merged final configuration in a modal dialog.
  Shows the combined template configuration and instance overrides
  in a readable JSON format with copy functionality.

  Features:
  - Modal dialog with configurable size
  - Formatted JSON display with syntax highlighting
  - One-click copy to clipboard
  - Responsive layout

  Props:
  - modelValue: Controls dialog visibility
  - mergedConfig: The merged configuration object to display

  Emits:
  - update:modelValue: Emitted when dialog visibility changes
-->
<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="$t('serverDetail.instanceConfig.mergedPreview')"
    width="70%"
    destroy-on-close
    class="merged-config-dialog"
  >
    <div class="preview-content">
      <div class="action-bar flex justify-end mb-4">
        <el-button type="primary" @click="copyToClipboard">
          <el-icon><DocumentCopy /></el-icon>
          {{ $t('common.copy') }}
        </el-button>
      </div>
      <div class="config-display">
        <pre class="config-json">{{ formattedJson }}</pre>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DocumentCopy } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';

/**
 * Props interface for MergedConfigPreviewDialog component
 *
 * @interface MergedConfigPreviewDialogProps
 * @property {boolean} modelValue - Controls dialog visibility
 * @property {Record<string, unknown>} mergedConfig - The merged configuration to display
 */
interface MergedConfigPreviewDialogProps {
  modelValue: boolean;
  mergedConfig: Record<string, unknown>;
}

/**
 * Emits interface for MergedConfigPreviewDialog component
 *
 * @interface MergedConfigPreviewDialogEmits
 * @property {function} update:modelValue - Emitted when dialog visibility changes
 */
interface MergedConfigPreviewDialogEmits {
  (e: 'update:modelValue', value: boolean): void;
}

const props = defineProps<MergedConfigPreviewDialogProps>();
defineEmits<MergedConfigPreviewDialogEmits>();

const { t } = useI18n();

/**
 * Formatted JSON string for display
 */
const formattedJson = computed(() => {
  return JSON.stringify(props.mergedConfig, null, 2);
});

/**
 * Copies the formatted JSON to clipboard
 */
async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(formattedJson.value);
    ElMessage.success(t('action.copiedToClipboard'));
  } catch {
    ElMessage.error(t('action.copyFailed'));
  }
}
</script>

<style scoped>
.merged-config-dialog :deep(.el-dialog__body) {
  padding: 1rem 1.5rem;
}

.preview-content {
  @apply w-full;
}

.config-display {
  @apply bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700;
  @apply max-h-[60vh] overflow-auto;
}

.config-json {
  @apply text-sm font-mono text-gray-700 dark:text-gray-300;
  @apply whitespace-pre-wrap break-all;
  @apply m-0;
}
</style>
