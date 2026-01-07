<template>
  <div class="common-layout h-full">
    <el-container class="h-full">
      <el-aside width="300px" class="h-full">
        <Sidebar @add-server="showAddModal = true" />
      </el-aside>
      <el-container>
        <el-main class="bg-[#0f172a] text-white p-0">
          <Dashboard v-if="!store.selectedServerId" />
          <ServerDetail v-else />
        </el-main>
      </el-container>
    </el-container>

    <AddServerModal v-model="showAddModal" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useServerStore } from '../stores/server'
import Sidebar from '../components/Sidebar.vue'
import Dashboard from '../components/Dashboard.vue'
import ServerDetail from '../components/ServerDetail.vue'
import AddServerModal from '../components/AddServerModal.vue'

const store = useServerStore()
const showAddModal = ref(false)
</script>

<style scoped>
/* Reset Element Plus container styles if needed */
.el-container {
  height: 100%;
}
.el-main {
  height: 100%;
  overflow: hidden;
}
</style>
