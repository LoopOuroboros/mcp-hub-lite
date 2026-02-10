<template>
  <div class="tools-view py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden bg-gray-50 dark:bg-[#0f172a] transition-colors duration-300">
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
        <div 
          class="flex items-center gap-2 mb-4 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          @click="collapsedSystemTools = !collapsedSystemTools"
        >
          <el-icon class="transition-transform duration-200" :class="{ '-rotate-90': collapsedSystemTools }">
            <ArrowDown />
          </el-icon>
          <el-icon class="text-gray-900 dark:text-white" :size="20"><Setting /></el-icon>
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">
            {{ $t('tools.systemTools') }}
            <span class="text-sm font-normal text-gray-500 ml-2">({{ systemTools.length }})</span>
          </h3>
        </div>
        
        <!-- System Tools Grid -->
        <div 
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 transition-all duration-300"
          v-show="!collapsedSystemTools"
        >
          <ToolCard
            v-for="tool in systemTools"
            :key="tool.name"
            :title="tool.name"
            :description="tool.description"
            :tag-name="$t('tools.systemTag')"
            tag-class="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
            @call="openCallDialog(tool)"
          />
        </div>
      </section>

      <!-- Aggregated Tools Section -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <el-icon class="text-gray-900 dark:text-white" :size="20"><Connection /></el-icon>
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">
            {{ $t('tools.aggregatedTools') }}
            <span class="text-sm font-normal text-gray-500 ml-2">({{ groupedTools.reduce((acc, group) => acc + group.tools.length, 0) }})</span>
          </h3>
        </div>

        <div v-if="loading" class="space-y-4">
          <el-skeleton animated :count="3" />
        </div>

        <div v-else-if="groupedTools.length === 0" class="text-center py-8 text-gray-500">
          {{ $t('tools.noToolsFound') }}
        </div>

        <div v-else class="space-y-6">
          <div v-for="group in groupedTools" :key="group.serverName" class="space-y-3">
            <!-- Server Header -->
            <div 
              class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 px-1 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              @click="toggleServer(group.serverName)"
            >
              <el-icon class="transition-transform duration-200" :class="{ '-rotate-90': collapsedServers.has(group.serverName) }">
                <ArrowDown />
              </el-icon>
              <span>{{ group.serverName }}</span>
              <span class="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{{ group.tools.length }}</span>
            </div>

            <!-- Collapsible Tools Grid -->
        <div 
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-300"
          v-show="!collapsedServers.has(group.serverName)"
        >
          <ToolCard
                v-for="tool in group.tools"
                :key="tool.tool.name"
                :title="tool.tool.name"
                :description="tool.tool.description"
                @call="openCallDialog(tool.tool)"
              />
            </div>
          </div>
        </div>
      </section>

    </div>
    
    <ToolCallDialog
      v-if="selectedTool"
      v-model="showCallDialog"
      :server-name="selectedTool.serverName"
      :tool-name="selectedTool.name"
      :description="selectedTool.description"
      :input-schema="selectedTool.inputSchema"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { Search, Operation, Setting, Connection, ArrowDown } from '@element-plus/icons-vue'
import { http } from '@utils/http'
import { useServerStore } from '@stores/server'
import { useWebSocketStore } from '@stores/websocket'
import { useI18n } from 'vue-i18n'
import ToolCallDialog from '@components/ToolCallDialog.vue'
import ToolCard from '@components/ToolCard.vue'

const { t } = useI18n()

export interface Tool {
  name: string
  description?: string
  inputSchema?: any
  serverName: string
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

const systemTools = ref<{ name: string; description: string; inputSchema?: any }[]>([])
const showCallDialog = ref(false)
const selectedTool = ref<Tool | any>(null)
const collapsedServers = ref(new Set<string>())
const collapsedSystemTools = ref(false)

function toggleServer(serverName: string) {
  if (collapsedServers.value.has(serverName)) {
    collapsedServers.value.delete(serverName)
  } else {
    collapsedServers.value.add(serverName)
  }
}

async function fetchSystemTools() {
  try {
    const tools = await http.get<{ name: string; description: string }[]>('/web/hub-tools/system')
    systemTools.value = tools.sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error('Failed to fetch system tools:', error)
  }
}

function openCallDialog(tool: any) {
  // 直接使用工具对象的 serverName 属性
  selectedTool.value = {
    ...tool,
    serverName: tool.serverName // 工具对象本身已经包含 serverName 属性
  }
  showCallDialog.value = true
}

async function fetchTools() {
  loading.value = true
  try {
    const res = await http.get<{ results: SearchResult[] }>(`/web/search?q=${encodeURIComponent(searchQuery.value)}`)
    searchResults.value = res.results || []
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
    // 直接使用 tool.serverName 进行分组（后端已处理 allowedTools 过滤）
    const server = store.servers.find(s => s.name === result.tool.serverName);

    const statusText = server?.status === 'running' ? t('tools.online') : t('tools.offline');
    const serverName = result.tool.serverName ? `${result.tool.serverName} (${statusText})` : 'Unknown';

    if (!groups[serverName]) {
      groups[serverName] = [];
    }
    groups[serverName].push(result);
  });

  return Object.entries(groups)
    .map(([serverName, tools]) => ({
      serverName,
      tools: tools.sort((a, b) => a.tool.name.localeCompare(b.tool.name))
    }))
    .sort((a, b) => a.serverName.localeCompare(b.serverName));
})

onMounted(() => {
  fetchSystemTools()
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
