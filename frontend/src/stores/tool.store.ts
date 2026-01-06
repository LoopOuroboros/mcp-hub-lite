import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { McpTool } from './server.store';

/**
 * 工具状态管理Store
 * 职责：管理工具搜索、工具列表等状态
 */
export const useToolStore = defineStore('tool', () => {
  const tools = ref<McpTool[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const searchQuery = ref('');

  /**
   * 搜索工具
   */
  async function searchTools(query: string) {
    loading.value = true;
    error.value = null;
    searchQuery.value = query;

    try {
      const response = await fetch(`/web/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to search tools');
      const results = await response.json();
      tools.value = results.map((r: any) => r.tool);
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取所有工具
   */
  async function fetchAllTools() {
    return searchTools('');
  }

  /**
   * 清空工具列表
   */
  function clearTools() {
    tools.value = [];
    searchQuery.value = '';
    error.value = null;
  }

  return {
    tools,
    loading,
    error,
    searchQuery,
    searchTools,
    fetchAllTools,
    clearTools
  };
});
