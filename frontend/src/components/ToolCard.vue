<!--
  ToolCard Component

  A clickable card component that displays tool information with optional server tag.
  Used in tool lists to provide a visual representation of available tools.

  Features:
  - Displays tool title and description
  - Optional server name tag with customizable styling
  - Hover effects and cursor pointer for clickability
  - Emits 'call' event when clicked
  - Responsive design with proper text truncation
-->
<template>
  <div
    class="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow h-full cursor-pointer"
    @click="$emit('call')"
  >
    <div class="min-w-0 mb-3">
      <div class="flex items-center gap-2 mb-2">
        <span
          v-if="tagName"
          class="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
          :class="tagClass || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'"
        >
          {{ tagName }}
        </span>
        <span
          class="font-bold text-gray-900 dark:text-gray-100 font-mono text-base break-all"
          :title="title"
        >
          {{ title }}
        </span>
      </div>
      <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2" :title="description">
        {{ description || $t('tools.noDescription') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Props for the ToolCard component
 *
 * @interface ToolCardProps
 * @property {string} title - The tool name/title to display
 * @property {string} [description] - Optional tool description
 * @property {string} [tagName] - Optional server name tag to display
 * @property {string} [tagClass] - Optional CSS classes for customizing tag appearance
 */
defineProps<{
  title: string;
  description?: string;
  tagName?: string;
  tagClass?: string;
}>();

/**
 * Emits events from the ToolCard component
 *
 * @interface ToolCardEmits
 * @event call - Emitted when the tool card is clicked, indicating the user wants to call this tool
 */
defineEmits<{
  (e: 'call'): void;
}>();
</script>
