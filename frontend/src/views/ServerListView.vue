<template>
  <div
    class="server-list-view py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden bg-gray-50 dark:bg-[#0f172a] transition-colors duration-300"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 shrink-0">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">
        {{ $t('sidebar.servers') }}
      </h2>
      <div class="flex gap-2">
        <el-button type="primary" @click="openAddModal('form')">
          <el-icon class="mr-2"><Plus /></el-icon>
          {{ $t('sidebar.addServer') }}
        </el-button>
      </div>
    </div>

    <!-- Content -->
    <div
      v-if="store.loading && store.servers.length === 0"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      <el-skeleton animated :count="3" class="w-full h-full">
        <template #template>
          <div
            class="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] h-48"
          >
            <div class="flex items-center gap-3 mb-4">
              <el-skeleton-item variant="circle" style="width: 40px; height: 40px" />
              <div class="flex-1">
                <el-skeleton-item variant="text" style="width: 60%" class="mb-2" />
                <el-skeleton-item variant="text" style="width: 30%" />
              </div>
            </div>
            <el-skeleton-item variant="rect" style="height: 60px" />
          </div>
        </template>
      </el-skeleton>
    </div>

    <div
      v-else-if="store.servers.length === 0"
      class="flex flex-col items-center justify-center flex-1 text-gray-400 dark:text-gray-500"
    >
      <el-icon :size="64" class="mb-4 opacity-50"><Platform /></el-icon>
      <h3 class="text-xl font-medium mb-2">{{ $t('serverDetail.noServerSelected') }}</h3>
      <p class="mb-6">Click "Add New Server" to get started.</p>
      <el-button type="primary" @click="openAddModal('form')">
        <el-icon class="mr-2"><Plus /></el-icon>
        {{ $t('sidebar.addServer') }}
      </el-button>
    </div>

    <div v-else class="overflow-y-auto flex-1 custom-scrollbar">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6 pr-2">
        <div
          v-for="server in store.servers"
          :key="server.id"
          class="server-card bg-white dark:bg-[#1e293b] rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full cursor-pointer"
          @click="handleCardClick(server)"
        >
          <!-- Card Header -->
          <div class="flex flex-col gap-2 mb-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <h3
                  class="font-bold text-gray-900 dark:text-white truncate text-lg"
                  :title="server.name"
                >
                  {{ server.name }}
                </h3>
                <el-tag v-if="server.version" size="small" class="shrink-0">
                  {{ server.version }}
                </el-tag>
              </div>
            </div>

            <!-- Server Info Tags -->
            <ServerStatusTags :server="server" :include-uptime="false" />
          </div>

          <!-- CardFooter - Action buttons -->
          <div class="mt-auto space-y-2">
            <!-- Batch operation buttons - First row -->
            <div class="flex gap-2">
              <template v-if="getServerOfflineCount(server.name) > 0">
                <el-button
                  type="success"
                  plain
                  size="small"
                  :icon="VideoPlay"
                  @click.stop="startAllServerInstances(server.name)"
                  class="flex-1 !ml-0"
                  :title="$t('action.startAll')"
                >
                  {{ $t('action.startAll') }} ({{ getServerOfflineCount(server.name) }})
                </el-button>
              </template>
              <template v-if="getServerOnlineCount(server.name) > 0">
                <el-button
                  plain
                  size="small"
                  :icon="Refresh"
                  @click.stop="restartAllServerInstances(server.name)"
                  class="flex-1 !ml-0"
                  :title="$t('action.restartAll')"
                >
                  {{ $t('action.restartAll') }} ({{ getServerTotalCount(server.name) }})
                </el-button>
              </template>
              <template v-if="getServerOnlineCount(server.name) > 0">
                <el-button
                  type="warning"
                  plain
                  size="small"
                  :icon="VideoPause"
                  @click.stop="stopAllServerInstances(server.name)"
                  class="flex-1 !ml-0"
                  :title="$t('action.stopAll')"
                >
                  {{ $t('action.stopAll') }} ({{ getServerOnlineCount(server.name) }})
                </el-button>
              </template>
            </div>

            <!-- Navigation buttons - Second row -->
            <div class="grid grid-cols-3 gap-2">
              <el-button
                plain
                size="small"
                :icon="Setting"
                @click.stop="navigateToTab(server.id, 'config')"
                class="!w-full !ml-0"
              >
                {{ $t('action.configure') }} ({{ server.rawV11Config?.instances?.length || 0 }})
              </el-button>

              <el-button
                plain
                size="small"
                :icon="Tools"
                @click.stop="navigateToTab(server.id, 'tools')"
                class="!w-full !ml-0"
              >
                {{ $t('common.tools') }} ({{ server.toolsCount || 0 }})
              </el-button>

              <el-button
                plain
                size="small"
                :icon="Files"
                @click.stop="navigateToTab(server.id, 'resources')"
                class="!w-full !ml-0"
              >
                {{ $t('common.resources') }} ({{ server.resourcesCount || 0 }})
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <AddServerModal v-model="showAddModal" :initial-mode="addModalMode" />
  </div>
</template>

<script setup lang="ts">
/**
 * Server List View Component
 *
 * This component displays a list of configured MCP servers with their current status,
 * configuration details, and action buttons for managing server lifecycle.
 *
 * Features:
 * - Server card display with status indicators
 * - Server lifecycle management (start, stop, restart)
 * - Navigation to server detail views (tools, config, logs)
 * - Server configuration saving
 * - Server addition via modal dialog
 *
 * @component
 */

import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useServerStore } from '@stores/server';
import { useI18n } from 'vue-i18n';
import type { Server } from '@shared-models/server.model';
import {
  Plus,
  Platform,
  VideoPlay,
  VideoPause,
  Refresh,
  Setting,
  Tools,
  Files
} from '@element-plus/icons-vue';
import AddServerModal from '@components/AddServerModal.vue';
import ServerStatusTags from '@components/ServerStatusTags.vue';
import { ElMessage } from 'element-plus';

const store = useServerStore();
const router = useRouter();
const { t } = useI18n();
const showAddModal = ref(false);
const addModalMode = ref<'form' | 'json'>('form');

// Fetch servers when component is mounted
onMounted(() => {
  store.fetchServers();
});

/**
 * Opens the Add Server modal dialog with the specified mode.
 *
 * @param {'form' | 'json'} mode - The mode to open the modal in ('form' for form input, 'json' for JSON input)
 *
 * @example
 * ```typescript
 * openAddModal('form'); // Open modal in form mode
 * openAddModal('json'); // Open modal in JSON mode
 * ```
 */
function openAddModal(mode: 'form' | 'json') {
  addModalMode.value = mode;
  showAddModal.value = true;
}

/**
 * Navigates to the server detail view with the specified server selected and tab active.
 *
 * @param {string} serverId - The ID of the server to select
 * @param {string} tabName - The name of the tab to activate ('config', 'tools', 'resources')
 *
 * @example
 * ```typescript
 * navigateToTab('server-123', 'config'); // Navigate to config tab for server-123
 * ```
 */
function navigateToTab(serverId: string, tabName: string) {
  const server = store.servers.find((s) => s.id === serverId);
  if (!server) return;

  store.selectServer(serverId);

  const routeName =
    tabName === 'tools'
      ? 'server-detail-tools'
      : tabName === 'resources'
        ? 'server-detail-resources'
        : 'server-detail-config';

  router.push({ name: routeName, params: { name: server.name } });
}

/**
 * Handles clicking on a server card to navigate to the appropriate detail view.
 *
 * For online servers, navigates to the config tab (which contains logs). For offline servers, navigates to the config tab.
 *
 * @param {Server} server - The server object that was clicked
 *
 * @example
 * ```typescript
 * handleCardClick(selectedServer); // Navigate based on server status
 * ```
 */
function handleCardClick(server: Server) {
  navigateToTab(server.id, 'config');
}

/**
 * Gets the count of online instances for a specific server.
 *
 * @param {string} serverName - The name of the server
 * @returns {number} Number of online instances
 */
function getServerOnlineCount(serverName: string) {
  const server = store.servers.find((s) => s.name === serverName);
  if (!server) return 0;
  const instances = server.instances || [];
  return instances.filter((inst) => inst.status === 'online').length;
}

/**
 * Gets the count of offline instances for a specific server.
 *
 * @param {string} serverName - The name of the server
 * @returns {number} Number of offline instances
 */
function getServerOfflineCount(serverName: string) {
  return getServerTotalCount(serverName) - getServerOnlineCount(serverName);
}

/**
 * Gets the total count of instances for a specific server.
 *
 * @param {string} serverName - The name of the server
 * @returns {number} Total number of instances
 */
function getServerTotalCount(serverName: string) {
  const server = store.servers.find((s) => s.name === serverName);
  return server?.instances?.length || 0;
}

/**
 * Starts all instances of a server.
 *
 * This function calls the store's startAllServerInstances method and provides user feedback
 * via success/error messages.
 *
 * @param {string} serverName - The name of the server to start all instances for
 * @async
 * @throws {Error} If the server instances fail to start
 *
 * @example
 * ```typescript
 * await startAllServerInstances('my-server'); // Start all instances of my-server
 * ```
 */
async function startAllServerInstances(serverName: string) {
  try {
    await store.startAllServerInstances(serverName);
    ElMessage.success(t('action.started'));
  } catch (err: unknown) {
    ElMessage.error((err as Error).message || t('error.connectionFailed'));
  }
}

/**
 * Stops all instances of a server.
 *
 * This function calls the store's stopAllServerInstances method and provides user feedback
 * via success/error messages.
 *
 * @param {string} serverName - The name of the server to stop all instances for
 * @async
 * @throws {Error} If the server instances fail to stop
 *
 * @example
 * ```typescript
 * await stopAllServerInstances('my-server'); // Stop all instances of my-server
 * ```
 */
async function stopAllServerInstances(serverName: string) {
  try {
    await store.stopAllServerInstances(serverName);
    ElMessage.success(t('action.stopped'));
  } catch (err: unknown) {
    ElMessage.error((err as Error).message || t('error.connectionFailed'));
  }
}

/**
 * Restarts all instances of a server.
 *
 * This function calls the store's restartAllServerInstances method and provides user feedback
 * via success/error messages.
 *
 * @param {string} serverName - The name of the server to restart all instances for
 * @async
 * @throws {Error} If the server instances fail to restart
 *
 * @example
 * ```typescript
 * await restartAllServerInstances('my-server'); // Restart all instances of my-server
 * ```
 */
async function restartAllServerInstances(serverName: string) {
  try {
    await store.restartAllServerInstances(serverName);
    ElMessage.success(t('action.restarted'));
  } catch (err: unknown) {
    ElMessage.error((err as Error).message || t('error.connectionFailed'));
  }
}
</script>

<style scoped>
.server-card:hover {
  transform: translateY(-2px);
}
</style>
