<template>
  <div 
    class="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow h-full cursor-pointer"
    @click="$emit('call')"
  >
    <div class="min-w-0 mb-3">
      <div class="flex items-center gap-2 mb-2">
        <span class="font-bold text-gray-900 dark:text-gray-100 font-mono text-base truncate" :title="title">
          {{ title }}
        </span>
        <span
          v-if="tagName"
          class="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
          :class="tagClass || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'"
        >
          {{ tagName }}
        </span>
      </div>
      <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2" :title="description">
        {{ description || $t('tools.noDescription') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  tagName?: string
  tagClass?: string
}>()

defineEmits<{
  (e: 'call'): void
}>()
</script>
