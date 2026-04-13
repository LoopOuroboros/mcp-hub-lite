/**
 * Composable for tool and resource dialog management
 * Handles state and logic for tool calling and resource viewing dialogs
 */

import { ref, watch, type ComputedRef, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Tool } from '@shared-models/tool.model';
import type { Resource } from '@shared-models/resource.model';

/**
 * Return type for useToolAndResourceDialogs composable
 */
export interface UseToolAndResourceDialogsReturn {
  // Dialog state
  showInstanceSelectForTool: Ref<boolean>;
  selectedInstanceForTool: Ref<number | null>;
  showCallDialog: Ref<boolean>;
  pendingTool: Ref<Tool | null>;
  showInstanceSelectForResourceDialog: Ref<boolean>;
  showInstanceSelectForResource: Ref<Resource | null>;
  selectedInstanceForResource: Ref<number | null>;

  // Methods
  callToolWithInstance: (instanceIndex: number) => void;
  viewResourceWithInstance: (instanceIndex: number) => void;
}

/**
 * Composable for managing tool and resource dialogs
 *
 * @param server - Computed reference to the selected server
 * @returns Dialog state and methods
 */
export function useToolAndResourceDialogs(
  server: ComputedRef<{ name: string } | null | undefined>
): UseToolAndResourceDialogsReturn {
  const router = useRouter();

  // State - Tool dialogs
  const pendingTool = ref<Tool | null>(null);
  const showCallDialog = ref(false);
  const showInstanceSelectForTool = ref(false);
  const selectedInstanceForTool = ref<number | null>(null);

  // State - Resource dialogs
  const showInstanceSelectForResourceDialog = ref(false);
  const showInstanceSelectForResource = ref<Resource | null>(null);
  const selectedInstanceForResource = ref<number | null>(null);

  /**
   * Views a resource
   *
   * @param resource - The resource to view
   */
  function viewResource(resource: Resource) {
    if (!server.value) return;

    router.push({
      name: 'resource-detail',
      params: { name: server.value.name },
      query: {
        uri: resource.uri,
        name: resource.name,
        mimeType: resource.mimeType
      }
    });
  }

  /**
   * Handles tool call with selected instance
   *
   * @param instanceIndex - The index of the selected instance
   */
  function callToolWithInstance(instanceIndex: number) {
    selectedInstanceForTool.value = instanceIndex;
    showInstanceSelectForTool.value = false;
    showCallDialog.value = true;
  }

  /**
   * Handles resource view with selected instance
   *
   * @param instanceIndex - The index of the selected instance
   */
  function viewResourceWithInstance(instanceIndex: number) {
    void instanceIndex;
    const resource = showInstanceSelectForResource.value;
    if (resource) {
      viewResource(resource);
    }
    showInstanceSelectForResource.value = null;
    showInstanceSelectForResourceDialog.value = false;
    selectedInstanceForResource.value = null;
  }

  // Watch for resource selection dialog trigger
  watch(showInstanceSelectForResource, (newVal) => {
    if (newVal !== null) {
      showInstanceSelectForResourceDialog.value = true;
      showInstanceSelectForResource.value = null;
    }
  });

  return {
    showInstanceSelectForTool,
    selectedInstanceForTool,
    showCallDialog,
    pendingTool,
    showInstanceSelectForResourceDialog,
    showInstanceSelectForResource,
    selectedInstanceForResource,
    callToolWithInstance,
    viewResourceWithInstance
  };
}
