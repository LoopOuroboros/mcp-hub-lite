<template>
  <div
    v-if="server"
    class="server-detail py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden transition-colors duration-300"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 shrink-0">
      <div class="flex items-center gap-4">
        <el-button :icon="ArrowLeft" plain @click="navigateBack" class="shrink-0">
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
        <el-button :icon="Refresh" plain @click="restartServer">{{
          $t('action.restart')
        }}</el-button>
        <el-button
          v-if="server.status === 'online'"
          type="warning"
          plain
          :icon="SwitchButton"
          @click="stopServer"
          >{{ $t('action.stop') }}</el-button
        >
        <el-button v-else type="success" :icon="VideoPlay" @click="startServer">{{
          $t('action.start')
        }}</el-button>
        <el-button type="danger" :icon="Delete" @click="deleteServer">{{
          $t('action.delete')
        }}</el-button>
      </div>
    </div>

    <!-- Top Level Tabs -->
    <el-tabs v-model="activeTopTab" class="flex-1 flex flex-col overflow-hidden custom-tabs">
      <!-- Config Tab -->
      <el-tab-pane name="config" class="h-full overflow-y-auto">
        <template #label>
          <span class="custom-tabs-label">
            <el-icon><Setting /></el-icon>
            <span>{{ $t('serverDetail.tabs.config') }}</span>
          </span>
        </template>
        <el-tabs v-model="activeConfigTab" class="config-sub-tabs">
          <!-- Template Sub-tab -->
          <el-tab-pane name="template">
            <template #label>
              <span class="custom-tabs-label">
                <el-icon><Document /></el-icon>
                <span>{{ $t('serverDetail.configTabs.template') }}</span>
              </span>
            </template>
            <div class="max-w-3xl">
              <el-form label-position="top" class="mt-4">
                <el-form-item :label="$t('serverDetail.config.transport')">
                  <el-select v-model="server.config.type" class="w-full">
                    <el-option :label="$t('serverDetail.config.transportStdio')" value="stdio" />
                    <el-option :label="$t('serverDetail.config.transportSse')" value="sse" />
                    <el-option
                      :label="$t('serverDetail.config.transportHttp')"
                      value="streamable-http"
                    />
                  </el-select>
                </el-form-item>

                <template v-if="server.config.type === 'stdio'">
                  <el-form-item :label="$t('serverDetail.config.executable')">
                    <el-input v-model="server.config.command" />
                  </el-form-item>
                  <el-form-item :label="$t('serverDetail.config.args')">
                    <div class="w-full flex flex-col gap-2">
                      <div
                        v-for="(_, index) in server.config.args"
                        :key="index"
                        class="flex gap-2 w-full"
                      >
                        <el-input v-model="server.config.args![index]" />
                        <el-button :icon="Delete" circle plain @click="removeArg(index)" />
                      </div>
                      <div>
                        <el-button :icon="Plus" plain size="small" @click="addArg"
                          >+ {{ $t('serverDetail.config.addArg') }}</el-button
                        >
                      </div>
                    </div>
                  </el-form-item>
                </template>

                <template v-else>
                  <el-form-item :label="$t('serverDetail.config.url')">
                    <el-input v-model="server.config.url" />
                  </el-form-item>
                </template>

                <el-form-item :label="$t('serverDetail.config.timeout')">
                  <el-input-number v-model="timeoutInSeconds" :min="0" :step="1" />
                </el-form-item>

                <el-form-item :label="$t('serverDetail.config.description')">
                  <el-input
                    v-model="server.config.description"
                    type="textarea"
                    :rows="3"
                    :placeholder="$t('serverDetail.config.descriptionPlaceholder')"
                  />
                </el-form-item>

                <el-form-item :label="$t('serverDetail.config.autoStart')">
                  <el-switch v-model="server.config.enabled" />
                </el-form-item>

                <el-form-item :label="$t('serverDetail.config.env')">
                  <div class="w-full flex flex-col gap-2">
                    <div
                      v-for="(_, key) in server.config.env"
                      :key="key"
                      class="flex gap-2 w-full"
                      style="display: flex; gap: 0.5rem; width: 100%"
                    >
                      <el-input
                        v-model="envKeys[key as string]"
                        :placeholder="$t('addServer.keyPlaceholder')"
                        style="width: 30%; min-width: 150px"
                        @change="(val: string) => updateEnvKey(key as string, val)"
                      />
                      <el-input
                        v-model="server.config.env![key]"
                        :placeholder="$t('addServer.valuePlaceholder')"
                        style="flex: 1"
                      />
                      <el-button :icon="Delete" circle plain @click="removeEnv(key as string)" />
                    </div>
                    <div>
                      <el-button :icon="Plus" plain size="small" @click="addEnv"
                        >+ {{ $t('serverDetail.config.addEnv') }}</el-button
                      >
                    </div>
                  </div>
                </el-form-item>

                <template v-if="server.config.type !== 'stdio'">
                  <el-form-item :label="$t('serverDetail.config.headers')">
                    <div class="w-full flex flex-col gap-2">
                      <div
                        v-for="(_, key) in server.config.headers"
                        :key="key"
                        class="flex gap-2 w-full"
                        style="display: flex; gap: 0.5rem; width: 100%"
                      >
                        <el-input
                          v-model="headerKeys[key as string]"
                          :placeholder="$t('addServer.keyPlaceholder')"
                          style="width: 30%; min-width: 150px"
                          @change="(val: string) => updateHeaderKey(key as string, val)"
                        />
                        <el-input
                          v-model="server.config.headers![key]"
                          :placeholder="$t('addServer.valuePlaceholder')"
                          style="flex: 1"
                        />
                        <el-button
                          :icon="Delete"
                          circle
                          plain
                          @click="removeHeader(key as string)"
                        />
                      </div>
                      <div>
                        <el-button :icon="Plus" plain size="small" @click="addHeader"
                          >+ {{ $t('serverDetail.config.addHeader') }}</el-button
                        >
                      </div>
                    </div>
                  </el-form-item>
                </template>

                <div class="flex gap-2">
                  <el-button type="primary" class="mt-4" @click="saveConfig">{{
                    $t('serverDetail.config.save')
                  }}</el-button>
                  <el-button class="mt-4" :icon="Edit" @click="openEditJson">{{
                    $t('serverDetail.config.editByJson')
                  }}</el-button>
                </div>
              </el-form>
            </div>
          </el-tab-pane>

          <!-- Instances Sub-tab -->
          <el-tab-pane name="instances">
            <template #label>
              <span class="custom-tabs-label">
                <el-icon><Files /></el-icon>
                <span>{{ $t('serverDetail.configTabs.instances') }}</span>
              </span>
            </template>
            <div class="flex h-full gap-4 mt-4">
              <!-- Instance Card List -->
              <div class="w-1/3 border-r border-gray-200 dark:border-gray-700 pr-4 overflow-y-auto">
                <InstanceCardList
                  :instances="serverInstances"
                  :selected-index="selectedInstanceIndex"
                  :server-name="server.name"
                  @select="handleSelectInstance"
                  @add="handleAddInstance"
                  @update-display-name="handleUpdateDisplayName"
                  @delete="handleDeleteInstance"
                  @reassign-indexes="handleReassignIndexes"
                />
              </div>

              <!-- Instance Detail -->
              <div
                v-if="selectedInstanceIndex !== null"
                class="flex-1 min-h-0 overflow-y-auto pl-4"
              >
                <el-tabs v-model="activeInstanceTab" class="instance-detail-tabs">
                  <!-- Instance Config Override Tab -->
                  <el-tab-pane name="config-override">
                    <template #label>
                      <span class="custom-tabs-label">
                        <el-icon><Setting /></el-icon>
                        <span>{{ $t('serverDetail.instanceTabs.configOverride') }}</span>
                      </span>
                    </template>
                    <InstanceConfig
                      :template-config="server.config"
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
                    <div class="flex items-center justify-between gap-2 mb-2">
                      <div class="flex items-center gap-2">
                        <el-checkbox
                          v-model="autoScroll"
                          :label="$t('serverDetail.logs.autoScroll')"
                          class="text-gray-600 dark:text-gray-400"
                        />
                        <el-button size="small" :icon="Delete" plain @click="clearLogs">{{
                          $t('serverDetail.logs.clear')
                        }}</el-button>
                        <el-button size="small" :icon="CopyDocument" plain @click="copyLogs">{{
                          $t('serverDetail.logs.copy')
                        }}</el-button>
                      </div>
                    </div>
                    <div
                      class="bg-gray-900 dark:bg-black p-4 rounded-lg font-mono text-sm h-full overflow-y-auto text-gray-300"
                      ref="logsContainer"
                    >
                      <div
                        v-for="(log, index) in server.logs"
                        :key="index"
                        class="mb-1 break-words"
                      >
                        <span :class="getLogLevelColor(log.level)">
                          {{ formatTimestamp(log.timestamp) }} [{{ log.level.toUpperCase() }}]
                          {{ log.message }}
                        </span>
                      </div>
                    </div>
                  </el-tab-pane>
                </el-tabs>
              </div>

              <!-- No Instance Selected -->
              <div v-else class="flex-1 flex items-center justify-center text-gray-400">
                {{ $t('serverDetail.noInstanceSelected') }}
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-tab-pane>

      <!-- Tools Tab -->
      <el-tab-pane name="tools" class="h-full flex flex-col">
        <template #label>
          <span class="custom-tabs-label">
            <el-icon><Tools /></el-icon>
            <span>{{ $t('serverDetail.tabs.tools') }} ({{ server.toolsCount || 0 }})</span>
          </span>
        </template>
        <div class="flex h-full gap-4">
          <!-- Available Tools List -->
          <div class="w-1/3 border-r border-gray-200 dark:border-gray-700 pr-4 overflow-y-auto">
            <h3 class="font-bold mb-4">{{ $t('serverDetail.tools.available') }}</h3>
            <div v-if="server.tools && server.tools.length > 0" class="space-y-2">
              <div
                v-for="tool in server.tools"
                :key="tool.name"
                class="p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
                :class="
                  selectedTool?.name === tool.name
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                "
                @click="selectTool(tool)"
              >
                <div class="min-w-0 flex-1 mr-2">
                  <div class="font-medium truncate">{{ tool.name }}</div>
                </div>
                <el-switch
                  :model-value="isToolAllowed(tool.name)"
                  @update:model-value="
                    (val: string | number | boolean) =>
                      updateToolVisibility(tool.name, Boolean(val))
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

          <!-- Tool Details -->
          <div class="flex-1 min-h-0 overflow-y-auto px-4 flex flex-col">
            <div class="flex justify-between items-center mb-4 shrink-0">
              <h3 class="font-bold">
                {{ $t('serverDetail.tools.details') }}: {{ selectedTool?.name || '' }}
              </h3>
              <el-button
                v-if="selectedTool"
                type="primary"
                size="small"
                @click="showInstanceSelectForTool = true"
              >
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
      </el-tab-pane>

      <!-- Resources Tab -->
      <el-tab-pane name="resources" class="h-full flex flex-col">
        <template #label>
          <span class="custom-tabs-label">
            <el-icon><Files /></el-icon>
            <span>{{ $t('serverDetail.tabs.resources') }} ({{ server.resourcesCount || 0 }})</span>
          </span>
        </template>
        <div class="h-full overflow-y-auto">
          <el-table :data="server.resources || []" style="width: 100%" class="custom-table">
            <el-table-column prop="name" :label="$t('serverDetail.resources.name')" width="200">
              <template #default="{ row }">
                <div class="flex items-center gap-2">
                  <el-icon><Document /></el-icon>
                  <span class="font-medium">{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="uri" :label="$t('serverDetail.resources.uri')" min-width="300" />
            <el-table-column
              prop="mimeType"
              :label="$t('serverDetail.resources.mimeType')"
              width="150"
            />
            <el-table-column label="" width="100" align="right">
              <template #default="{ row }">
                <el-button size="small" plain @click="showInstanceSelectForResource = row">{{
                  $t('action.view')
                }}</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div
            v-if="!server.resources || server.resources.length === 0"
            class="text-center py-8 text-gray-500"
          >
            {{ $t('serverDetail.resources.none') }}
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- JSON Config Dialog -->
    <el-dialog v-model="showEditJson" title="Edit JSON Config" width="600px">
      <el-input v-model="jsonConfig" type="textarea" :rows="15" font-family="monospace" />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showEditJson = false">{{ $t('action.cancel') }}</el-button>
          <el-button type="primary" @click="saveJsonConfig">{{ $t('action.save') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Instance Select Dialog for Tool Call -->
    <el-dialog
      v-model="showInstanceSelectForTool"
      :title="$t('serverDetail.selectInstanceForTool')"
      width="500px"
    >
      <el-select
        v-model="selectedInstanceForTool"
        :placeholder="$t('serverDetail.selectInstancePlaceholder')"
        class="w-full"
      >
        <el-option
          v-for="inst in serverInstances"
          :key="inst.index ?? 0"
          :label="getInstanceSelectLabel(inst)"
          :value="inst.index ?? 0"
        />
      </el-select>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showInstanceSelectForTool = false">{{
            $t('action.cancel')
          }}</el-button>
          <el-button
            type="primary"
            @click="callToolWithInstance"
            :disabled="selectedInstanceForTool === null"
          >
            {{ $t('action.confirm') }}
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Instance Select Dialog for Resource View -->
    <el-dialog
      v-model="showInstanceSelectForResourceDialog"
      :title="$t('serverDetail.selectInstanceForResource')"
      width="500px"
    >
      <el-select
        v-model="selectedInstanceForResource"
        :placeholder="$t('serverDetail.selectInstancePlaceholder')"
        class="w-full"
      >
        <el-option
          v-for="inst in serverInstances"
          :key="inst.index ?? 0"
          :label="getInstanceSelectLabel(inst)"
          :value="inst.index ?? 0"
        />
      </el-select>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showInstanceSelectForResourceDialog = false">{{
            $t('action.cancel')
          }}</el-button>
          <el-button
            type="primary"
            @click="viewResourceWithInstance"
            :disabled="selectedInstanceForResource === null"
          >
            {{ $t('action.confirm') }}
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Tool Call Dialog -->
    <ToolCallDialog
      v-if="selectedTool && selectedInstanceForTool !== null"
      v-model="showCallDialog"
      :server-name="server.name"
      :tool-name="selectedTool.name"
      :description="selectedTool.description"
      :input-schema="selectedTool.inputSchema"
    />
  </div>
  <div v-else class="h-full flex items-center justify-center text-gray-400">
    {{ $t('serverDetail.noServerSelected') }}
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, onBeforeMount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useServerStore } from '@stores/server';
import { useWebSocketStore } from '@stores/websocket';
import ToolCallDialog from '@components/ToolCallDialog.vue';
import ServerStatusTags from '@components/ServerStatusTags.vue';
import InstanceCardList from '@components/InstanceCardList.vue';
import InstanceConfig from '@components/InstanceConfig.vue';
import {
  VideoPlay,
  SwitchButton,
  Refresh,
  Delete,
  Plus,
  Edit,
  CopyDocument,
  Document,
  ArrowLeft,
  Memo,
  Files,
  Setting,
  Tools
} from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { formatUptime } from '@utils/format-utils';
import type { Resource } from '@shared-models/resource.model';
import type { Tool } from '@shared-models/tool.model';
import type { ServerInstanceConfig } from '@shared-models/server.model';

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
}

function navigateBack() {
  store.selectedServerId = null;
  router.push({ name: 'servers' });
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

// Mock server instances - would be populated from store in real implementation
const serverInstances = computed((): ServerInstanceConfig[] => {
  // For now, return empty array - in real implementation this would come from store
  return [];
});

// State - Top Level Tabs
const activeTopTab = ref<'config' | 'tools' | 'resources'>('config');

// State - Config Sub-tabs
const activeConfigTab = ref<'template' | 'instances'>('template');

// State - Instance Selection
const selectedInstanceIndex = ref<number | null>(null);

// State - Instance Detail Sub-tabs
const activeInstanceTab = ref<'config-override' | 'logs'>('config-override');

// Get selected instance
const selectedInstance = computed((): ServerInstanceConfig | null => {
  if (selectedInstanceIndex.value === null) return null;
  return serverInstances.value.find((inst) => inst.index === selectedInstanceIndex.value) || null;
});

// Get selected instance config for InstanceConfig component
const selectedInstanceConfig = computed((): InstanceConfigOverrides => {
  const instance = selectedInstance.value;
  if (!instance) {
    return {
      args: [],
      env: {},
      headers: {},
      tags: {}
    };
  }
  return {
    args: [],
    env: {},
    headers: {},
    tags: {},
    displayName: instance.displayName
  };
});

// Initialize active tab from route query parameter
onBeforeMount(() => {
  const tabFromQuery = route.query.tab as string;
  if (tabFromQuery && ['config', 'tools', 'resources'].includes(tabFromQuery)) {
    activeTopTab.value = tabFromQuery as 'config' | 'tools' | 'resources';
  }
});

// Computed property for timeout in seconds
const timeoutInSeconds = computed({
  get: () => {
    if (server.value?.config.timeout) {
      return server.value.config.timeout / 1000;
    }
    return 60; // Default 60s
  },
  set: (val: number) => {
    if (server.value) {
      server.value.config.timeout = val * 1000;
    }
  }
});

// State
const autoScroll = ref(true);
const logsContainer = ref<HTMLElement | null>(null);
const envKeys = ref<Record<string, string>>({});
const headerKeys = ref<Record<string, string>>({});
const showEditJson = ref(false);
const jsonConfig = ref('');
const selectedTool = ref<Tool | null>(null);
const showCallDialog = ref(false);

// Instance selection for tool/resource
const showInstanceSelectForTool = ref(false);
const selectedInstanceForTool = ref<number | null>(null);
const showInstanceSelectForResourceDialog = ref(false);
const showInstanceSelectForResource = ref<Resource | null>(null);
const selectedInstanceForResource = ref<number | null>(null);

// Initialize env keys when server changes
watch(
  server,
  (newServer) => {
    if (newServer?.config.env) {
      envKeys.value = {};
      Object.keys(newServer.config.env).forEach((k) => {
        envKeys.value[k] = k;
      });
    }
    if (newServer?.config.headers) {
      headerKeys.value = {};
      Object.keys(newServer.config.headers).forEach((k) => {
        headerKeys.value[k] = k;
      });
    }
  },
  { immediate: true }
);

// Auto-switch tabs based on status when server changes
watch(
  () => server.value?.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      // Only set default tab if not already set by route query
      if (!route.query.tab) {
        activeTopTab.value = server.value?.status === 'online' ? 'tools' : 'config';
      }
      selectedTool.value = null;
      selectedInstanceIndex.value = null;
    }
  },
  { immediate: true }
);

// Auto-scroll logs
watch(
  () => server.value?.logs.length,
  () => {
    if (autoScroll.value) {
      nextTick(() => {
        if (logsContainer.value) {
          logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
        }
      });
    }
  }
);

// Tab switching logic
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

function selectTool(tool: Tool) {
  selectedTool.value = tool;
}

function isToolAllowed(toolName: string) {
  if (!server.value?.config) return false;
  const allowed = server.value.config.allowedTools;
  if (allowed === undefined || allowed === null || allowed.length === 0) return false;
  if (Array.isArray(allowed)) {
    return allowed.includes(toolName);
  }
  return false;
}

// Helper functions for log styling
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

  let currentAllowed = server.value.config.allowedTools;

  // If allowedTools is undefined, it means "All Allowed".
  // When modifying, we must convert this implicit "All" to an explicit list of all tools
  // so that removing one tool works as expected (all others remain allowed).
  if (currentAllowed === undefined || currentAllowed === null) {
    if (server.value.tools) {
      currentAllowed = server.value.tools.map((t: Tool) => t.name);
    } else {
      currentAllowed = [];
    }
  }

  if (enabled) {
    if (!currentAllowed.includes(toolName)) {
      currentAllowed = [...currentAllowed, toolName];
    }
  } else {
    currentAllowed = currentAllowed.filter((t: string) => t !== toolName);
  }

  // Optimistic update
  server.value.config.allowedTools = currentAllowed;

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
  }
};

const openEditJson = () => {
  if (!server.value) return;

  const configObj: Record<string, unknown> = {
    env: server.value.config.env || {},
    enabled: server.value.config.enabled,
    description: server.value.config.description
  };

  if (server.value.config.headers && Object.keys(server.value.config.headers).length > 0) {
    configObj.headers = server.value.config.headers;
  }

  if (server.value.config.timeout) {
    configObj.timeout = server.value.config.timeout;
  }

  if (server.value.config.type === 'stdio') {
    configObj.command = server.value.config.command;
    configObj.args = server.value.config.args || [];
  } else {
    configObj.url = server.value.config.url;
  }

  const fullConfig = {
    mcpServers: {
      [server.value.name]: configObj
    }
  };

  jsonConfig.value = JSON.stringify(fullConfig, null, 2);
  showEditJson.value = true;
};

const saveJsonConfig = async () => {
  try {
    const parsed = JSON.parse(jsonConfig.value);
    if (!parsed.mcpServers) throw new Error('Missing mcpServers key');

    const names = Object.keys(parsed.mcpServers);
    if (names.length === 0) throw new Error('No server config found');

    const name = names[0] || '';
    const newConfig = parsed.mcpServers[name];

    if (server.value) {
      const updatedConfig = { ...server.value.config };

      if (newConfig.command) {
        updatedConfig.type = 'stdio';
        updatedConfig.command = newConfig.command;
        updatedConfig.args = newConfig.args || [];
        delete (updatedConfig as Record<string, unknown>).url;
      } else if (newConfig.url) {
        // Only use sse if explicitly specified, otherwise default to streamable-http
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
      } else if (newConfig.headers === null || newConfig.headers === undefined) {
        // Only clear headers if explicitly set to null/undefined in JSON
        // This preserves existing headers when not specified in JSON
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

      await store.updateServer(server.value.id, {
        name: name !== server.value.name ? name : undefined,
        config: updatedConfig
      });

      if (updatedConfig.env) {
        envKeys.value = {};
        Object.keys(updatedConfig.env).forEach((k) => {
          envKeys.value[k] = k;
        });
      }

      if (updatedConfig.headers) {
        headerKeys.value = {};
        Object.keys(updatedConfig.headers).forEach((k) => {
          headerKeys.value[k] = k;
        });
      }

      showEditJson.value = false;
      ElMessage.success(t('action.configSaved'));
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      ElMessage.error('Invalid JSON: ' + e.message);
    } else {
      ElMessage.error('Invalid JSON: ' + String(e));
    }
  }
};

// Config helpers
const addArg = () => {
  if (!server.value!.config.args) server.value!.config.args = [];
  server.value!.config.args.push('');
};

const removeArg = (index: number) => {
  server.value!.config.args?.splice(index, 1);
};

const addEnv = () => {
  if (!server.value!.config.env) server.value!.config.env = {};
  const newKey = `NEW_VAR_${Object.keys(server.value!.config.env).length}`;
  server.value!.config.env[newKey] = '';
  envKeys.value[newKey] = newKey;
};

const removeEnv = (key: string) => {
  delete server.value!.config.env![key];
  delete envKeys.value[key];
};

const updateEnvKey = (oldKey: string, newKey: string) => {
  if (oldKey === newKey) return;
  const val = server.value!.config.env![oldKey] || '';
  delete server.value!.config.env![oldKey];
  server.value!.config.env![newKey] = val;
  delete envKeys.value[oldKey];
  envKeys.value[newKey] = newKey;
};

const addHeader = () => {
  if (!server.value!.config.headers) server.value!.config.headers = {};
  const newKey = `NEW_HEADER_${Object.keys(server.value!.config.headers).length}`;
  server.value!.config.headers[newKey] = '';
  headerKeys.value[newKey] = newKey;
};

const removeHeader = (key: string) => {
  delete server.value!.config.headers![key];
  delete headerKeys.value[key];
};

const updateHeaderKey = (oldKey: string, newKey: string) => {
  if (oldKey === newKey) return;
  const val = server.value!.config.headers![oldKey] || '';
  delete server.value!.config.headers![oldKey];
  server.value!.config.headers![newKey] = val;
  delete headerKeys.value[oldKey];
  headerKeys.value[newKey] = newKey;
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

// Instance Card List Handlers
function handleSelectInstance(index: number) {
  selectedInstanceIndex.value = index;
}

function handleAddInstance() {
  // Would call store.addServerInstance in real implementation
  ElMessage.info('Add instance - would call store.addServerInstance');
}

function handleUpdateDisplayName(index: number, displayName: string) {
  // Would call store.updateServerInstance in real implementation
  ElMessage.info(`Update display name for #${index}: ${displayName}`);
}

function handleDeleteInstance(index: number) {
  // Would call store.removeServerInstance in real implementation
  ElMessage.info(`Delete instance #${index}`);
}

function handleReassignIndexes() {
  // Would call store.reassignInstanceIndexes in real implementation
  ElMessage.info('Reassign indexes');
}

function handleUpdateInstanceConfig(config: Partial<InstanceConfigOverrides>) {
  // Would call store.updateServerInstance in real implementation
  void config;
  ElMessage.info('Update instance config');
}

// Instance selection helpers for tool/resource
function getInstanceSelectLabel(inst: ServerInstanceConfig): string {
  return `#${inst.index ?? 0} [${inst.displayName || t('serverDetail.instances.unnamed')}]`;
}

function callToolWithInstance() {
  showInstanceSelectForTool.value = false;
  showCallDialog.value = true;
}

function viewResourceWithInstance() {
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
/* Tabs styling adjustments if needed */
.custom-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}
.custom-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  padding-top: 1rem;
}

/* Custom tab label styling with icons */
.custom-tabs-label .el-icon {
  vertical-align: middle;
}
.custom-tabs-label span {
  vertical-align: middle;
  margin-left: 4px;
}

/* Config sub-tabs styling */
.config-sub-tabs :deep(.el-tabs__header) {
  margin-bottom: 1rem;
}

/* Instance detail tabs styling */
.instance-detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 1rem;
}
</style>
