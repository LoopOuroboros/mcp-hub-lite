<template>
  <div class="resources-view py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden bg-gray-50 dark:bg-[#0f172a] transition-colors duration-300">
    <!-- Header -->
    <div class="mb-6 shrink-0">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">{{ $t('resources.title') }}</h2>
      
      <!-- Search Bar -->
      <div class="relative">
        <el-input
          v-model="searchQuery"
          :placeholder="$t('resources.searchPlaceholder')"
          class="w-full"
          size="large"
          :prefix-icon="Search"
          clearable
        >
        </el-input>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
      
      <div v-if="Object.keys(filteredResources).length === 0" class="flex flex-col items-center justify-center py-12 text-gray-400">
        <el-icon :size="48" class="mb-4 opacity-50"><Folder /></el-icon>
        <p>{{ $t('resources.noResources') }}</p>
      </div>

      <!-- Resource Groups by Server -->
      <section v-for="(resources, serverName) in filteredResources" :key="serverName" class="animate-fade-in">
        <template v-if="serverName === MCP_HUB_LITE_SERVER">
          <div class="flex items-center gap-2 mb-4">
            <el-icon class="text-gray-900 dark:text-white" :size="20"><Setting /></el-icon>
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">
              {{ $t('resources.systemResources') }}
              <span class="text-sm font-normal text-gray-500 ml-2">({{ resources.length }})</span>
            </h3>
            <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700 ml-4"></div>
          </div>

          <!-- Server Resources Subsection -->
          <div v-if="getSystemServerResources(resources).length > 0" class="mb-6 pl-4">
            <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
              {{ $t('resources.serverResources') }}
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <ResourceCard 
                v-for="resource in getSystemServerResources(resources)" 
                :key="resource.uri"
                :resource="resource"
                :server-name="serverName"
                @view="viewResource"
              />
            </div>
          </div>

          <!-- Tool Resources Subsection -->
          <div v-if="getSystemToolResources(resources).length > 0" class="pl-4">
            <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
              {{ $t('resources.toolResources') }}
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <ResourceCard 
                v-for="resource in getSystemToolResources(resources)" 
                :key="resource.uri"
                :resource="resource"
                :server-name="serverName"
                @view="viewResource"
              />
            </div>
          </div>
        </template>
        
        <template v-else>
          <div class="flex items-center gap-2 mb-4">
            <el-tag effect="dark" type="info" size="default" class="!text-sm font-medium">
              {{ serverName }}
            </el-tag>
            <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <ResourceCard 
              v-for="resource in resources" 
              :key="resource.uri"
              :resource="resource"
              :server-name="serverName"
              @view="viewResource"
            />
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Folder, Setting } from '@element-plus/icons-vue'
import { useServerStore } from '@stores/server'
import ResourceCard from '@components/ResourceCard.vue'

const router = useRouter()
const store = useServerStore()
const searchQuery = ref('')
const allResources = ref<Record<string, any[]>>({})
const MCP_HUB_LITE_SERVER = 'mcp-hub-lite'

onMounted(async () => {
  await loadResources()
})

async function loadResources() {
  try {
    allResources.value = await store.fetchAllResources()
  } catch (e) {
    console.error('Failed to load resources:', e)
  }
}

const filteredResources = computed(() => {
  if (!searchQuery.value) return allResources.value
  
  const query = searchQuery.value.toLowerCase()
  const result: Record<string, any[]> = {}
  
  for (const [serverName, resources] of Object.entries(allResources.value)) {
    const filtered = resources.filter(r => 
      r.name.toLowerCase().includes(query) || 
      r.uri.toLowerCase().includes(query)
    )
    if (filtered.length > 0) {
      result[serverName] = filtered
    }
  }
  
  return result
})

function isToolResource(uri: string) {
  return uri.endsWith('/tools')
}

function getSystemServerResources(resources: any[]) {
  return resources.filter(r => !isToolResource(r.uri))
}

function getSystemToolResources(resources: any[]) {
  return resources.filter(r => isToolResource(r.uri))
}

function viewResource(serverName: string, uri: string) {
  router.push({
    name: 'resource-detail',
    params: { name: serverName },
    query: { uri }
  })
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
