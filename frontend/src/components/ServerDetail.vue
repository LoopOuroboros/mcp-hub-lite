<template>
  <div
    v-if="server"
    class="server-detail py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden transition-colors duration-300"
  >
    <!-- Header -->
    <ServerDetailHeader
      :server="server"
      :all-server-instances="allServers"
      @back="navigateBack"
      @delete="deleteServer"
      @restart-all="restartAllInstances"
      @start-all="startAllInstances"
      @stop-all="stopAllInstances"
    />

    <!-- Top Level Tabs -->
    <el-tabs
      :model-value="activeTopTab"
      @tab-change="(tab) => navigateToTab(tab as string)"
      class="flex-1 flex flex-col overflow-hidden custom-tabs"
    >
      <!-- Config Tab (Unified: Template + Instances) -->
      <el-tab-pane name="config" class="h-full flex flex-col">
        <template #label>
          <span class="custom-tabs-label">
            <el-icon><Setting /></el-icon>
            <span>{{ $t('common.config') }} ({{ serverInstances.length }})</span>
          </span>
        </template>
        <div class="flex h-full gap-4 mt-4">
          <!-- Left: Template + Instance Card List -->
          <div class="w-1/3 border-r border-gray-200 dark:border-gray-700 pr-4 overflow-y-auto">
            <InstanceCardList
              :instances="serverInstances"
              :selected-index="selectedInstanceIndex"
              :server-name="server.name"
              :show-template-node="true"
              :template-selected="selectedInstanceIndex === null"
              @select="handleSelectInstance"
              @select-template="handleSelectTemplate"
              @add="handleAddInstance"
              @update-display-name="handleUpdateDisplayName"
              @delete="handleDeleteInstance"
              @reassign-indexes="handleReassignIndexes"
            />
          </div>

          <!-- Right: Config Panel -->
          <div class="flex-1 min-h-0 overflow-y-auto pl-4 pr-4">
            <!-- Template Config Panel -->
            <div v-if="selectedInstanceIndex === null">
              <ConfigTemplateForm
                :config="
                  server.rawV11Config || {
                    template: {
                      type: 'stdio',
                      args: [],
                      env: {},
                      headers: {},
                      timeout: 60000,
                      aggregatedTools: []
                    },
                    instances: [],
                    tagDefinitions: []
                  }
                "
                @update:config="updateLocalConfig"
                @save="saveConfig"
                @edit-json="openEditJson"
              />
            </div>

            <!-- Instance Config Panel -->
            <div v-else-if="selectedInstanceIndex !== null">
              <div class="mb-4">
                <el-tabs v-model="activeInstanceTab" class="instance-detail-tabs">
                  <!-- Instance Config Tab (Unified Form) -->
                  <el-tab-pane name="config">
                    <template #label>
                      <span class="custom-tabs-label">
                        <el-icon><Setting /></el-icon>
                        <span>{{ $t('common.config') }}</span>
                      </span>
                    </template>
                    <InstanceConfig
                      :template-config="templateConfigForInstance"
                      :instance-config="selectedInstanceConfig"
                      :server-name="server.name"
                      :instance-status="getSelectedInstanceStatus()"
                      :system-tag-definitions="systemTagDefinitions"
                      @update="handleUpdateInstanceConfig"
                      @start-instance="startSelectedInstance"
                      @stop-instance="stopSelectedInstance"
                      @restart-instance="restartSelectedInstance"
                    />
                  </el-tab-pane>

                  <!-- Instance Logs Tab -->
                  <el-tab-pane name="logs" class="h-full flex flex-col">
                    <template #label>
                      <span class="custom-tabs-label">
                        <el-icon><Memo /></el-icon>
                        <span>{{ $t('common.logs') }}</span>
                      </span>
                    </template>
                    <LogViewer
                      :logs="server.logs"
                      :auto-scroll="autoScroll"
                      @update:auto-scroll="autoScroll = $event"
                      @clear="clearLogs"
                      @copy="copyLogs"
                    />
                  </el-tab-pane>
                </el-tabs>
              </div>
            </div>

            <!-- No Selection (should not happen with template selected by default) -->
            <div v-else class="flex-1 flex items-center justify-center text-gray-400">
              {{ $t('serverDetail.noSelection') }}
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tools Tab -->
      <el-tab-pane name="tools" class="h-full flex flex-col">
        <template #label>
          <span class="custom-tabs-label">
            <el-icon><Tools /></el-icon>
            <span>{{ $t('common.tools') }} ({{ server.toolsCount || 0 }})</span>
          </span>
        </template>
        <ToolsTab
          :tools="server.tools || []"
          :allowed-tools="server.config.aggregatedTools"
          @select-tool="selectedTool = $event"
          @update-tool-visibility="updateToolVisibility"
          @call-tool="
            (tool) => {
              showInstanceSelectForTool = true;
              pendingTool = tool;
            }
          "
        />
      </el-tab-pane>

      <!-- Resources Tab -->
      <el-tab-pane name="resources" class="h-full flex flex-col">
        <template #label>
          <span class="custom-tabs-label">
            <el-icon><Files /></el-icon>
            <span>{{ $t('common.resources') }} ({{ server.resourcesCount || 0 }})</span>
          </span>
        </template>
        <ResourcesTab
          :resources="server.resources"
          @view-resource="
            (resource) => {
              showInstanceSelectForResource = resource;
            }
          "
        />
      </el-tab-pane>
    </el-tabs>

    <!-- JSON Config Dialog -->
    <JsonConfigEditor
      v-model="showEditJson"
      :config="server.config"
      :server-name="server.name"
      @save="handleSaveJsonConfig"
    />

    <!-- Instance Select Dialog for Tool Call -->
    <InstanceSelectDialog
      v-model="showInstanceSelectForTool"
      :instances="serverInstances"
      :title="$t('serverDetail.selectInstanceForTool')"
      @confirm="callToolWithInstance"
    />

    <!-- Instance Select Dialog for Resource View -->
    <InstanceSelectDialog
      v-model="showInstanceSelectForResourceDialog"
      :instances="serverInstances"
      :title="$t('serverDetail.selectInstanceForResource')"
      @confirm="viewResourceWithInstance"
    />

    <!-- Tool Call Dialog -->
    <ToolCallDialog
      v-if="pendingTool && selectedInstanceForTool !== null"
      v-model="showCallDialog"
      :server-name="server.name"
      :tool-name="pendingTool.name"
      :description="pendingTool.description"
      :input-schema="pendingTool.inputSchema"
    />
  </div>
  <div v-else class="h-full flex items-center justify-center text-gray-400">
    {{ $t('serverDetail.noServerSelected') }}
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useServerStore } from '@stores/server';
import { useWebSocketStore } from '@stores/websocket';
import { useSystemStore } from '@stores/system';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Files, Setting, Tools, Memo } from '@element-plus/icons-vue';

import ServerDetailHeader from '@components/ServerDetailHeader.vue';
import ConfigTemplateForm from '@components/ConfigTemplateForm.vue';
import LogViewer from '@components/LogViewer.vue';
import ToolsTab from '@components/ToolsTab.vue';
import ResourcesTab from '@components/ResourcesTab.vue';
import JsonConfigEditor from '@components/JsonConfigEditor.vue';
import InstanceSelectDialog from '@components/InstanceSelectDialog.vue';
import ToolCallDialog from '@components/ToolCallDialog.vue';
import InstanceCardList from '@components/InstanceCardList.vue';
import InstanceConfig from '@components/InstanceConfig.vue';

import { useServerSelection } from '@/composables/use-server-selection';
import { useServerInstances } from '@/composables/use-server-instances';
import { useToolAndResourceDialogs } from '@/composables/use-tool-and-resource-dialogs';
import { formatTimestamp } from '@/utils/format-utils';

import type { Tool } from '@shared-models/tool.model';
import type { ServerTemplate, ServerRuntimeConfig } from '@shared-models/server.model';

const store = useServerStore();
useWebSocketStore();
const systemStore = useSystemStore();
const { config } = storeToRefs(systemStore);
const { t } = useI18n();
const router = useRouter();

// Computed property for the selected server
const server = computed(() => store.selectedServer);

// System tag definitions
const systemTagDefinitions = computed(() => config.value?.tagDefinitions || []);

// Use composables
const {
  activeTopTab,
  selectedInstanceIndex,
  activeInstanceTab,
  getTabFromRoute,
  navigateToTab,
  handleSelectTemplate,
  handleSelectInstance
} = useServerSelection(server);
// Mark as intentionally unused
void getTabFromRoute;

const {
  serverInstances,
  selectedInstance,
  selectedInstanceConfig,
  templateConfigForInstance,
  allServers,
  getSelectedInstanceStatus,
  getSelectedInstanceServerId,
  startSelectedInstance,
  stopSelectedInstance,
  restartSelectedInstance,
  startAllInstances,
  stopAllInstances,
  restartAllInstances,
  handleAddInstance,
  handleUpdateDisplayName,
  handleDeleteInstance,
  handleReassignIndexes,
  handleUpdateInstanceConfig
} = useServerInstances(server, selectedInstanceIndex);
// Mark as intentionally unused
void selectedInstance;
void getSelectedInstanceServerId;

const {
  showInstanceSelectForTool,
  selectedInstanceForTool,
  showCallDialog,
  pendingTool,
  showInstanceSelectForResourceDialog,
  showInstanceSelectForResource,
  selectedInstanceForResource,
  callToolWithInstance,
  viewResourceWithInstance
} = useToolAndResourceDialogs(server);
// Mark as intentionally unused
void selectedInstanceForResource;

// State
const autoScroll = ref(true);
const showEditJson = ref(false);
const selectedTool = ref<Tool | null>(null);

// Tab switching logic - fetch data when tab changes
watch(
  activeTopTab,
  async (tab) => {
    if (!server.value?.id) return;

    if (tab === 'tools') {
      await store.fetchTools(server.value.id);
    } else if (tab === 'resources') {
      await store.fetchResources(server.value.id);
    }
  },
  { immediate: true }
);

function navigateBack() {
  store.selectedServerId = null;
  router.push({ name: 'servers' });
}

const deleteServer = async () => {
  if (server.value) {
    try {
      await ElMessageBox.confirm(t('serverDetail.deleteConfirm'), t('action.delete'), {
        confirmButtonText: t('action.delete'),
        cancelButtonText: t('action.cancel'),
        type: 'warning'
      });

      await store.deleteServer(server.value.id);
      ElMessage.success(t('action.serverDeleted'));
      store.selectedServerId = null;
      router.push({ name: 'servers' });
    } catch (e: unknown) {
      if (e !== 'cancel') {
        if (e instanceof Error) {
          ElMessage.error(e.message || 'Failed to delete server');
        } else {
          ElMessage.error(String(e) || 'Failed to delete server');
        }
      }
    }
  }
};

const updateToolVisibility = async (toolName: string, enabled: boolean) => {
  if (!server.value) return;

  let currentAggregated = server.value.config.aggregatedTools;

  if (currentAggregated === undefined || currentAggregated === null) {
    if (server.value.tools) {
      currentAggregated = server.value.tools.map((t: Tool) => t.name);
    } else {
      currentAggregated = [];
    }
  }

  if (enabled) {
    if (!currentAggregated.includes(toolName)) {
      currentAggregated = [...currentAggregated, toolName];
    }
  } else {
    currentAggregated = currentAggregated.filter((t: string) => t !== toolName);
  }

  server.value.config.aggregatedTools = currentAggregated;

  try {
    await store.updateServer(server.value.id, {
      config: server.value.config
    });
    ElMessage.success(t('action.configSaved'));
  } catch (e: unknown) {
    if (e instanceof Error) {
      ElMessage.error(e.message);
    } else {
      ElMessage.error(String(e));
    }
  }
};

const saveConfig = async () => {
  if (server.value) {
    try {
      await store.updateServer(server.value.id, {
        config: server.value.rawV11Config?.template
      });
      ElMessage.success(t('action.configSaved'));
    } catch (e: unknown) {
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }
};

const updateLocalConfig = (config: ServerTemplate) => {
  if (server.value?.rawV11Config) {
    server.value.rawV11Config.template = config;
  }
};

const openEditJson = () => {
  showEditJson.value = true;
};

const handleSaveJsonConfig = async (updatedConfig: ServerRuntimeConfig) => {
  if (!server.value) return;

  // For JSON edit, we need to handle this differently - the JsonConfigEditor
  // should be updated to work with v1.1 format, but for now we'll just
  // update the rawV11Config.template
  if (server.value.rawV11Config) {
    // Merge the updated config into the template
    server.value.rawV11Config.template = {
      ...server.value.rawV11Config.template,
      ...updatedConfig
    };
  }

  await store.updateServer(server.value.id, {
    config: server.value.rawV11Config?.template
  });
};

const clearLogs = async () => {
  if (server.value) {
    await store.clearLogs(server.value.id);
    ElMessage.success(t('action.logsCleared'));
  }
};

const copyLogs = () => {
  if (server.value) {
    const logText = server.value.logs
      .map((log) => `${formatTimestamp(log.timestamp)} [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    navigator.clipboard.writeText(logText);
    ElMessage.success(t('action.logsCopied'));
  }
};
</script>

<style scoped>
.custom-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}
.custom-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  padding-top: 1rem;
}

.custom-tabs-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.instance-detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 1rem;
}
</style>
