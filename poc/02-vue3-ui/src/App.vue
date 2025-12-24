<template>
  <div id="app">
    <el-container>
      <el-header>
        <h1>🚀 MCP Hub Lite - UI POC</h1>
      </el-header>

      <el-main>
        <el-row :gutter="20">
          <el-col :span="24">
            <el-card>
              <template #header>
                <div class="card-header">
                  <span>服务器列表</span>
                  <el-button type="primary" :icon="Plus">添加服务器</el-button>
                </div>
              </template>

              <el-table :data="servers" stripe style="width: 100%">
                <el-table-column prop="id" label="ID" width="150" />
                <el-table-column prop="name" label="名称" width="250" />
                <el-table-column prop="status" label="状态">
                  <template #default="scope">
                    <el-tag :type="statusType(scope.row.status)">
                      {{ scope.row.status }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="toolCount" label="工具数" width="100" />
                <el-table-column label="操作" width="300">
                  <template #default="scope">
                    <el-button size="small" type="success" :icon="VideoPlay">启动</el-button>
                    <el-button size="small" type="warning" :icon="VideoPause">停止</el-button>
                    <el-button size="small" type="info">详情</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="20" style="margin-top: 20px">
          <el-col :span="12">
            <el-card>
              <template #header>
                <span>搜索功能</span>
              </template>

              <el-input
                v-model="searchQuery"
                placeholder="搜索工具..."
                :prefix-icon="Search"
                clearable
                @input="onSearch"
              />

              <el-divider />

              <div v-if="searchResults.length > 0">
                <p><strong>搜索结果:</strong></p>
                <el-tag
                  v-for="tool in searchResults"
                  :key="tool"
                  type="info"
                  style="margin: 5px"
                >
                  {{ tool }}
                </el-tag>
              </div>
            </el-card>
          </el-col>

          <el-col :span="12">
            <el-card>
              <template #header>
                <span>系统信息</span>
              </template>

              <el-descriptions :column="1" border>
                <el-descriptions-item label="服务器数量">
                  <el-tag type="success">{{ servers.length }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="在线服务器">
                  <el-tag type="success">{{ onlineServers }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="总工具数">
                  <el-tag type="info">{{ totalTools }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="系统状态">
                  <el-tag type="success">运行中</el-tag>
                </el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-col>
        </el-row>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Plus, VideoPlay, VideoPause, Search } from '@element-plus/icons-vue';

// 服务器数据
const servers = ref([
  { id: 'server-1', name: 'MySQL数据库工具', status: 'online', toolCount: 15 },
  { id: 'server-2', name: '文件系统工具', status: 'online', toolCount: 8 },
  { id: 'server-3', name: 'API客户端工具', status: 'error', toolCount: 12 },
  { id: 'server-4', name: 'AI/ML工具', status: 'offline', toolCount: 20 }
]);

// 搜索查询
const searchQuery = ref('');
const searchResults = ref<string[]>([]);

// 标签类型映射
const statusType = (status: string) => {
  const map: Record<string, any> = {
    'online': 'success',
    'offline': 'info',
    'error': 'danger'
  };
  return map[status] || 'info';
};

// 计算属性
const onlineServers = computed(() => {
  return servers.value.filter(s => s.status === 'online').length;
});

const totalTools = computed(() => {
  return servers.value.reduce((sum, s) => sum + s.toolCount, 0);
});

// 搜索处理
const onSearch = () => {
  const query = searchQuery.value.toLowerCase();
  if (!query) {
    searchResults.value = [];
    return;
  }

  // 模拟搜索结果
  const allTools = ['mysql-query', 'file-read', 'api-client', 'ai-predict', 'network-scan'];
  searchResults.value = allTools
    .filter(tool => tool.toLowerCase().includes(query))
    .slice(0, 10);
};
</script>

<style scoped>
#app {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.el-header {
  display: flex;
  align-items: center;
  background-color: #409eff;
  color: white;
}

.el-header h1 {
  margin: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.el-main {
  max-width: 1400px;
  margin: 0 auto;
}
</style>