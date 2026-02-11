<template>
  <div class="flex flex-wrap items-center gap-2 w-full">
    <!-- Status -->
    <div
      class="flex items-center gap-2 px-3 py-1 rounded-full text-sm transition-colors border border-transparent"
      :class="getStatusBadgeClass(props.server.status)"
    >
      <div class="w-2 h-2 rounded-full" :class="getStatusDotClass(props.server.status)"></div>
      {{ $t(`serverDetail.status.${props.server.status}`) }}
    </div>

    <!-- Transport -->
    <div
      class="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
    >
      <span class="font-medium break-all max-w-full">
        {{ props.server.config.type }}
        <template v-if="props.server.config.type === 'stdio'"> - {{ getExecutableName(props.server.config.command) }}</template>
        <template v-else-if="props.server.config.type === 'sse'"> - {{ props.server.config.url }}</template>
        <template v-else-if="props.server.config.type === 'streamable-http'"></template>
      </span>
    </div>

    <!-- Version -->
    <div
      v-if="props.server.version"
      class="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
    >
      <span class="opacity-75">{{ $t('serverDetail.version') }}:</span>
      <span class="font-medium break-all max-w-full">{{ props.server.version }}</span>
    </div>

    <!-- Uptime (only shown when includeUptime is true) -->
    <div
      v-if="includeUptime && props.formattedUptime"
      class="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
    >
      <span class="opacity-75">{{ $t('serverDetail.uptime') }}:</span>
      <span class="font-mono break-all max-w-full">{{ props.formattedUptime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getExecutableName } from '@utils/format-utils'

interface ServerStatusTagsProps {
  server: {
    status: string
    version?: string
    pid?: number | null
    config: {
      type: string
      command?: string
      url?: string
    }
    startTime?: number
  }
  includeUptime?: boolean
  formattedUptime?: string
}

const props = defineProps<ServerStatusTagsProps>()

// Helper functions for status styling (copied from existing components)
function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'running':
    case 'online':
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
    case 'error': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
    case 'starting':
    case 'stopping':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
    default: return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
  }
}

function getStatusDotClass(status: string) {
  switch (status) {
    case 'running':
    case 'online':
      return 'bg-green-500'
    case 'error': return 'bg-red-500'
    case 'starting':
    case 'stopping':
      return 'bg-yellow-500'
    default: return 'bg-gray-400'
  }
}
</script>