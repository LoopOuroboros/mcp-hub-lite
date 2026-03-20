<!--
  InstanceCardList Component

  Displays a vertical list of server instance cards with:
  - Instance index and display name (#index [displayName])
  - Status indicator (online/offline/starting/error)
  - Edit display name functionality
  - Delete instance functionality
  - Add new instance button
  - Reassign indexes button

  This component provides the instance management UI for the server detail view.
-->
<template>
  <div class="instance-card-list">
    <!-- Reassign Indexes Button -->
    <div class="mb-4 flex justify-between items-center">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ $t('serverDetail.instances.title') }}
      </h3>
      <el-button size="small" :icon="Refresh" plain @click="handleReassignIndexes">
        {{ $t('serverDetail.instances.reassignIndexes') }}
      </el-button>
    </div>

    <!-- Instance Cards -->
    <div class="flex flex-col gap-3 mb-4">
      <div
        v-for="instance in sortedInstances"
        :key="instance.index ?? 0"
        class="instance-card p-4 rounded-lg border transition-all duration-200 cursor-pointer"
        :class="getCardClass(instance.index ?? 0)"
        @click="handleSelect(instance.index ?? 0)"
      >
        <div class="flex items-center justify-between">
          <!-- Left: Instance Info -->
          <div class="flex items-center gap-3">
            <!-- Status Dot -->
            <div
              class="w-3 h-3 rounded-full"
              :class="getStatusDotClass(getInstanceStatus(instance))"
            ></div>

            <!-- Instance Name -->
            <div class="flex items-center gap-2">
              <template v-if="!isEditingDisplayName || editingIndex !== instance.index">
                <span class="font-mono text-sm text-gray-500 dark:text-gray-400">
                  #{{ instance.index ?? 0 }}
                </span>
                <span class="font-medium text-gray-900 dark:text-white">
                  [{{ instance.displayName || $t('serverDetail.instances.unnamed') }}]
                </span>
              </template>
              <template v-else>
                <el-input
                  v-model="editingDisplayName"
                  size="small"
                  @keyup.enter="saveDisplayName(instance.index ?? 0)"
                  @keyup.escape="cancelEditDisplayName"
                  ref="displayNameInputRef"
                  @blur="saveDisplayName(instance.index ?? 0)"
                  class="max-w-xs"
                />
              </template>
            </div>

            <!-- Status Badge -->
            <div
              class="px-2 py-0.5 rounded-full text-xs"
              :class="getStatusBadgeClass(getInstanceStatus(instance))"
            >
              {{ $t(`serverDetail.status.${getInstanceStatus(instance)}`) }}
            </div>
          </div>

          <!-- Right: Actions -->
          <div class="flex items-center gap-2" @click.stop>
            <template v-if="!isEditingDisplayName || editingIndex !== instance.index">
              <!-- Edit Display Name -->
              <el-button
                :icon="Edit"
                circle
                plain
                size="small"
                @click="startEditDisplayName(instance)"
              />
              <!-- Delete Instance -->
              <el-button
                :icon="Delete"
                circle
                plain
                size="small"
                type="danger"
                @click="handleDelete(instance.index ?? 0)"
              />
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Instance Button -->
    <el-button :icon="Plus" class="w-full" @click="handleAdd">
      {{ $t('serverDetail.instances.add') }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Edit, Delete, Plus, Refresh } from '@element-plus/icons-vue';
import type { ServerInstanceConfig } from '@shared-models/server.model';

/**
 * Extended instance interface with status information
 */
interface InstanceWithStatus extends ServerInstanceConfig {
  status?: string;
}

/**
 * Props interface for InstanceCardList component
 *
 * @interface InstanceCardListProps
 * @property {InstanceWithStatus[]} instances - Array of server instances
 * @property {number | null} selectedIndex - Currently selected instance index
 * @property {string} serverName - Name of the server
 */
interface InstanceCardListProps {
  instances: InstanceWithStatus[];
  selectedIndex: number | null;
  serverName: string;
}

/**
 * Emits interface for InstanceCardList component
 *
 * @interface InstanceCardListEmits
 * @property {function} select - Emitted when an instance is selected
 * @property {function} add - Emitted when add instance button is clicked
 * @property {function} update-display-name - Emitted when display name is updated
 * @property {function} delete - Emitted when delete instance button is clicked
 * @property {function} reassign-indexes - Emitted when reassign indexes button is clicked
 */
interface InstanceCardListEmits {
  (e: 'select', index: number): void;
  (e: 'add'): void;
  (e: 'update-display-name', index: number, displayName: string): void;
  (e: 'delete', index: number): void;
  (e: 'reassign-indexes'): void;
}

const props = defineProps<InstanceCardListProps>();
const emit = defineEmits<InstanceCardListEmits>();

// Editing state
const isEditingDisplayName = ref(false);
const editingIndex = ref<number | null>(null);
const editingDisplayName = ref('');
const displayNameInputRef = ref();

/**
 * Computed property that returns instances sorted by index
 */
const sortedInstances = computed(() => {
  return [...props.instances].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
});

/**
 * Gets the status of an instance
 *
 * @param {InstanceWithStatus} instance - The instance to get status for
 * @returns {string} The instance status
 */
function getInstanceStatus(instance: InstanceWithStatus): string {
  return instance.status || 'offline';
}

/**
 * Gets CSS class names for the instance card based on selection state
 *
 * @param {number} index - The instance index
 * @returns {string} CSS class names
 */
function getCardClass(index: number) {
  const isSelected = props.selectedIndex === index;
  return isSelected
    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm';
}

/**
 * Gets CSS class names for status dot based on status
 *
 * @param {string} status - The instance status
 * @returns {string} CSS class names
 */
function getStatusDotClass(status: string) {
  switch (status) {
    case 'online':
      return 'bg-green-500';
    case 'error':
      return 'bg-red-500';
    case 'starting':
    case 'stopping':
      return 'bg-yellow-500';
    case 'offline':
    default:
      return 'bg-gray-400';
  }
}

/**
 * Gets CSS class names for status badge based on status
 *
 * @param {string} status - The instance status
 * @returns {string} CSS class names
 */
function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'online':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'error':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'starting':
    case 'stopping':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'offline':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

/**
 * Handles instance selection
 *
 * @param {number} index - The selected instance index
 */
function handleSelect(index: number) {
  emit('select', index);
}

/**
 * Handles add instance button click
 */
function handleAdd() {
  emit('add');
}

/**
 * Starts editing the display name of an instance
 *
 * @param {InstanceWithStatus} instance - The instance to edit
 */
function startEditDisplayName(instance: InstanceWithStatus) {
  isEditingDisplayName.value = true;
  editingIndex.value = instance.index ?? null;
  editingDisplayName.value = instance.displayName || '';
  setTimeout(() => {
    displayNameInputRef.value?.focus();
  }, 100);
}

/**
 * Saves the edited display name
 *
 * @param {number} index - The instance index
 */
function saveDisplayName(index: number) {
  if (editingDisplayName.value.trim()) {
    emit('update-display-name', index, editingDisplayName.value.trim());
  }
  cancelEditDisplayName();
}

/**
 * Cancels display name editing
 */
function cancelEditDisplayName() {
  isEditingDisplayName.value = false;
  editingIndex.value = null;
  editingDisplayName.value = '';
}

/**
 * Handles delete instance button click with confirmation
 *
 * @param {number} index - The instance index to delete
 */
function handleDelete(index: number) {
  emit('delete', index);
}

/**
 * Handles reassign indexes button click
 */
function handleReassignIndexes() {
  emit('reassign-indexes');
}
</script>

<style scoped>
.instance-card-list {
  @apply w-full;
}

.instance-card {
  @apply bg-white dark:bg-gray-800;
}

.instance-card:hover {
  @apply bg-gray-50 dark:bg-gray-750;
}
</style>
