<template>
  <el-dialog v-model="localModelValue" :title="title" width="500px">
    <el-select
      v-model="selectedInstance"
      :placeholder="$t('serverDetail.selectInstancePlaceholder')"
      class="w-full"
    >
      <el-option
        v-for="inst in instances"
        :key="inst.index ?? 0"
        :label="getInstanceSelectLabel(inst)"
        :value="inst.index ?? 0"
      />
    </el-select>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleCancel">{{ $t('action.cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm" :disabled="selectedInstance === null">
          {{ $t('action.confirm') }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ServerInstanceConfig } from '@shared-models/server.model';

interface Props {
  modelValue: boolean;
  instances: ServerInstanceConfig[];
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: ''
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm', instanceIndex: number): void;
}>();

const { t } = useI18n();
const selectedInstance = ref<number | null>(null);

const localModelValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const title = computed(
  () => props.title || t('serverDetail.selectInstanceTitle') || 'Select Instance'
);

function getInstanceSelectLabel(inst: ServerInstanceConfig): string {
  return `#${inst.index ?? 0} [${inst.displayName || t('serverDetail.instances.unnamed')}]`;
}

function handleCancel() {
  localModelValue.value = false;
  selectedInstance.value = null;
}

function handleConfirm() {
  if (selectedInstance.value !== null) {
    emit('confirm', selectedInstance.value);
    localModelValue.value = false;
    selectedInstance.value = null;
  }
}
</script>
