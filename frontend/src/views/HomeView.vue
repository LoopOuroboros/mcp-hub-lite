<template>
  <div class="flex w-full h-full">
    <!-- Main Content Area -->
    <main class="flex-1 h-full overflow-hidden bg-gray-50 dark:bg-[#0f172a] relative transition-colors duration-300">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useServerStore } from '@stores/server'
import { ElMessage } from 'element-plus'

const store = useServerStore()

onMounted(() => {
  store.fetchServers()
})

watch(() => store.error, (newError) => {
  if (newError) {
    ElMessage.error(newError)
  }
})
</script>
