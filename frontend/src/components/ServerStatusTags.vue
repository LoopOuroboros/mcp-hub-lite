<!--
  ServerStatusTags Component

  Displays server status information as a series of styled tags showing:
  - Server status (running, error, starting, etc.)
  - Transport type and relevant details (command for stdio, URL for SSE)
  - Server version (if available)
  - Uptime (optional, controlled by includeUptime prop)

  This component provides a compact, visual representation of server state
  for use in server lists and detail views.
-->
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
        <template v-if="props.server.config.type === 'stdio'">
          - {{ getExecutableName(props.server.config.command) }}</template
        >
        <template v-else-if="props.server.config.type === 'sse'">
          - {{ props.server.config.url }}</template
        >
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
import { getExecutableName } from '@utils/format-utils';

/**
 * Props interface for ServerStatusTags component
 *
 * @interface ServerStatusTagsProps
 * @property {Object} server - Server object containing status, version, and configuration
 * @property {string} server.status - Current server status (running, error, starting, etc.)
 * @property {string} [server.version] - Server version string (optional)
 * @property {number|null} [server.pid] - Process ID for stdio servers (optional)
 * @property {Object} server.config - Server configuration object
 * @property {string} server.config.type - Transport type (stdio, sse, streamable-http)
 * @property {string} [server.config.command] - Command for stdio transport (optional)
 * @property {string} [server.config.url] - URL for SSE transport (optional)
 * @property {number} [server.startTime] - Server start timestamp (optional)
 * @property {boolean} [includeUptime] - Whether to display uptime information (optional)
 * @property {string} [formattedUptime] - Pre-formatted uptime string (optional)
 */
interface ServerStatusTagsProps {
  server: {
    status: string;
    version?: string;
    pid?: number | null;
    config: {
      type: string;
      command?: string;
      url?: string;
    };
    startTime?: number;
  };
  includeUptime?: boolean;
  formattedUptime?: string;
}

const props = defineProps<ServerStatusTagsProps>();

/**
 * Returns CSS class names for status badge styling based on server status
 *
 * @param {string} status - Server status string
 * @returns {string} CSS class names for the status badge
 */
function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'running':
    case 'online':
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
    case 'error':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
    case 'starting':
    case 'stopping':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
  }
}

/**
 * Returns CSS class names for status dot color based on server status
 *
 * @param {string} status - Server status string
 * @returns {string} CSS class name for the status dot color
 */
function getStatusDotClass(status: string) {
  switch (status) {
    case 'running':
    case 'online':
      return 'bg-green-500';
    case 'error':
      return 'bg-red-500';
    case 'starting':
    case 'stopping':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-400';
  }
}
</script>
