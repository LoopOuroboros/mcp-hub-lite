<template>
  <div class="sidebar flex flex-col h-full bg-gray-50 dark:bg-[#1e293b] transition-colors duration-300">
    <!-- Server List Area -->
    <div class="p-4 flex-1 overflow-y-auto custom-scrollbar">
      <div class="flex items-center justify-between mb-4 px-1">
        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ $t('sidebar.servers') }}</div>
      </div>
      
      <div class="space-y-3">
        <div
          v-for="server in store.servers"
          :key="server.id"
          class="server-card group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer"
          :class="[
            store.selectedServerId === server.id 
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-200 dark:ring-blue-800' 
              : 'bg-white dark:bg-[#2a374a] border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 shadow-sm'
          ]"
          @click="store.selectServer(server.id)"
        >
          <!-- Row 1: Icon + Name + Action Button -->
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-center gap-3 min-w-0">
               <!-- Icon Container -->
               <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    :class="getStatusIconBgClass(server.status)">
                  <el-icon :size="18" :class="getStatusColor(server.status)">
                    <component :is="getStatusIcon(server.status)" />
                  </el-icon>
               </div>
               <!-- Name -->
               <div class="font-bold text-gray-900 dark:text-gray-100 truncate text-base leading-tight">
                 {{ server.name }}
               </div>
            </div>
            
            <!-- Quick Action Button -->
            <button 
              class="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"
              @click.stop="toggleServerStatus(server)"
              :title="server.status === 'running' ? $t('action.stop') : $t('action.start')"
            >
              <el-icon :size="16" :class="server.status === 'running' ? 'text-red-500' : 'text-green-500'">
                <component :is="server.status === 'running' ? SwitchButton : VideoPlay" />
              </el-icon>
            </button>
          </div>

          <!-- Row 2: Status + Config Info -->
          <div class="flex items-center justify-between text-xs mt-1">
             <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-500 dark:text-gray-400 w-full leading-none">
                <span :class="getStatusTextColor(server.status)" class="font-medium shrink-0">
                  {{ $t(`serverDetail.status.${server.status}`) }}
                </span>
                <span class="opacity-30">|</span>
                <span class="shrink-0">
                  Transport: {{ server.config.transport }}
                </span>
                <template v-if="server.status === 'running' && server.pid">
                  <span class="opacity-30">|</span>
                  <span class="shrink-0">
                    PID: {{ server.pid }}
                  </span>
                </template>
             </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Add Server Button Footer -->
    <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0f172a] flex gap-2">
      <el-button type="primary" class="flex-1 !h-10 !text-sm !font-medium" @click="$emit('add-server')">
        <el-icon class="mr-2"><Plus /></el-icon>
        {{ $t('sidebar.addServer') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useServerStore } from '../stores/server'
import { VideoPlay, CircleClose, Warning, Plus, SwitchButton } from '@element-plus/icons-vue'

const store = useServerStore()

defineEmits(['add-server'])

// Icons mapping
function getStatusIcon(status: string) {
  switch (status) {
    case 'running': return VideoPlay
    case 'stopped': return CircleClose
    case 'error': return Warning
    default: return CircleClose
  }
}

// Icon Color
function getStatusColor(status: string) {
  switch (status) {
    case 'running': return 'text-green-500'
    case 'stopped': return 'text-gray-400 dark:text-gray-500'
    case 'error': return 'text-red-500'
    default: return 'text-gray-400'
  }
}

// Icon Background
function getStatusIconBgClass(status: string) {
  switch (status) {
    case 'running': return 'bg-green-100 dark:bg-green-900/30'
    case 'stopped': return 'bg-gray-100 dark:bg-gray-700/50'
    case 'error': return 'bg-red-100 dark:bg-red-900/30'
    default: return 'bg-gray-100 dark:bg-gray-800'
  }
}

// Text Color
function getStatusTextColor(status: string) {
  switch (status) {
    case 'running': return 'text-green-600 dark:text-green-400'
    case 'stopped': return 'text-gray-500 dark:text-gray-500'
    case 'error': return 'text-red-600 dark:text-red-400'
    default: return 'text-gray-500'
  }
}

async function toggleServerStatus(server: any) {
  if (server.status === 'running') {
    await store.stopServer(server.id)
  } else {
    await store.startServer(server.id)
  }
}
</script>

<style scoped>
/* Custom scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #475569;
}
</style>
