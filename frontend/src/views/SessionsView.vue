<template>
  <div
    class="sessions-view py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden transition-colors duration-300"
  >
    <div class="flex justify-between items-center mb-6 shrink-0">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">
        {{ $t('sessions.title') }}
      </h2>
      <el-button type="primary" @click="refresh">{{ $t('sessions.refresh') }}</el-button>
    </div>

    <div
      class="bg-white dark:bg-[#1e293b] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex-1 overflow-hidden flex flex-col"
    >
      <el-table
        :data="store.sessions"
        style="width: 100%"
        height="100%"
        v-loading="store.loading"
        class="flex-1"
      >
        <el-table-column
          prop="sessionId"
          :label="$t('sessions.sessionId')"
          min-width="300"
          show-overflow-tooltip
        />
        <el-table-column prop="clientName" :label="$t('sessions.clientName')" min-width="120" />
        <el-table-column
          prop="clientVersion"
          :label="$t('sessions.clientVersion')"
          min-width="100"
        />
        <el-table-column
          prop="protocolVersion"
          :label="$t('sessions.protocolVersion')"
          min-width="120"
        />
        <el-table-column
          prop="cwd"
          :label="$t('sessions.cwd')"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column prop="project" :label="$t('sessions.project')" min-width="150" />
        <el-table-column
          prop="userAgent"
          :label="$t('sessions.userAgent')"
          min-width="250"
          show-overflow-tooltip
        />
        <el-table-column :label="$t('sessions.createdAt')" width="180">
          <template #default="scope">
            {{ formatTime(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('sessions.lastAccessedAt')" width="180">
          <template #default="scope">
            {{ formatTime(scope.row.lastAccessedAt) }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useSessionStore } from '@stores/session';

const store = useSessionStore();

function refresh() {
  store.fetchSessions();
}

function formatTime(timestamp?: number) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString();
}

onMounted(() => {
  store.fetchSessions();
});
</script>
