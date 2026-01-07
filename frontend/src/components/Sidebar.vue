<template>
  <div class="sidebar flex flex-col h-full bg-[#1e293b] border-r border-gray-700">
    <div class="p-4">
      <h1 class="text-xl font-bold text-white mb-6">{{ $t('sidebar.title') }}</h1>
      
      <!-- Dashboard Link -->
      <div 
        class="server-item flex items-center gap-3 p-3 rounded-lg cursor-pointer mb-4 transition-colors"
        :class="{ 'active': store.selectedServerId === null }"
        @click="store.selectServer(null)"
      >
        <el-icon :size="20" class="text-blue-400"><Odometer /></el-icon>
        <span class="font-medium text-gray-200">{{ $t('sidebar.dashboard') }}</span>
      </div>

      <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">{{ $t('sidebar.servers') }}</div>
      
      <div class="space-y-2">
        <div
          v-for="server in store.servers"
          :key="server.id"
          class="server-item flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors"
          :class="{ 'active': store.selectedServerId === server.id }"
          @click="store.selectServer(server.id)"
        >
          <div class="flex items-center gap-3 overflow-hidden">
            <el-icon :size="20" :class="getStatusColor(server.status)">
              <component :is="getStatusIcon(server.status)" />
            </el-icon>
            <div class="flex flex-col overflow-hidden">
              <span class="font-medium truncate text-sm text-gray-200">{{ server.name }}</span>
              <span class="text-xs text-gray-500 flex items-center gap-1">
                {{ $t(`serverDetail.status.${server.status}`) }} 
                <span v-if="server.config.transport" class="opacity-75">- {{ server.config.transport }}</span>
              </span>
            </div>
          </div>
          <el-button 
            v-if="server.status === 'running'"
            type="danger" 
            size="small" 
            circle 
            class="stop-btn opacity-0 group-hover:opacity-100 transition-opacity"
            @click.stop="store.updateServerStatus(server.id, 'stopped')"
            :title="$t('action.stop')"
          >
            <el-icon><SwitchButton /></el-icon>
          </el-button>
          <el-button 
            v-else
            type="success" 
            size="small" 
            circle 
            class="start-btn opacity-0 group-hover:opacity-100 transition-opacity"
            @click.stop="store.updateServerStatus(server.id, 'running')"
            :title="$t('action.start')"
          >
            <el-icon><VideoPlay /></el-icon>
          </el-button>
        </div>
      </div>
    </div>
    
    <div class="mt-auto p-4 border-t border-gray-700 flex flex-col gap-3">
      <el-button class="w-full" type="primary" plain @click="$emit('add-server')">
        <el-icon class="mr-2"><Plus /></el-icon> {{ $t('sidebar.addServer') }}
      </el-button>

      <div class="flex justify-center">
        <el-radio-group v-model="locale" size="small">
          <el-radio-button label="en" value="en">English</el-radio-button>
          <el-radio-button label="zh" value="zh">中文</el-radio-button>
        </el-radio-group>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useServerStore } from '../stores/server'
import { VideoPlay, CircleClose, Warning, Plus, Odometer, SwitchButton } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const store = useServerStore()
const { locale } = useI18n()

defineEmits(['add-server'])

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
    case 'stopped': return 'text-gray-500'
    case 'error': return 'text-yellow-500'
    default: return 'text-gray-500'
  }
}
</script>

<style scoped>
.server-item {
  background-color: transparent;
  border: 1px solid transparent;
}
.server-item:hover {
  background-color: rgba(51, 65, 85, 0.5);
}
.server-item.active {
  background-color: rgba(30, 58, 138, 0.4);
  border-color: #3b82f6;
}
/* Show buttons on hover */
.server-item:hover .stop-btn,
.server-item:hover .start-btn {
  opacity: 1;
}
</style>
