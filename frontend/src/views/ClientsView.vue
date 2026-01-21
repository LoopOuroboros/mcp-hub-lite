<template>
  <div class="clients-view p-6 h-full flex flex-col overflow-hidden transition-colors duration-300">
    <div class="flex justify-between items-center mb-6 shrink-0">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Connected Clients</h2>
      <el-button type="primary" @click="refresh">Refresh</el-button>
    </div>

    <div class="bg-white dark:bg-[#1e293b] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex-1 overflow-hidden flex flex-col">
      <el-table 
        :data="store.clients" 
        style="width: 100%" 
        height="100%"
        v-loading="store.loading"
        class="flex-1"
      >
        <el-table-column prop="clientId" label="Client ID" min-width="150" show-overflow-tooltip />
        <el-table-column prop="clientName" label="Name" min-width="120" />
        <el-table-column prop="cwd" label="CWD" min-width="200" show-overflow-tooltip />
        <el-table-column prop="project" label="Project" min-width="150" />
        <el-table-column label="Roots" min-width="200">
          <template #default="scope">
            <div v-if="scope.row.roots && scope.row.roots.length">
              <el-tag v-for="(root, idx) in scope.row.roots" :key="idx" size="small" class="mr-1 mb-1">
                {{ root.name || root.uri }}
              </el-tag>
            </div>
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="lastSeen" label="Last Seen" width="180">
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
import { useClientStore } from '../stores/client'

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
