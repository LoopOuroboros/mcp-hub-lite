<template>
  <div class="h-full w-full">
    <Dashboard v-if="!store.selectedServerId" />
    <ServerDetail v-else />
  </div>
</template>

<script setup lang="ts">
import { useServerStore } from '../stores/server'
import Dashboard from '../components/Dashboard.vue'
import ServerDetail from '../components/ServerDetail.vue'

const store = useServerStore()
</script>
