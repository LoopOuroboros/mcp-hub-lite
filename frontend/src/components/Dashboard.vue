<template>
  <div class="dashboard p-6 h-full flex flex-col overflow-hidden transition-colors duration-300">
    <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-6 shrink-0">{{ $t('dashboard.title') }}</h2>
    
    <!-- Stats Cards -->
    <div v-if="store.loading && store.servers.length === 0" class="grid grid-cols-3 gap-6 mb-8 shrink-0">
      <el-skeleton animated :count="3" class="w-full h-full">
        <template #template>
          <div class="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] h-32">
            <el-skeleton-item variant="text" style="width: 30%" class="mb-2" />
            <el-skeleton-item variant="h1" style="width: 50%" />
          </div>
        </template>
      </el-skeleton>
    </div>

    <div v-else class="grid grid-cols-3 gap-6 mb-8 shrink-0">
      <div class="stat-card bg-white dark:bg-[#1e293b] p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-300">
        <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">{{ $t('dashboard.totalServers') }}</div>
        <div class="text-4xl font-bold text-gray-900 dark:text-white">{{ store.stats.total }}</div>
      </div>
      <div class="stat-card bg-white dark:bg-[#1e293b] p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-300">
        <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">{{ $t('dashboard.running') }}</div>
        <div class="text-4xl font-bold text-gray-900 dark:text-white">{{ store.stats.running }}</div>
      </div>
      <div class="stat-card bg-white dark:bg-[#1e293b] p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-300">
        <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">{{ $t('dashboard.errors') }}</div>
        <div class="text-4xl font-bold text-red-500">{{ store.stats.errors }}</div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="activity-section bg-white dark:bg-[#1e293b] rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col flex-1 min-h-0 shadow-sm transition-colors duration-300">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">{{ $t('dashboard.recentActivity') }}</h3>
      </div>
      <div class="p-4 overflow-y-auto flex-1 custom-scrollbar">
        <div v-for="(activity, index) in activities" :key="index" class="activity-item mb-4 pb-4 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
          <div class="flex items-center gap-2 mb-1">
            <el-icon :size="16" :class="getStatusColor(activity.serverStatus)">
              <component :is="getStatusIcon(activity.serverStatus)" />
            </el-icon>
            <span class="font-medium text-gray-700 dark:text-gray-200">{{ activity.serverName }}</span>
            <span class="text-xs text-gray-400 ml-auto">{{ activity.time }}</span>
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400 font-mono pl-6 break-words">
            {{ activity.message }}
          </div>
        </div>
        <div v-if="activities.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <el-icon :size="40" class="mb-2 opacity-50"><InfoFilled /></el-icon>
            <span>No recent activity</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useServerStore } from '../stores/server'
import { VideoPlay, CircleClose, Warning, InfoFilled } from '@element-plus/icons-vue'

const store = useServerStore()

const activities = computed(() => {
  const allActivities: any[] = []
  
  store.servers.forEach(server => {
    server.logs.forEach((log, idx) => {
      allActivities.push({
        serverName: server.name,
        serverStatus: server.status,
        message: log,
        time: new Date().toLocaleTimeString(), 
        originalIndex: idx
      })
    })
  })

  return allActivities.reverse()
})

function getStatusIcon(status: string) {
  switch (status) {
    case 'running': return VideoPlay
    case 'stopped': return CircleClose
    case 'error': return Warning
    default: return CircleClose
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'running': return 'text-green-500'
    case 'stopped': return 'text-gray-400'
    case 'error': return 'text-yellow-500'
    default: return 'text-gray-400'
  }
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 3px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #334155;
}
</style>
