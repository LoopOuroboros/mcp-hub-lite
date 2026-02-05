<template>
  <div class="clients-view py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden transition-colors duration-300">
    <div class="flex justify-between items-center mb-6 shrink-0">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ $t('clients.title') }}</h2>
      <el-button type="primary" @click="refresh">{{ $t('clients.refresh') }}</el-button>
    </div>

    <div class="bg-white dark:bg-[#1e293b] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex-1 overflow-hidden flex flex-col">
      <el-table
        :data="store.clients"
        style="width: 100%"
        height="100%"
        v-loading="store.loading"
        class="flex-1"
      >
        <el-table-column prop="sessionId" :label="$t('clients.sessionId')" min-width="150" show-overflow-tooltip />
        <el-table-column prop="clientName" :label="$t('clients.name')" min-width="120" />
        <el-table-column prop="clientVersion" :label="$t('clients.clientVersion')" min-width="100" />
        <el-table-column prop="protocolVersion" :label="$t('clients.protocolVersion')" min-width="120" />
        <el-table-column prop="userAgent" :label="$t('clients.userAgent')" min-width="250" show-overflow-tooltip />
        <el-table-column prop="ip" :label="$t('clients.ip')" min-width="120" />
        <el-table-column prop="lastSeen" :label="$t('clients.lastSeen')" width="180">
          <template #default="scope">
            {{ formatTime(scope.row.lastSeen) }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useClientStore } from '@stores/client'

const store = useClientStore()

function refresh() {
  store.fetchClients()
}

function formatTime(timestamp?: number) {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString()
}

onMounted(() => {
  store.fetchClients()
})
</script>
