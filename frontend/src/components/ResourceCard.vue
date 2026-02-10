<template>
  <div class="resource-card bg-white dark:bg-[#1e293b] rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-full">
    <div class="flex items-start justify-between mb-2">
      <h3 class="font-medium text-gray-900 dark:text-white truncate flex-1 mr-2" :title="resource.name">
        {{ resource.name }}
      </h3>
      <el-tag size="small" type="success" effect="plain" class="shrink-0">{{ resource.mimeType || 'unknown' }}</el-tag>
    </div>
    
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 break-all" :title="resource.uri">
      {{ resource.uri }}
    </p>
    
    <div class="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/50 flex justify-end">
      <el-button 
        type="primary" 
        size="small" 
        plain 
        :icon="Document"
        @click="$emit('view', serverName, resource.uri)"
      >
        {{ $t('resources.read') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'

defineProps<{
  resource: {
    name: string
    mimeType?: string
    uri: string
    [key: string]: any
  }
  serverName: string
}>()

defineEmits<{
  (e: 'view', serverName: string, uri: string): void
}>()
</script>
