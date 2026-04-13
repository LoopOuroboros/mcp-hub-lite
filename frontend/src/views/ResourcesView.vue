<template>
  <div
    class="resources-view py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden bg-gray-50 dark:bg-[#0f172a] transition-colors duration-300"
  >
    <!-- Header -->
    <div class="mb-6 shrink-0">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
        {{ $t('resources.title') }}
      </h2>

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
    <div class="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
      <div
        v-if="flatResources.length === 0"
        class="flex flex-col items-center justify-center py-12 text-gray-400"
      >
        <el-icon :size="48" class="mb-4 opacity-50"><Folder /></el-icon>
        <p>{{ $t('resources.noResources') }}</p>
      </div>

      <!-- Flat Resource List -->
      <el-table v-else :data="flatResources" style="width: 100%" class="custom-table">
        <el-table-column prop="name" :label="$t('common.name')" min-width="350">
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <el-icon><Document /></el-icon>
              <span class="font-medium truncate" :title="row.name">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="uri" :label="$t('common.uri')" min-width="350">
          <template #default="{ row }">
            <span class="truncate block" :title="row.uri">{{ row.uri }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="mimeType" :label="$t('common.mimeType')" width="180">
          <template #default="{ row }">
            <el-tag size="small" type="success" effect="plain">{{
              row.mimeType || 'unknown'
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="" width="100" align="right">
          <template #default="{ row }">
            <el-button size="small" plain @click="viewResource(row)">{{
              $t('action.view')
            }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Search, Folder, Document } from '@element-plus/icons-vue';
import { useServerStore } from '@stores/server';
import type { Resource } from '@shared-models/resource.model';

const router = useRouter();
const store = useServerStore();
const searchQuery = ref('');
const allResources = ref<Record<string, Resource[]>>({});

onMounted(async () => {
  await loadResources();
});

async function loadResources() {
  try {
    allResources.value = await store.fetchAllResources();
  } catch (e) {
    console.error('Failed to load resources:', e);
  }
}

const flatResources = computed(() => {
  const resources: Resource[] = [];

  for (const [, resourceList] of Object.entries(allResources.value)) {
    resources.push(...resourceList);
  }

  if (!searchQuery.value) return resources;

  const query = searchQuery.value.toLowerCase();
  return resources.filter(
    (r) => r.name.toLowerCase().includes(query) || r.uri.toLowerCase().includes(query)
  );
});

function viewResource(resource: Resource) {
  router.push({
    name: 'resource-detail',
    params: { name: resource.uri },
    query: {
      uri: resource.uri,
      name: resource.name,
      mimeType: resource.mimeType
    }
  });
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
</style>
