import { defineStore } from 'pinia';
import { ref } from 'vue';
import { http } from '@utils/http';

// Deep merge function
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target } as Record<string, unknown>;
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const targetValue = target[key as keyof T];
      const sourceValue = source[key as keyof T];

      if (
        typeof targetValue === 'object' &&
        targetValue !== null &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(targetValue) &&
        !Array.isArray(sourceValue)
      ) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        result[key] = sourceValue;
      }
    }
  }
  return result as T;
}

export interface TagDefinition {
  key: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  values?: string[];
}

export interface SystemConfig {
  system: {
    host: string;
    port: number;
    language: string;
    theme: string;
    logging: {
      level: string;
      rotationAge: string;
      jsonPretty: boolean;
      mcpCommDebug: boolean;
      sessionDebug: boolean;
      apiDebug: boolean;
    };
  };
  security: {
    allowedNetworks: string[];
    maxConcurrentConnections: number;
    connectionTimeout: number;
    idleConnectionTimeout: number;
    sessionTimeout: number;
    sessionFlushInterval: number;
    maxConnections: number;
  };
  tagDefinitions?: TagDefinition[];
  isDevMode?: boolean;
  [key: string]: unknown;
}

export const useSystemStore = defineStore('system', () => {
  const config = ref<SystemConfig>({
    system: {
      host: 'localhost',
      port: 7788,
      language: 'zh',
      theme: 'system',
      logging: {
        level: 'info',
        rotationAge: '7d',
        jsonPretty: true,
        mcpCommDebug: false,
        sessionDebug: false,
        apiDebug: false
      }
    },
    security: {
      allowedNetworks: [],
      maxConcurrentConnections: 50,
      connectionTimeout: 30000,
      idleConnectionTimeout: 300000,
      sessionTimeout: 30 * 60 * 1000,
      sessionFlushInterval: 15 * 60 * 1000,
      maxConnections: 50
    },
    tagDefinitions: [],
    isDevMode: false
  });

  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchConfig() {
    loading.value = true;
    try {
      const data = await http.get<SystemConfig>('/web/config');

      // Use deep merge instead of manual merging
      config.value = deepMerge(config.value, data);
      return config.value;
    } catch (e: unknown) {
      const errorObj = e as Error;
      error.value = errorObj.message || 'Failed to fetch config';
      console.error('Fetch config error:', e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function updateConfig(updates: Partial<SystemConfig>) {
    loading.value = true;
    try {
      await http.put('/web/config', updates);

      // Use deep merge to update local state
      config.value = deepMerge(config.value, updates);
    } catch (e: unknown) {
      const errorObj = e as Error;
      error.value = errorObj.message || 'Failed to update config';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return {
    config,
    loading,
    error,
    fetchConfig,
    updateConfig
  };
});
