<template>
  <div
    v-if="server"
    class="server-detail py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden transition-colors duration-300"
  >
    <!-- Header -->
    <ServerDetailHeader
      :server="server"
      :formatted-uptime="formattedUptime"
      @back="navigateBack"
      @restart="restartServer"
      @start="startServer"
      @stop="stopServer"
      @delete="deleteServer"
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
            <span>{{ $t('serverDetail.tabs.config') }}</span>
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
                  server.rawV11Config?.template || {
                    type: 'stdio',
                    args: [],
                    env: {},
                    headers: {},
                    timeout: 60000,
                    aggregatedTools: []
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
                        <span>{{ $t('serverDetail.instanceTabs.config') }}</span>
                      </span>
                    </template>
                    <InstanceConfig
                      :template-config="templateConfigForInstance"
                      :instance-config="selectedInstanceConfig"
                      :server-name="server.name"
                      @update="handleUpdateInstanceConfig"
                    />
                  </el-tab-pane>

                  <!-- Instance Logs Tab -->
                  <el-tab-pane name="logs" class="h-full flex flex-col">
                    <template #label>
                      <span class="custom-tabs-label">
                        <el-icon><Memo /></el-icon>
                        <span>{{ $t('serverDetail.instanceTabs.logs') }}</span>
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
            <span>{{ $t('serverDetail.tabs.tools') }} ({{ server.toolsCount || 0 }})</span>
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
            <span>{{ $t('serverDetail.tabs.resources') }} ({{ server.resourcesCount || 0 }})</span>
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
import { ref, computed, watch, onMounted, onUnmounted, onBeforeMount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useServerStore } from '@stores/server';
import { useWebSocketStore } from '@stores/websocket';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { formatUptime } from '@utils/format-utils';
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

import type { Resource } from '@shared-models/resource.model';
import type { Tool } from '@shared-models/tool.model';
import type {
  ServerInstanceConfig,
  ServerInstance,
  ServerTemplate,
  ServerRuntimeConfig
} from '@shared-models/server.model';

const store = useServerStore();
useWebSocketStore();
const { t } = useI18n();
const router = useRouter();
const route = useRoute();

/**
 * Instance configuration override interface
 */
interface InstanceConfigOverrides {
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  displayName?: string;
  enabled?: boolean;
}

function navigateBack() {
  store.selectedServerId = null;
  router.push({ name: 'servers' });
}

/**
 * Gets the current tab name from the route.
 *
 * @returns {'config' | 'tools' | 'resources'} The current tab name
 */
function getTabFromRoute(): 'config' | 'tools' | 'resources' {
  const routeName = route.name;
  if (routeName === 'server-detail-tools') return 'tools';
  if (routeName === 'server-detail-resources') return 'resources';
  return 'config';
}

function viewResource(resource: Resource) {
  if (!server.value) return;

  router.push({
    name: 'resource-detail',
    params: { name: server.value.name },
    query: {
      uri: resource.uri,
      name: resource.name,
      mimeType: resource.mimeType
    }
  });
}

// Computed property for the selected server
const server = computed(() => store.selectedServer);

/**
 * Extended instance interface with status information
 */
interface InstanceWithStatus extends ServerInstanceConfig {
  status?: string;
}

// Get all servers from store to find statuses for all instances of the same server
const allServers = computed(() => store.servers.filter((s) => s.name === server.value?.name));

// Server instances computed from rawV11Config
const serverInstances = computed((): InstanceWithStatus[] => {
  if (!server.value?.rawV11Config?.instances) {
    return [];
  }

  return server.value.rawV11Config.instances.map((instance: ServerInstance, arrayIndex: number) => {
    const statusInfo = allServers.value.find((s) => s.instance.id === instance.id);

    let status: string = 'offline';
    if (statusInfo) {
      status = statusInfo.status;
    } else if (instance.enabled !== false) {
      status = 'offline';
    }

    return {
      id: instance.id,
      timestamp: instance.timestamp ?? Date.now(),
      index: instance.index ?? arrayIndex,
      displayName: instance.displayName,
      status
    };
  });
});

// State - Top Level Tabs
const activeTopTab = ref<'config' | 'tools' | 'resources'>(getTabFromRoute());

// State - Selection (null = template selected, number = instance index selected)
const selectedInstanceIndex = ref<number | null>(null);

// State - Instance Detail Sub-tabs
const activeInstanceTab = ref<'config' | 'logs'>('config');

// Get selected instance
const selectedInstance = computed((): ServerInstanceConfig | null => {
  if (selectedInstanceIndex.value === null) return null;
  return serverInstances.value.find((inst) => inst.index === selectedInstanceIndex.value) || null;
});

// Get selected instance config for InstanceConfig component
const selectedInstanceConfig = computed((): InstanceConfigOverrides => {
  const instance = selectedInstance.value;
  if (!instance || !server.value?.rawV11Config?.instances) {
    return { args: [], env: {}, headers: {}, tags: {}, enabled: true };
  }

  // Find the corresponding instance in rawV11Config
  // First try by index, then by id, then fall back to array position
  let rawInstance: ServerInstance | undefined;

  if (instance.index !== undefined) {
    rawInstance = server.value.rawV11Config.instances.find(
      (inst: ServerInstance) => inst.index === instance.index
    );
  }

  if (!rawInstance) {
    rawInstance = server.value.rawV11Config.instances.find(
      (inst: ServerInstance) => inst.id === instance.id
    );
  }

  if (!rawInstance) {
    return {
      args: [],
      env: {},
      headers: {},
      tags: {},
      displayName: instance.displayName,
      enabled: true
    };
  }

  // Return the actual override values from rawV11Config
  return {
    args: rawInstance.args ?? [],
    env: rawInstance.env ?? {},
    headers: rawInstance.headers ?? {},
    tags: rawInstance.tags ?? {},
    displayName: rawInstance.displayName,
    enabled: rawInstance.enabled !== undefined ? rawInstance.enabled : true
  };
});

// Get original template config from rawV11Config for InstanceConfig component
const templateConfigForInstance = computed((): ServerTemplate => {
  if (!server.value?.rawV11Config?.template) {
    // Fallback to default template if rawV11Config is not available
    return {
      type: 'stdio',
      args: [],
      env: {},
      headers: {},
      timeout: 60000,
      aggregatedTools: []
    };
  }
  return server.value.rawV11Config.template;
});

// Initialize server from route parameter
onBeforeMount(() => {
  const serverNameFromRoute = route.params.name as string;
  if (serverNameFromRoute) {
    const server = store.servers.find((s) => s.name === serverNameFromRoute);
    if (server) {
      store.selectServer(server.id);
    }
  }
  activeTopTab.value = getTabFromRoute();

  // Parse selection from route
  if (route.query.selection === 'template') {
    selectedInstanceIndex.value = null;
  } else if (route.query.instanceIndex !== undefined) {
    selectedInstanceIndex.value = parseInt(route.query.instanceIndex as string, 10);
  } else {
    // Default to template selected
    selectedInstanceIndex.value = null;
  }
});

// Watch for route parameter changes
watch(
  () => route.params.name,
  (newServerName) => {
    if (newServerName) {
      const server = store.servers.find((s) => s.name === newServerName);
      if (server) {
        store.selectServer(server.id);
      }
    }
  }
);

// Watch for route name changes to update active tab
watch(
  () => route.name,
  () => {
    activeTopTab.value = getTabFromRoute();

    // Parse selection from route
    if (route.query.selection === 'template') {
      selectedInstanceIndex.value = null;
    } else if (route.query.instanceIndex !== undefined) {
      selectedInstanceIndex.value = parseInt(route.query.instanceIndex as string, 10);
    } else {
      selectedInstanceIndex.value = null;
    }
  }
);

// Watch for servers list load completion - fix for F5 refresh issue
watch(
  () => store.servers.length,
  () => {
    const serverNameFromRoute = route.params.name as string;
    if (serverNameFromRoute && !store.selectedServer) {
      const server = store.servers.find((s) => s.name === serverNameFromRoute);
      if (server) {
        store.selectServer(server.id);
      }
    }

    // Also parse selection from route after servers are loaded
    if (route.query.selection === 'template') {
      selectedInstanceIndex.value = null;
    } else if (route.query.instanceIndex !== undefined) {
      selectedInstanceIndex.value = parseInt(route.query.instanceIndex as string, 10);
    } else {
      // Default to template selected
      selectedInstanceIndex.value = null;
    }
  }
);

// State
const autoScroll = ref(true);
const showEditJson = ref(false);
const selectedTool = ref<Tool | null>(null);
const pendingTool = ref<Tool | null>(null);
const showCallDialog = ref(false);

// Instance selection for tool/resource
const showInstanceSelectForTool = ref(false);
const selectedInstanceForTool = ref<number | null>(null);
const showInstanceSelectForResourceDialog = ref(false);
const showInstanceSelectForResource = ref<Resource | null>(null);
const selectedInstanceForResource = ref<number | null>(null);

// Auto-switch tabs based on status when server changes
watch(
  () => server.value?.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      activeTopTab.value = getTabFromRoute();
      selectedTool.value = null;
      // Don't reset selectedInstanceIndex here - let the route query params decide
      // This fixes the issue where instanceIndex in URL was being ignored
    }
  },
  { immediate: true }
);

/**
 * Navigates to the specified server detail tab.
 *
 * @param {string} tab - The tab to navigate to
 */
function navigateToTab(tab: string) {
  if (!server.value?.name) return;

  const validTab = tab as 'config' | 'tools' | 'resources';
  const routeName =
    validTab === 'tools'
      ? 'server-detail-tools'
      : validTab === 'resources'
        ? 'server-detail-resources'
        : 'server-detail-config';

  router.push({ name: routeName, params: { name: server.value.name } });
}

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

// Watch for selected instance index changes and update route
watch(selectedInstanceIndex, (newInstanceIndex) => {
  if (!server.value?.name) return;

  const currentQuery = { ...route.query };
  const newQuery: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(currentQuery)) {
    if (value !== null && value !== undefined) {
      newQuery[key] = value as string | string[];
    }
  }

  if (newInstanceIndex === null) {
    newQuery.selection = 'template';
    delete newQuery.instanceIndex;
  } else {
    newQuery.instanceIndex = String(newInstanceIndex);
    delete newQuery.selection;
  }

  router.replace({
    name: route.name as string,
    params: route.params,
    query: newQuery
  });
});

// Uptime Logic
const formattedUptime = ref('00:00:00');
let uptimeInterval: ReturnType<typeof setInterval> | null = null;

const updateUptime = () => {
  formattedUptime.value = formatUptime(server.value?.startTime, server.value?.status);
};

onMounted(() => {
  uptimeInterval = setInterval(updateUptime, 1000);
  updateUptime();
});

onUnmounted(() => {
  if (uptimeInterval) clearInterval(uptimeInterval);
});

watch(
  () => server.value?.startTime,
  () => {
    updateUptime();
  }
);

// Actions
const restartServer = async () => {
  if (server.value) {
    try {
      if (server.value.status === 'online') {
        await store.stopServer(server.value.id);
      }
      await store.startServer(server.value.id);
      ElMessage.success(t('action.restarted'));
    } catch (e: unknown) {
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }
};

const stopServer = async () => {
  if (server.value) {
    try {
      await store.stopServer(server.value.id);
      ElMessage.success(t('action.stopped'));
    } catch (e: unknown) {
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }
};

const startServer = async () => {
  if (server.value) {
    try {
      await store.startServer(server.value.id);
      ElMessage.success(t('action.started'));
    } catch (e: unknown) {
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }
};

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
    const formatTimestamp = (timestamp: number) => {
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    };

    const logText = server.value.logs
      .map((log) => `${formatTimestamp(log.timestamp)} [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    navigator.clipboard.writeText(logText);
    ElMessage.success(t('action.logsCopied'));
  }
};

// Instance Card List Handlers
function handleSelectTemplate() {
  selectedInstanceIndex.value = null;
}

function handleSelectInstance(index: number) {
  selectedInstanceIndex.value = index;
}

async function handleAddInstance() {
  if (!server.value?.name) return;

  try {
    await store.addServerInstance(server.value.name);
    ElMessage.success(t('action.instanceAdded'));
  } catch (e: unknown) {
    if (e instanceof Error) {
      ElMessage.error(e.message);
    } else {
      ElMessage.error(String(e));
    }
  }
}

async function handleUpdateDisplayName(index: number, displayName: string) {
  if (!server.value?.name) return;

  try {
    await store.updateServerInstance(server.value.name, index, { displayName });
    ElMessage.success(t('action.displayNameUpdated'));
  } catch (e: unknown) {
    if (e instanceof Error) {
      ElMessage.error(e.message);
    } else {
      ElMessage.error(String(e));
    }
  }
}

async function handleDeleteInstance(index: number) {
  if (!server.value?.name) return;

  try {
    await ElMessageBox.confirm(t('serverDetail.deleteInstanceConfirm'), t('action.delete'), {
      confirmButtonText: t('action.delete'),
      cancelButtonText: t('action.cancel'),
      type: 'warning'
    });

    await store.removeServerInstance(server.value.name, index);
    ElMessage.success(t('action.instanceDeleted'));

    // If the deleted instance was selected, switch to template
    if (selectedInstanceIndex.value === index) {
      selectedInstanceIndex.value = null;
    }
  } catch (e: unknown) {
    if (e !== 'cancel') {
      if (e instanceof Error) {
        ElMessage.error(e.message || 'Failed to delete instance');
      } else {
        ElMessage.error(String(e) || 'Failed to delete instance');
      }
    }
  }
}

async function handleReassignIndexes() {
  if (!server.value?.name) return;

  try {
    await store.reassignInstanceIndexes(server.value.name);
    ElMessage.success(t('action.indexesReassigned'));
  } catch (e: unknown) {
    if (e instanceof Error) {
      ElMessage.error(e.message);
    } else {
      ElMessage.error(String(e));
    }
  }
}

async function handleUpdateInstanceConfig(config: Partial<InstanceConfigOverrides>) {
  if (!server.value || selectedInstanceIndex.value === null) return;

  try {
    // Update the local rawV11Config first
    const instanceIndex = selectedInstanceIndex.value;
    const instances = server.value.rawV11Config?.instances;
    const instance = instances?.find((inst) => inst.index === instanceIndex);

    if (instance) {
      // Apply the config updates to the instance
      if (config.args !== undefined) instance.args = config.args;
      if (config.env !== undefined) instance.env = config.env;
      if (config.headers !== undefined) instance.headers = config.headers;
      if (config.tags !== undefined) instance.tags = config.tags;
      if (config.displayName !== undefined) instance.displayName = config.displayName;
      if (config.enabled !== undefined) instance.enabled = config.enabled;
    }

    // Call the store to update the server instance
    await store.updateServerInstance(server.value.name, instanceIndex, config);
    ElMessage.success(t('action.configSaved'));
  } catch (e: unknown) {
    if (e instanceof Error) {
      ElMessage.error(e.message);
    } else {
      ElMessage.error(String(e));
    }
  }
}

function callToolWithInstance(instanceIndex: number) {
  selectedInstanceForTool.value = instanceIndex;
  showInstanceSelectForTool.value = false;
  showCallDialog.value = true;
}

function viewResourceWithInstance(instanceIndex: number) {
  void instanceIndex;
  const resource = showInstanceSelectForResource.value;
  if (resource) {
    viewResource(resource);
  }
  showInstanceSelectForResource.value = null;
  showInstanceSelectForResourceDialog.value = false;
  selectedInstanceForResource.value = null;
}

// Watch for resource selection dialog trigger
watch(showInstanceSelectForResource, (newVal) => {
  if (newVal !== null) {
    showInstanceSelectForResourceDialog.value = true;
    showInstanceSelectForResource.value = null;
  }
});
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

.custom-tabs-label .el-icon {
  vertical-align: middle;
}
.custom-tabs-label span {
  vertical-align: middle;
  margin-left: 4px;
}

.instance-detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 1rem;
}
</style>
