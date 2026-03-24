<template>
  <el-dialog v-model="localModelValue" :title="title" width="600px">
    <el-input v-model="jsonConfig" type="textarea" :rows="15" font-family="monospace" />
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleCancel">{{ $t('action.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave">{{ $t('action.save') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import type { ServerRuntimeConfig } from '@shared-models/server.model';

interface Props {
  modelValue: boolean;
  config: ServerRuntimeConfig;
  serverName: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', config: ServerRuntimeConfig): void;
}>();

const { t } = useI18n();
const jsonConfig = ref('');
const localModelValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const title = computed(() => t('serverDetail.editJsonTitle') || 'Edit JSON Config');

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      initializeJsonConfig();
    }
  }
);

function initializeJsonConfig() {
  const configObj: Record<string, unknown> = {
    env: props.config.env || {},
    enabled: props.config.enabled,
    description: props.config.description
  };

  if (props.config.headers && Object.keys(props.config.headers).length > 0) {
    configObj.headers = props.config.headers;
  }

  if (props.config.timeout) {
    configObj.timeout = props.config.timeout;
  }

  if (props.config.type === 'stdio') {
    configObj.command = props.config.command;
    configObj.args = props.config.args || [];
  } else {
    configObj.url = props.config.url;
  }

  const fullConfig = {
    mcpServers: {
      [props.serverName]: configObj
    }
  };

  jsonConfig.value = JSON.stringify(fullConfig, null, 2);
}

function handleCancel() {
  localModelValue.value = false;
}

function handleSave() {
  try {
    const parsed = JSON.parse(jsonConfig.value);
    if (!parsed.mcpServers) throw new Error('Missing mcpServers key');

    const names = Object.keys(parsed.mcpServers);
    if (names.length === 0) throw new Error('No server config found');

    const name = names[0] || '';
    const newConfig = parsed.mcpServers[name];

    const updatedConfig = { ...props.config };

    if (newConfig.command) {
      updatedConfig.type = 'stdio';
      updatedConfig.command = newConfig.command;
      updatedConfig.args = newConfig.args || [];
      delete (updatedConfig as Record<string, unknown>).url;
    } else if (newConfig.url) {
      updatedConfig.type = newConfig.type === 'sse' ? 'sse' : 'streamable-http';
      updatedConfig.url = newConfig.url;
      delete (updatedConfig as Record<string, unknown>).command;
      delete (updatedConfig as Record<string, unknown>).args;
    }

    if (newConfig.env) {
      updatedConfig.env = newConfig.env;
    }

    if (newConfig.headers) {
      updatedConfig.headers = newConfig.headers;
    }

    if (newConfig.timeout !== undefined) {
      updatedConfig.timeout = newConfig.timeout;
    }

    if (newConfig.enabled !== undefined) {
      updatedConfig.enabled = newConfig.enabled;
    }

    if (newConfig.description !== undefined) {
      updatedConfig.description = newConfig.description;
    }

    emit('save', updatedConfig);
    localModelValue.value = false;
    ElMessage.success(t('action.configSaved'));
  } catch (e: unknown) {
    if (e instanceof Error) {
      ElMessage.error('Invalid JSON: ' + e.message);
    } else {
      ElMessage.error('Invalid JSON: ' + String(e));
    }
  }
}
</script>
