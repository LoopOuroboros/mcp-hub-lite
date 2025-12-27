<template>
  <div class="tool-explorer">
    <div class="header">
      <h2>Tool Explorer</h2>
      <el-input
        v-model="searchQuery"
        placeholder="Search tools..."
        class="search-input"
        @input="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <el-alert
      v-if="store.error"
      :title="store.error"
      type="error"
      show-icon
      class="mb-4"
    />

    <div v-if="store.tools.length === 0" class="empty-state">
      <el-empty description="No tools found. Connect servers to see tools." />
    </div>

    <div v-else class="tools-grid">
      <el-card v-for="tool in store.tools" :key="tool.name + tool.serverId" class="tool-card">
        <template #header>
          <div class="tool-header">
            <span class="tool-name">{{ tool.name }}</span>
            <el-tag size="small">{{ getServerName(tool.serverId) }}</el-tag>
          </div>
        </template>
        <div class="tool-body">
          <p class="tool-description">{{ tool.description || 'No description' }}</p>
          <el-collapse>
            <el-collapse-item title="Schema">
              <pre class="schema-view">{{ JSON.stringify(tool.inputSchema, null, 2) }}</pre>
            </el-collapse-item>
          </el-collapse>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useServerStore } from '../stores/server.store';
import { Search } from '@element-plus/icons-vue';

const store = useServerStore();
const searchQuery = ref('');

function handleSearch() {
  store.searchTools(searchQuery.value);
}

function getServerName(id: string) {
  const server = store.servers.find(s => s.id === id);
  return server ? server.name : id;
}

onMounted(() => {
  store.fetchServers(); // Ensure servers are loaded for names
  store.searchTools('');
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
.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tool-name {
  font-weight: bold;
}
.tool-description {
  color: #666;
  margin-bottom: 10px;
  min-height: 40px;
}
.schema-view {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  overflow: auto;
}
.mb-4 {
  margin-bottom: 16px;
}
</style>
