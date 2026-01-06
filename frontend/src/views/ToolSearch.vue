<template>
  <div class="tool-explorer">
    <div class="header">
      <h2>{{ $t('tools.title') }}</h2>
      <el-input
        v-model="searchQuery"
        :placeholder="$t('tools.searchPlaceholder')"
        class="search-input"
        @input="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <el-alert
      v-if="toolStore.error"
      :title="toolStore.error"
      type="error"
      show-icon
      class="mb-4"
    />

    <div v-if="toolStore.tools.length === 0" class="empty-state">
      <el-empty :description="$t('tools.noTools')" />
    </div>

    <div v-else class="tools-grid">
      <ToolCard
        v-for="tool in toolStore.tools"
        :key="tool.name + tool.serverId"
        :tool="tool"
        :server-name="getServerName(tool.serverId)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useToolStore } from '../stores/tool.store';
import { useServerStore } from '../stores/server.store';
import { Search } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import ToolCard from '../components/ToolCard.vue';

const toolStore = useToolStore();
const serverStore = useServerStore();
const searchQuery = ref('');

function handleSearch() {
  toolStore.searchTools(searchQuery.value);
}

function getServerName(id: string) {
  const server = serverStore.servers.find(s => s.id === id);
  return server ? server.name : id;
}

onMounted(() => {
  serverStore.fetchServers(); // Ensure servers are loaded for names
  toolStore.fetchAllTools();
});
</script>

<style scoped>
.tool-explorer {
  padding: 20px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.search-input {
  width: 300px;
}
.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
</style>
