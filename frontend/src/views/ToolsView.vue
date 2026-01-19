<template>
  <div class="tools-view p-6 h-full flex flex-col overflow-hidden bg-gray-50 dark:bg-[#0f172a] transition-colors duration-300">
    <!-- Header -->
    <div class="mb-6 shrink-0">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">{{ $t('tools.title') }}</h2>
      
      <!-- Search Bar -->
      <div class="relative">
        <el-input
          v-model="searchQuery"
          :placeholder="$t('tools.searchPlaceholder')"
          class="w-full"
          size="large"
          :prefix-icon="Search"
          @input="handleSearch"
        >
          <template #append>
            <el-button :icon="Operation" />
          </template>
        </el-input>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
      
      <!-- System Tools Section -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <el-icon class="text-gray-900 dark:text-white" :size="20"><Setting /></el-icon>
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('tools.systemTools') }}</h3>
        </div>
        
        <div class="space-y-3">
          <div v-for="tool in systemTools" :key="tool.name" 
               class="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div class="min-w-0 flex-1 mr-4">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-bold text-gray-900 dark:text-gray-100 font-mono text-base">{{ tool.name }}</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">{{ $t('tools.systemTag') }}</span>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{{ tool.description }}</p>
            </div>
            <el-button plain size="default">{{ $t('tools.call') }}</el-button>
          </div>
        </div>
      </section>

      <!-- Aggregated Tools Section -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <el-icon class="text-gray-900 dark:text-white" :size="20"><Connection /></el-icon>
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('tools.aggregatedTools') }}</h3>
        </div>

        <div v-if="loading" class="space-y-4">
          <el-skeleton animated :count="3" />
        </div>

        <div v-else-if="Object.keys(groupedTools).length === 0" class="text-center py-8 text-gray-500">
          {{ $t('tools.noToolsFound') }}
        </div>

        <div v-else class="space-y-6">
          <div v-for="(tools, serverName) in groupedTools" :key="serverName" class="space-y-3">
            <!-- Server Header -->
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 px-1">
              <el-icon><ArrowDown /></el-icon>
              <span>{{ serverName }}</span>
            </div>

            <!-- Tools Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div v-for="tool in tools" :key="tool.tool.name" 
                   class="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                <div class="min-w-0 flex-1 mr-4">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-gray-900 dark:text-gray-100 font-mono text-base">{{ tool.tool.name }}</span>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium" 
                          :class="getServerBadgeClass(serverName)">
                      {{ serverName }}
                    </span>
                  </div>
                  <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{{ tool.tool.description || $t('tools.noDescription') }}</p>
                </div>
                <el-button plain size="small">{{ $t('tools.detailsCall') }}</el-button>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Search, Operation, Setting, Connection, ArrowDown } from '@element-plus/icons-vue'
import { http } from '../utils/http'
import { useServerStore } from '../stores/server'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

export interface Tool {
  name: string
  description?: string
  inputSchema?: any
  serverId: string
  tags?: string[]
}

export interface SearchResult {
  tool: Tool
  score: number
}

const searchQuery = ref('')
const loading = ref(false)
const searchResults = ref<SearchResult[]>([])
const store = useServerStore()

const systemTools = computed(() => [
  {
    name: 'list_mcp_servers',
    description: t('tools.systemToolsList.listServers.description')
  },
  {
    name: 'search_aggregated_tools',
    description: t('tools.systemToolsList.searchTools.description')
  },
  {
    name: 'call_tool_generic',
    description: t('tools.systemToolsList.callTool.description')
  }
])

async function fetchTools() {
  loading.value = true
  try {
    const res = await http.get<{ data: SearchResult[] }>(`/web/search?q=${encodeURIComponent(searchQuery.value)}`)
    searchResults.value = res.data || []
  } catch (error) {
    console.error('Failed to fetch tools:', error)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  // Debounce could be added here
  fetchTools()
}

// Group tools by Server Name
const groupedTools = computed(() => {
  const groups: Record<string, SearchResult[]> = {}
  
  searchResults.value.forEach(result => {
    // Find server name from store
    const server = store.servers.find(s => s.id === result.tool.serverId)
    const statusText = server?.status === 'running' ? t('tools.online') : t('tools.offline')
    const serverName = server ? `${server.name} (${statusText})` : result.tool.serverId
    
    if (!groups[serverName]) {
      groups[serverName] = []
    }
    groups[serverName].push(result)
  })
  
  return groups
})

function getServerBadgeClass(serverName: string) {
  // Simple hashing for consistent colors, or just random logic
  if (serverName.includes('Filesystem')) return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
  if (serverName.includes('PostgreSQL')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
  if (serverName.includes('Brave')) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

onMounted(() => {
  fetchTools()
  // Ensure servers are loaded to resolve names
  if (store.servers.length === 0) {
    store.fetchServers()
  }
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #475569;
}
</style>
