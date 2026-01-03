import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface SystemConfig {
  server: {
    port: number;
    host: string;
    cors: {
      enabled: boolean;
      allowedOrigins: string[];
    };
  };
  resources: {
    maxServers: number;
    maxConnections: number;
    timeoutMs: number;
  };
  security: {
    allowedIPs: string[];
    rateLimitPerMinute: number;
  };
  logging: {
    level: string;
    output: 'console' | 'file' | 'both';
    file?: {
      path: string;
      maxSizeMB: number;
      maxFiles: number;
    };
  };
  groups: Array<{
    id: string;
    name: string;
    description?: string;
    servers: string[];
  }>;
}

export const useConfigStore = defineStore('config', () => {
  const config = ref<SystemConfig | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchConfig() {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch('/web/config');
      if (!response.ok) throw new Error('Failed to fetch configuration');
      config.value = await response.json();
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function updateConfig(newConfig: SystemConfig) {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch('/web/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (!response.ok) throw new Error('Failed to update configuration');
      config.value = await response.json();
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function exportConfig() {
    try {
      const response = await fetch('/web/config/export');
      if (!response.ok) throw new Error('Failed to export configuration');
      return await response.json();
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  }

  async function importConfig(configData: any) {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch('/web/config/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      if (!response.ok) throw new Error('Failed to import configuration');
      config.value = await response.json();
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    config,
    loading,
    error,
    fetchConfig,
    updateConfig,
    exportConfig,
    importConfig
  };
});