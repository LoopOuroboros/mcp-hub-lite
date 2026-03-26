/**
 * Composable for server selection and tab state management
 * Handles routing synchronization and tab/instance selection state
 */

import { ref, watch, onBeforeMount, type ComputedRef, type Ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useServerStore } from '@stores/server';

/**
 * Return type for useServerSelection composable
 */
export interface UseServerSelectionReturn {
  // State
  activeTopTab: Ref<'config' | 'tools' | 'resources'>;
  selectedInstanceIndex: Ref<number | null>;
  activeInstanceTab: Ref<'config' | 'logs'>;

  // Methods
  getTabFromRoute: () => 'config' | 'tools' | 'resources';
  navigateToTab: (tab: string) => void;
  handleSelectTemplate: () => void;
  handleSelectInstance: (index: number) => void;
}

/**
 * Composable for managing server selection state and routing synchronization
 *
 * @param server - Computed reference to the selected server
 * @returns Server selection state and methods
 */
export function useServerSelection(
  server: ComputedRef<{ name: string; id?: string } | null | undefined>
): UseServerSelectionReturn {
  const router = useRouter();
  const route = useRoute();
  const store = useServerStore();

  // State - Top Level Tabs
  const activeTopTab = ref<'config' | 'tools' | 'resources'>('config');

  // State - Selection (null = template selected, number = instance index selected)
  const selectedInstanceIndex = ref<number | null>(null);

  // State - Instance Detail Sub-tabs
  const activeInstanceTab = ref<'config' | 'logs'>('config');

  /**
   * Gets the current tab name from the route.
   *
   * @returns {'config' | 'tools' | 'resources'} The current tab name
   */
  function getTabFromRoute(): 'config' | 'tools' | 'resources' {
    const routeName = route.name;
    if (routeName === 'server-detail-tools') return 'tools';
    if (routeName === 'server-detail-resources') return 'resources';
    return 'config';
  }

  /**
   * Navigates to the specified server detail tab.
   *
   * @param {string} tab - The tab to navigate to
   */
  function navigateToTab(tab: string) {
    if (!server.value?.name) return;

    const validTab = tab as 'config' | 'tools' | 'resources';
    const routeName =
      validTab === 'tools'
        ? 'server-detail-tools'
        : validTab === 'resources'
          ? 'server-detail-resources'
          : 'server-detail-config';

    router.push({ name: routeName, params: { name: server.value.name } });
  }

  /**
   * Handles template selection
   */
  function handleSelectTemplate() {
    selectedInstanceIndex.value = null;
  }

  /**
   * Handles instance selection
   *
   * @param index - The index of the selected instance
   */
  function handleSelectInstance(index: number) {
    selectedInstanceIndex.value = index;
  }

  /**
   * Parses selection state from route query parameters
   */
  function parseSelectionFromRoute() {
    if (route.query.selection === 'template') {
      selectedInstanceIndex.value = null;
    } else if (route.query.instanceIndex !== undefined) {
      selectedInstanceIndex.value = parseInt(route.query.instanceIndex as string, 10);
    } else {
      // Default to template selected
      selectedInstanceIndex.value = null;
    }
  }

  // Initialize server from route parameter
  onBeforeMount(() => {
    const serverNameFromRoute = route.params.name as string;
    if (serverNameFromRoute) {
      const serverFromStore = store.servers.find((s) => s.name === serverNameFromRoute);
      if (serverFromStore) {
        store.selectServer(serverFromStore.id);
      }
    }
    activeTopTab.value = getTabFromRoute();
    parseSelectionFromRoute();
  });

  // Watch for route parameter changes
  watch(
    () => route.params.name,
    (newServerName) => {
      if (newServerName) {
        const serverFromStore = store.servers.find((s) => s.name === newServerName);
        if (serverFromStore) {
          store.selectServer(serverFromStore.id);
        }
      }
    }
  );

  // Watch for route name changes to update active tab
  watch(
    () => route.name,
    () => {
      activeTopTab.value = getTabFromRoute();
      parseSelectionFromRoute();
    }
  );

  // Watch for servers list load completion - fix for F5 refresh issue
  watch(
    () => store.servers.length,
    () => {
      const serverNameFromRoute = route.params.name as string;
      if (serverNameFromRoute && !store.selectedServer) {
        const serverFromStore = store.servers.find((s) => s.name === serverNameFromRoute);
        if (serverFromStore) {
          store.selectServer(serverFromStore.id);
        }
      }
      parseSelectionFromRoute();
    }
  );

  // Auto-switch tabs based on status when server changes
  watch(
    () => server.value?.id,
    (newId, oldId) => {
      if (newId && newId !== oldId) {
        activeTopTab.value = getTabFromRoute();
        // Don't reset selectedInstanceIndex here - let the route query params decide
        // This fixes the issue where instanceIndex in URL was being ignored
      }
    },
    { immediate: true }
  );

  // Watch for selected instance index changes and update route
  watch(selectedInstanceIndex, (newInstanceIndex) => {
    if (!server.value?.name) return;

    const currentQuery = { ...route.query };
    const newQuery: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(currentQuery)) {
      if (value !== null && value !== undefined) {
        newQuery[key] = value as string | string[];
      }
    }

    if (newInstanceIndex === null) {
      newQuery.selection = 'template';
      delete newQuery.instanceIndex;
    } else {
      newQuery.instanceIndex = String(newInstanceIndex);
      delete newQuery.selection;
    }

    router.replace({
      name: route.name as string,
      params: route.params,
      query: newQuery
    });
  });

  return {
    activeTopTab,
    selectedInstanceIndex,
    activeInstanceTab,
    getTabFromRoute,
    navigateToTab,
    handleSelectTemplate,
    handleSelectInstance
  };
}
