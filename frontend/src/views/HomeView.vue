<template>
  <div class="flex w-full h-full">
    <!-- Sidebar / Server List -->
    <aside class="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] transition-colors duration-300">
      <Sidebar @add-server="openAddModal('form')" />
    </aside>
    
    <!-- Main Content Area -->
    <main class="flex-1 h-full overflow-hidden bg-gray-50 dark:bg-[#0f172a] relative transition-colors duration-300">
      <Dashboard v-if="!store.selectedServerId" />
      <ServerDetail v-else />
    </main>

    <AddServerModal v-model="showAddModal" :initial-mode="addModalMode" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useServerStore } from '../stores/server'
import Sidebar from '../components/Sidebar.vue'
import Dashboard from '../components/Dashboard.vue'
import ServerDetail from '../components/ServerDetail.vue'
import AddServerModal from '../components/AddServerModal.vue'
import { ElMessage } from 'element-plus'

const store = useServerStore()
const showAddModal = ref(false)
const addModalMode = ref<'form' | 'json'>('form')

onMounted(() => {
  store.fetchServers()
})

watch(() => store.error, (newError) => {
  if (newError) {
    ElMessage.error(newError)
  }
})

function openAddModal(mode: 'form' | 'json') {
  addModalMode.value = mode
  showAddModal.value = true
}
</script>
