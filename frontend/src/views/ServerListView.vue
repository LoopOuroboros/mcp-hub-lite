<template>
  <div class="server-list-view py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden bg-gray-50 dark:bg-[#0f172a] transition-colors duration-300">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 shrink-0">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ $t('sidebar.servers') }}</h2>
      <el-button type="primary" @click="openAddModal('form')">
        <el-icon class="mr-2"><Plus /></el-icon>
        {{ $t('sidebar.addServer') }}
      </el-button>
    </div>

    <!-- Content -->
    <div v-if="store.loading && store.servers.length === 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <el-skeleton animated :count="3" class="w-full h-full">
        <template #template>
          <div class="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] h-48">
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

    <div v-else-if="store.servers.length === 0" class="flex flex-col items-center justify-center flex-1 text-gray-400 dark:text-gray-500">
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
              <h3 class="font-bold text-gray-900 dark:text-white truncate text-lg mr-2" :title="server.name">
                {{ server.name }}
              </h3>

              <!-- Top-right action buttons -->
              <div class="flex gap-1 shrink-0">
                <el-button
                  v-if="server.status === 'running'"
                  type="danger"
                  plain
                  size="small"
                  :icon="SwitchButton"
                  @click.stop="stopServer(server)"
                  class="!p-1 !h-8"
                  :title="$t('action.stop')"
                >
                  <span class="text-xs">{{ $t('action.stop') }}</span>
                </el-button>
                <el-button
                  v-else-if="server.status === 'stopped'"
                  type="success"
                  plain
                  size="small"
                  :icon="VideoPlay"
                  @click.stop="startServer(server)"
                  class="!p-1 !h-8"
                  :title="$t('action.start')"
                >
                  <span class="text-xs">{{ $t('action.start') }}</span>
                </el-button>
                <el-button
                  v-if="server.status === 'running'"
                  plain
                  size="small"
                  :icon="Refresh"
                  @click.stop="restartServer(server)"
                  class="!p-1 !h-8"
                  :title="$t('action.restart')"
                >
                  <span class="text-xs">{{ $t('action.restart') }}</span>
                </el-button>
              </div>
            </div>

            <!-- Server Info Tags -->
            <ServerStatusTags :server="server" :include-uptime="false" />
          </div>

          <!-- CardFooter - Action buttons -->
          <div class="grid grid-cols-2 xl:grid-cols-4 gap-2 pt-4 border-t border-gray-100 dark:border-gray-700/50 mt-auto">
            <el-button
              plain
              size="small"
              :icon="Setting"
              @click.stop="navigateToTab(server.id, 'config')"
              class="!w-full !ml-0"
            >
              {{ $t('action.configure') }}
            </el-button>

            <el-button
              plain
              size="small"
              :icon="Memo"
              @click.stop="navigateToTab(server.id, 'logs')"
              class="!w-full !ml-0"
            >
              {{ $t('serverDetail.tabs.logs') }}
            </el-button>

            <el-button
              plain
              size="small"
              :icon="Tools"
              @click.stop="navigateToTab(server.id, 'tools')"
              class="!w-full !ml-0"
            >
              {{ $t('serverDetail.tabs.tools') }} ({{ server.toolsCount || 0 }})
            </el-button>

            <el-button
              plain
              size="small"
              :icon="Files"
              @click.stop="navigateToTab(server.id, 'resources')"
              class="!w-full !ml-0"
            >
              {{ $t('serverDetail.tabs.resources') }} ({{ server.resourcesCount || 0 }})
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <AddServerModal v-model="showAddModal" :initial-mode="addModalMode" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@stores/server'
import { useI18n } from 'vue-i18n'
import {
  Plus, Platform, VideoPlay, SwitchButton, Refresh, Setting,
  CircleCheckFilled, WarningFilled, CircleCloseFilled, InfoFilled,
  Memo, Tools, Files
} from '@element-plus/icons-vue'
import AddServerModal from '@components/AddServerModal.vue'
import ServerStatusTags from '@components/ServerStatusTags.vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const store = useServerStore()
const router = useRouter()
const { t } = useI18n()
const showAddModal = ref(false)
const addModalMode = ref<'form' | 'json'>('form')

onMounted(() => {
  store.fetchServers()
})

function openAddModal(mode: 'form' | 'json') {
  addModalMode.value = mode
  showAddModal.value = true
}

function navigateToTab(serverId: string, tabName: string) {
  store.selectServer(serverId)
  // Navigate to dashboard where ServerDetail is shown with the specified tab
  router.push({ name: 'dashboard', query: { tab: tabName } })
}

function configureServer(id: string) {
  store.selectServer(id)
  // Navigate to dashboard where ServerDetail is shown
  router.push({ name: 'dashboard' })
}

function handleCardClick(server: any) {
  if (server.status === 'running') {
    navigateToTab(server.id, 'logs')
  } else {
    navigateToTab(server.id, 'config')
  }
}

async function startServer(server: any) {
  try {
    await store.startServer(server.id)
    ElMessage.success(t('action.started'))
  } catch (err: any) {
    ElMessage.error(err.message || t('error.connectionFailed'))
  }
}

async function stopServer(server: any) {
  try {
    await store.stopServer(server.id)
    ElMessage.success(t('action.stopped'))
  } catch (err: any) {
    ElMessage.error(err.message || t('error.connectionFailed'))
  }
}

async function restartServer(server: any) {
  try {
    await store.stopServer(server.id)
    await store.startServer(server.id)
    ElMessage.success(t('action.restarted'))
  } catch (err: any) {
    ElMessage.error(err.message || t('error.connectionFailed'))
  }
}
</script>

<style scoped>
.server-card:hover {
  transform: translateY(-2px);
}
</style>