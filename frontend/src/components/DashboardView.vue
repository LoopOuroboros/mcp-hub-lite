<!--
  DashboardView Component

  Main dashboard component that displays server statistics and recent activity logs.
  Provides an overview of the MCP Hub Lite system status with real-time updates.

  Features:
  - Server statistics cards (total, running, errors)
  - Loading skeleton states during data fetching
  - Recent activity log with auto-scrolling
  - Real-time updates via WebSocket store
  - Responsive design with dark mode support
  - Custom scrollbar styling for better UX
-->
<template>
  <div
    class="dashboard py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden transition-colors duration-300"
  >
    <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-6 shrink-0">
      {{ $t('dashboard.title') }}
    </h2>

    <!-- Stats Cards -->
    <div
      v-if="store.loading && store.servers.length === 0"
      class="grid grid-cols-3 gap-6 mb-8 shrink-0"
    >
      <el-skeleton animated :count="3" class="w-full h-full">
        <template #template>
          <div
            class="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] h-32"
          >
            <el-skeleton-item variant="text" style="width: 30%" class="mb-2" />
            <el-skeleton-item variant="h1" style="width: 50%" />
          </div>
        </template>
      </el-skeleton>
    </div>

    <div v-else class="grid grid-cols-3 gap-6 mb-8 shrink-0">
      <div
        class="stat-card bg-white dark:bg-[#1e293b] p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-300"
      >
        <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">
          {{ $t('dashboard.totalServers') }}
        </div>
        <div class="text-4xl font-bold text-gray-900 dark:text-white">{{ store.stats.total }}</div>
      </div>
      <div
        class="stat-card bg-white dark:bg-[#1e293b] p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-300"
      >
        <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">
          {{ $t('dashboard.running') }}
        </div>
        <div class="text-4xl font-bold text-gray-900 dark:text-white">
          {{ store.stats.online }}
        </div>
      </div>
      <div
        class="stat-card bg-white dark:bg-[#1e293b] p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-300"
      >
        <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">
          {{ $t('dashboard.errors') }}
        </div>
        <div class="text-4xl font-bold text-red-500">{{ store.stats.errors }}</div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div
      class="activity-section bg-white dark:bg-[#1e293b] rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col flex-1 min-h-0 shadow-sm transition-colors duration-300"
    >
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          {{ $t('dashboard.recentActivity') }}
        </h3>
      </div>
      <div ref="activityContainer" class="p-4 overflow-y-auto flex-1 custom-scrollbar">
        <div
          v-for="(activity, index) in activities"
          :key="index"
          class="activity-item mb-4 pb-4 border-b border-gray-100 dark:border-gray-700/50 last:border-0"
        >
          <div class="flex items-center gap-2 mb-1">
            <el-icon :size="16" :class="getStatusColor(activity.serverStatus)">
              <component :is="getStatusIcon(activity.serverStatus)" />
            </el-icon>
            <span class="font-medium text-gray-700 dark:text-gray-200">{{
              activity.serverName
            }}</span>
            <span class="text-xs text-gray-400 ml-auto">{{ activity.time }}</span>
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400 font-mono pl-6 break-words">
            {{ activity.message }}
          </div>
        </div>
        <div
          v-if="activities.length === 0"
          class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500"
        >
          <el-icon :size="40" class="mb-2 opacity-50"><InfoFilled /></el-icon>
          <span>No recent activity</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, ref, nextTick } from 'vue';
import { useServerStore } from '@stores/server';
import { useWebSocketStore } from '@stores/websocket';
import { VideoPlay, CircleClose, Warning, InfoFilled } from '@element-plus/icons-vue';

/**
 * Dashboard component state and logic
 *
 * Manages server statistics display and recent activity log rendering
 * with real-time updates and auto-scrolling functionality.
 */

const store = useServerStore();
useWebSocketStore();
const activityContainer = ref<HTMLElement | null>(null);

/**
 * Fetches all server logs when component is mounted and servers are available
 */
onMounted(() => {
  if (!store.loading && store.servers.length > 0) {
    store.fetchAllLogs();
  }
});

/**
 * Watches for loading state changes and fetches logs when servers become available
 */
watch(
  () => store.loading,
  (loading) => {
    if (!loading && store.servers.length > 0) {
      store.fetchAllLogs();
    }
  }
);

/**
 * Interface defining the structure of activity log items
 *
 * @interface ActivityItem
 * @property {string} serverName - Name of the server that generated the log
 * @property {string} serverStatus - Current status of the server
 * @property {string} message - Log message content
 * @property {string} time - Formatted timestamp string
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {number} originalIndex - Original index in the server's log array
 */
interface ActivityItem {
  serverName: string;
  serverStatus: string;
  message: string;
  time: string;
  timestamp: number;
  originalIndex: number;
}

/**
 * Computed property that aggregates and sorts all server logs chronologically
 *
 * Combines logs from all servers into a single timeline sorted by timestamp (oldest first).
 * Each log entry is enriched with server information and formatted timestamps.
 *
 * @returns {ActivityItem[]} Array of activity items sorted by timestamp
 */
const activities = computed(() => {
  const allActivities: ActivityItem[] = [];

  store.servers.forEach((server) => {
    server.logs.forEach((log, idx) => {
      allActivities.push({
        serverName: server.name,
        serverStatus: server.status,
        message: log.message,
        time: formatTimestamp(log.timestamp),
        timestamp: log.timestamp,
        originalIndex: idx
      });
    });
  });

  // Sort by timestamp ascending (Old -> New)
  return allActivities.sort((a, b) => a.timestamp - b.timestamp);
});

/**
 * Auto-scrolls the activity container to the bottom when new activities are added
 *
 * Uses Vue's nextTick to ensure DOM updates are complete before scrolling.
 */
watch(
  () => activities.value.length,
  () => {
    nextTick(() => {
      if (activityContainer.value) {
        activityContainer.value.scrollTop = activityContainer.value.scrollHeight;
      }
    });
  }
);

/**
 * Formats a Unix timestamp into a human-readable time string with milliseconds
 *
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted time string (HH:MM:SS.mmm)
 */
function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * Returns the appropriate Element Plus icon component based on server status
 *
 * @param {string} status - Server status string
 * @returns {Component} Element Plus icon component
 */
function getStatusIcon(status: string) {
  switch (status) {
    case 'online':
      return VideoPlay;
    case 'offline':
      return CircleClose;
    case 'stopping':
      return CircleClose;
    case 'error':
      return Warning;
    case 'starting':
      return Warning;
    default:
      return CircleClose;
  }
}

/**
 * Returns CSS color class based on server status for consistent visual indicators
 *
 * @param {string} status - Server status string
 * @returns {string} Tailwind CSS color class
 */
function getStatusColor(status: string) {
  switch (status) {
    case 'online':
      return 'text-green-500';
    case 'offline':
      return 'text-gray-400';
    case 'stopping':
      return 'text-gray-400';
    case 'error':
      return 'text-yellow-500';
    case 'starting':
      return 'text-yellow-500';
    default:
      return 'text-gray-400';
  }
}
</script>

<style scoped>
/**
 * Custom scrollbar styling for the activity container
 *
 * Provides consistent scrollbar appearance across light and dark themes
 * with appropriate colors for each theme.
 */
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
