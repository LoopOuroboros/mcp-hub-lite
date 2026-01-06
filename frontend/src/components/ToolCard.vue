<template>
  <el-card class="tool-card">
    <template #header>
      <div class="tool-header">
        <span class="tool-name">{{ tool.name }}</span>
        <el-tag size="small">{{ serverName }}</el-tag>
      </div>
    </template>
    <div class="tool-body">
      <p class="tool-description">{{ tool.description || $t('tools.noDescription') }}</p>
      <el-collapse v-if="tool.inputSchema">
        <el-collapse-item :title="$t('tools.schema')">
          <pre class="schema-view">{{ JSON.stringify(tool.inputSchema, null, 2) }}</pre>
        </el-collapse-item>
      </el-collapse>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import type { McpTool } from '../stores/server.store';

interface Props {
  tool: McpTool;
  serverName: string;
}

defineProps<Props>();
</script>

<style scoped>
.tool-card {
  height: 100%;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tool-name {
  font-weight: bold;
  font-size: 16px;
}

.tool-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tool-description {
  color: #666;
  margin: 0;
  line-height: 1.5;
}

.schema-view {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  margin: 0;
}
</style>
