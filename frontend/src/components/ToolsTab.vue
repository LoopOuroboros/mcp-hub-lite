<template>
  <div class="h-full flex flex-col">
    <div class="flex h-full gap-4">
      <div class="w-1/3 border-r border-gray-200 dark:border-gray-700 pr-4 overflow-y-auto">
        <h3 class="font-bold mb-4">{{ $t('serverDetail.tools.available') }}</h3>
        <div v-if="tools && tools.length > 0" class="space-y-2">
          <div
            v-for="tool in tools"
            :key="tool.name"
            class="p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
            :class="
              selectedTool?.name === tool.name
                ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
            "
            @click="handleSelectTool(tool)"
          >
            <div class="min-w-0 flex-1 mr-2">
              <div class="font-medium truncate">{{ tool.name }}</div>
            </div>
            <el-switch
              :model-value="isToolAllowed(tool.name)"
              @update:model-value="
                (val: string | number | boolean) =>
                  handleUpdateToolVisibility(tool.name, Boolean(val))
              "
              class="mr-4"
              :active-text="$t('serverDetail.tools.aggregated')"
            />
          </div>
        </div>
        <div v-else class="text-gray-500 text-sm italic">
          {{ $t('serverDetail.tools.none') }}
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto px-4 flex flex-col">
        <div class="flex justify-between items-center mb-4 shrink-0">
          <h3 class="font-bold">
            {{ $t('serverDetail.tools.details') }}: {{ selectedTool?.name || '' }}
          </h3>
          <el-button v-if="selectedTool" type="primary" size="small" @click="handleCallTool">
            {{ $t('serverDetail.tools.call') }}
          </el-button>
        </div>
        <div v-if="selectedTool">
          <p class="mb-4 text-gray-600 dark:text-gray-300">{{ selectedTool.description }}</p>

          <h4 class="font-medium mb-2">{{ $t('serverDetail.tools.schema') }}</h4>
          <pre
            class="bg-gray-50 dark:bg-[#0f172a] p-4 rounded-lg overflow-x-auto text-sm font-mono border border-gray-200 dark:border-gray-700"
            >{{ JSON.stringify(selectedTool.inputSchema, null, 2) }}</pre
          >
        </div>
        <div v-else class="flex-1 flex items-center justify-center text-gray-400">
          {{ $t('serverDetail.tools.selectHint') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Tool } from '@shared-models/tool.model';

interface Props {
  tools: Tool[];
  allowedTools?: string[] | null;
}

const props = withDefaults(defineProps<Props>(), {
  allowedTools: null
});

const emit = defineEmits<{
  (e: 'select-tool', tool: Tool): void;
  (e: 'update-tool-visibility', toolName: string, enabled: boolean): void;
  (e: 'call-tool', tool: Tool): void;
}>();

useI18n();
const selectedTool = ref<Tool | null>(null);

function handleSelectTool(tool: Tool) {
  selectedTool.value = tool;
  emit('select-tool', tool);
}

function isToolAllowed(toolName: string): boolean {
  if (
    props.allowedTools === undefined ||
    props.allowedTools === null ||
    props.allowedTools.length === 0
  ) {
    return false;
  }
  if (Array.isArray(props.allowedTools)) {
    return props.allowedTools.includes(toolName);
  }
  return false;
}

function handleUpdateToolVisibility(toolName: string, enabled: boolean) {
  emit('update-tool-visibility', toolName, enabled);
}

function handleCallTool() {
  if (selectedTool.value) {
    emit('call-tool', selectedTool.value);
  }
}
</script>
