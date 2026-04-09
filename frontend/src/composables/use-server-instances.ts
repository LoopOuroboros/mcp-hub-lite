/**
 * Composable for server instances management
 * Handles instance operations, status tracking, and instance list management
 */

import { computed, type ComputedRef, type Ref } from 'vue';
import { useServerStore } from '@stores/server';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import type {
  ServerInstance,
  ServerTemplate,
  ServerInstanceConfig
} from '@shared-models/server.model';
import type { InstanceWithStatus, InstanceConfigOverrides } from '@/types/server-detail';

/**
 * Return type for useServerInstances composable
 */
export interface UseServerInstancesReturn {
  // Computed properties
  serverInstances: ComputedRef<InstanceWithStatus[]>;
  selectedInstance: ComputedRef<ServerInstanceConfig | null>;
  selectedInstanceConfig: ComputedRef<InstanceConfigOverrides>;
  templateConfigForInstance: ComputedRef<ServerTemplate>;
  allServers: ComputedRef<ReturnType<typeof useServerStore>['servers']>;

  // Methods
  getSelectedInstanceStatus: () => string;
  getSelectedInstanceServerId: () => string | null;
  startSelectedInstance: () => Promise<void>;
  stopSelectedInstance: () => Promise<void>;
  restartSelectedInstance: () => Promise<void>;
  startAllInstances: () => Promise<void>;
  stopAllInstances: () => Promise<void>;
  restartAllInstances: () => Promise<void>;
  handleAddInstance: () => Promise<void>;
  handleUpdateDisplayName: (index: number, displayName: string) => Promise<void>;
  handleDeleteInstance: (index: number) => Promise<void>;
  handleReassignIndexes: () => Promise<void>;
  handleUpdateInstanceConfig: (config: Partial<InstanceConfigOverrides>) => Promise<void>;
}

/**
 * Composable for managing server instances
 *
 * @param server - Computed reference to the selected server
 * @param selectedInstanceIndex - Reference to the selected instance index
 * @returns Server instances state and methods
 */
export function useServerInstances(
  server: ComputedRef<
    | {
        rawV11Config?: {
          instances?: ServerInstance[];
          template?: ServerTemplate;
        };
        name?: string;
        id?: string;
      }
    | null
    | undefined
  >,
  selectedInstanceIndex: Ref<number | null>
): UseServerInstancesReturn {
  const store = useServerStore();
  const { t } = useI18n();

  /**
   * Get all servers from store to find statuses for all instances of the same server
   */
  const allServers = computed(() => {
    console.log('[useServerInstances] Computing allServers, store.servers:', store.servers);
    return store.servers.filter((s) => s.name === server.value?.name);
  });

  /**
   * Server instances computed from rawV11Config
   */
  const serverInstances = computed((): InstanceWithStatus[] => {
    console.log('[useServerInstances] Computing serverInstances');
    if (!server.value?.rawV11Config?.instances) {
      console.log('[useServerInstances] No instances found in rawV11Config');
      return [];
    }

    return server.value.rawV11Config.instances.map(
      (instance: ServerInstance, arrayIndex: number) => {
        // Find status by matching instance ID in the aggregated server's instances array
        // Use allServers.value.find() instead of store.servers.find() for proper reactivity tracking
        const statusServer = allServers.value.find((s) =>
          s.instances?.some((inst) => inst.id === instance.id)
        );
        const statusInfo = statusServer?.instances?.find((inst) => inst.id === instance.id) as
          | InstanceWithStatus
          | undefined;

        let status: string = 'offline';
        let pid: number | undefined = undefined;
        const transportType = server.value?.rawV11Config?.template?.type;

        if (statusInfo?.status) {
          status = statusInfo.status;
          pid = statusInfo.pid ?? undefined;
        } else {
          status = 'offline';
        }

        return {
          id: instance.id,
          timestamp: instance.timestamp ?? Date.now(),
          index: instance.index ?? arrayIndex,
          displayName: instance.displayName,
          status,
          pid,
          transportType
        };
      }
    );
  });

  /**
   * Get selected instance
   */
  const selectedInstance = computed((): ServerInstanceConfig | null => {
    if (selectedInstanceIndex.value === null) return null;
    return serverInstances.value.find((inst) => inst.index === selectedInstanceIndex.value) || null;
  });

  /**
   * Get selected instance config for InstanceConfig component
   */
  const selectedInstanceConfig = computed((): InstanceConfigOverrides => {
    const instance = selectedInstance.value;
    if (!instance || !server.value?.rawV11Config?.instances) {
      return { args: [], env: {}, headers: {}, tags: {}, enabled: true };
    }

    // Find the corresponding instance in rawV11Config
    // First try by index, then by id, then fall back to array position
    let rawInstance: ServerInstance | undefined;

    if (instance.index !== undefined) {
      rawInstance = server.value.rawV11Config.instances.find(
        (inst: ServerInstance) => inst.index === instance.index
      );
    }

    if (!rawInstance) {
      rawInstance = server.value.rawV11Config.instances.find(
        (inst: ServerInstance) => inst.id === instance.id
      );
    }

    if (!rawInstance) {
      return {
        args: [],
        env: {},
        headers: {},
        tags: {},
        displayName: instance.displayName,
        enabled: true
      };
    }

    // Return the actual override values from rawV11Config
    return {
      args: rawInstance.args ?? [],
      env: rawInstance.env ?? {},
      headers: rawInstance.headers ?? {},
      tags: rawInstance.tags ?? {},
      displayName: rawInstance.displayName,
      enabled: rawInstance.enabled !== undefined ? rawInstance.enabled : true
    };
  });

  /**
   * Get original template config from rawV11Config for InstanceConfig component
   */
  const templateConfigForInstance = computed((): ServerTemplate => {
    if (!server.value?.rawV11Config?.template) {
      // Fallback to default template if rawV11Config is not available
      return {
        type: 'stdio',
        args: [],
        env: {},
        headers: {},
        timeout: 60000,
        aggregatedTools: []
      };
    }
    return server.value.rawV11Config.template;
  });

  /**
   * Gets the status of the currently selected instance
   *
   * @returns {string} The instance status
   */
  function getSelectedInstanceStatus(): string {
    if (selectedInstanceIndex.value === null) return 'offline';
    const instance = serverInstances.value.find(
      (inst) => inst.index === selectedInstanceIndex.value
    );
    return instance?.status || 'offline';
  }

  /**
   * Gets the instance ID for the currently selected instance
   *
   * @returns {string|null} The instance ID or null if not found
   */
  function getSelectedInstanceServerId(): string | null {
    if (selectedInstanceIndex.value === null) return null;
    const instance = serverInstances.value.find(
      (inst) => inst.index === selectedInstanceIndex.value
    );
    return instance?.id || null;
  }

  /**
   * Starts a specific server instance
   *
   * @param {string} serverId - The server ID to start
   */
  async function startServerInstance(serverId: string) {
    try {
      console.log('[startServerInstance] Starting instance:', serverId);
      // Immediate status update for better UX
      store.updateServerStatus(serverId, 'starting');
      await store.startServer(serverId);
      ElMessage.success(t('action.started'));
    } catch (e: unknown) {
      console.error('[startServerInstance] Error:', e);
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }

  /**
   * Starts the currently selected instance
   */
  async function startSelectedInstance() {
    const instanceId = getSelectedInstanceServerId();
    if (!instanceId) {
      ElMessage.warning(t('serverDetail.noInstanceSelected'));
      return;
    }
    await startServerInstance(instanceId);
  }

  /**
   * Stops a specific server instance
   *
   * @param {string} serverId - The server ID to stop
   */
  async function stopServerInstance(serverId: string) {
    try {
      console.log('[stopServerInstance] Stopping instance:', serverId);
      await store.stopServer(serverId);
      ElMessage.success(t('action.stopped'));
    } catch (e: unknown) {
      console.error('[stopServerInstance] Error:', e);
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }

  /**
   * Stops the currently selected instance
   */
  async function stopSelectedInstance() {
    const serverId = getSelectedInstanceServerId();
    if (!serverId) {
      ElMessage.warning(t('serverDetail.noInstanceSelected'));
      return;
    }
    await stopServerInstance(serverId);
  }

  /**
   * Restarts a specific server instance
   *
   * @param {string} instanceId - The instance ID to restart
   */
  async function restartServerInstance(instanceId: string) {
    try {
      console.log('[restartServerInstance] Restarting instance:', instanceId);
      // Immediate status update for better UX
      store.updateServerStatus(instanceId, 'starting');
      // Find the instance to check its current status
      const instance = serverInstances.value.find((inst) => inst.id === instanceId);
      if (instance && instance.status === 'online') {
        await store.stopServer(instanceId);
      }
      await store.startServer(instanceId);
      ElMessage.success(t('action.restarted'));
    } catch (e: unknown) {
      console.error('[restartServerInstance] Error:', e);
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }

  /**
   * Restarts the currently selected instance
   */
  async function restartSelectedInstance() {
    const serverId = getSelectedInstanceServerId();
    if (!serverId) {
      ElMessage.warning(t('serverDetail.noInstanceSelected'));
      return;
    }
    await restartServerInstance(serverId);
  }

  /**
   * Starts all instances of the current server
   */
  async function startAllInstances() {
    if (!server.value?.name) return;

    try {
      await store.startAllServerInstances(server.value.name);
      ElMessage.success(t('action.started'));
    } catch (e: unknown) {
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }

  /**
   * Stops all instances of the current server
   */
  async function stopAllInstances() {
    if (!server.value?.name) return;

    try {
      await store.stopAllServerInstances(server.value.name);
      ElMessage.success(t('action.stopped'));
    } catch (e: unknown) {
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }

  /**
   * Restarts all instances of the current server
   */
  async function restartAllInstances() {
    if (!server.value?.name) return;

    try {
      await store.restartAllServerInstances(server.value.name);
      ElMessage.success(t('action.restarted'));
    } catch (e: unknown) {
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }

  /**
   * Handles adding a new instance
   */
  async function handleAddInstance() {
    if (!server.value?.name) return;

    try {
      // Create temporary instance with unique ID for immediate local update
      const newId = `temp-${Date.now()}`;
      const instances = server.value.rawV11Config?.instances || [];
      const maxIndex = instances.length > 0 ? Math.max(...instances.map((i) => i.index ?? 0)) : -1;

      // Prepare the new instance
      const newInstance: ServerInstance = {
        id: newId,
        timestamp: Date.now(),
        index: maxIndex + 1,
        enabled: true,
        args: [],
        env: {},
        headers: {},
        tags: {}
      };

      // Ensure instances array exists
      if (server.value.rawV11Config) {
        if (!server.value.rawV11Config.instances) {
          server.value.rawV11Config.instances = [];
        }

        // Add the new instance locally for immediate UI update
        server.value.rawV11Config.instances.push(newInstance);
      }

      // Then call the store to add the instance
      await store.addServerInstance(server.value.name);
      ElMessage.success(t('action.instanceAdded'));
    } catch (e: unknown) {
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }

  /**
   * Handles updating an instance's display name
   *
   * @param index - The index of the instance
   * @param displayName - The new display name
   */
  async function handleUpdateDisplayName(index: number, displayName: string) {
    if (!server.value?.name) return;

    try {
      // Update locally first for immediate UI update
      const instances = server.value.rawV11Config?.instances;
      const instance = instances?.find((inst) => inst.index === index);
      if (instance) {
        instance.displayName = displayName;
      }

      // Then call the store to update the server
      await store.updateServerInstance(server.value.name, index, { displayName });
      ElMessage.success(t('action.displayNameUpdated'));
    } catch (e: unknown) {
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }

  /**
   * Handles deleting an instance
   *
   * @param index - The index of the instance to delete
   */
  async function handleDeleteInstance(index: number) {
    if (!server.value?.name) return;

    try {
      await ElMessageBox.confirm(t('serverDetail.deleteInstanceConfirm'), t('action.delete'), {
        confirmButtonText: t('action.delete'),
        cancelButtonText: t('action.cancel'),
        type: 'warning'
      });

      // Remove locally first for immediate UI update
      const instances = server.value.rawV11Config?.instances;
      if (instances) {
        const removeIndex = instances.findIndex((inst) => inst.index === index);
        if (removeIndex !== -1) {
          instances.splice(removeIndex, 1);
        }
      }

      // If this was the selected instance, clear the selection
      if (selectedInstanceIndex.value === index) {
        selectedInstanceIndex.value = null;
      }

      // Then call the store to remove the instance
      await store.removeServerInstance(server.value.name, index);
      ElMessage.success(t('action.instanceDeleted'));
    } catch (e: unknown) {
      if (e !== 'cancel') {
        if (e instanceof Error) {
          ElMessage.error(e.message || 'Failed to delete instance');
        } else {
          ElMessage.error(String(e) || 'Failed to delete instance');
        }
      }
    }
  }

  /**
   * Handles reassigning instance indexes
   */
  async function handleReassignIndexes() {
    if (!server.value?.name) return;

    try {
      await store.reassignInstanceIndexes(server.value.name);
      ElMessage.success(t('action.indexesReassigned'));
    } catch (e: unknown) {
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }

  /**
   * Handles updating an instance's configuration
   *
   * @param config - The configuration updates to apply
   */
  async function handleUpdateInstanceConfig(config: Partial<InstanceConfigOverrides>) {
    if (!server.value?.name || selectedInstanceIndex.value === null) return;

    try {
      // Update the local rawV11Config first
      const instanceIndex = selectedInstanceIndex.value;
      const instances = server.value.rawV11Config?.instances;
      const instance = instances?.find((inst) => inst.index === instanceIndex);

      if (instance) {
        // Apply the config updates to the instance
        if (config.args !== undefined) instance.args = config.args;
        if (config.env !== undefined) instance.env = config.env;
        if (config.headers !== undefined) instance.headers = config.headers;
        if (config.tags !== undefined) instance.tags = config.tags;
        if (config.proxy !== undefined) instance.proxy = config.proxy;
        if (config.displayName !== undefined) instance.displayName = config.displayName;
        if (config.enabled !== undefined) instance.enabled = config.enabled;
      }

      // Call the store to update the server instance
      await store.updateServerInstance(server.value.name, instanceIndex, config);
      ElMessage.success(t('action.configSaved'));
    } catch (e: unknown) {
      if (e instanceof Error) {
        ElMessage.error(e.message);
      } else {
        ElMessage.error(String(e));
      }
    }
  }

  return {
    serverInstances,
    selectedInstance,
    selectedInstanceConfig,
    templateConfigForInstance,
    allServers,
    getSelectedInstanceStatus,
    getSelectedInstanceServerId,
    startSelectedInstance,
    stopSelectedInstance,
    restartSelectedInstance,
    startAllInstances,
    stopAllInstances,
    restartAllInstances,
    handleAddInstance,
    handleUpdateDisplayName,
    handleDeleteInstance,
    handleReassignIndexes,
    handleUpdateInstanceConfig
  };
}
