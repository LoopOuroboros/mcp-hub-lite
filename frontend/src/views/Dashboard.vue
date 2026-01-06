<template>
  <div class="dashboard">
    <div class="card">
      <h2>{{ $t('app.title') }}</h2>
      <p>{{ $t('dashboard.welcome') }}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>{{ servers.length }}</h3>
        <p>{{ $t('app.servers') }}</p>
        <div class="status-indicator">
          <span :class="`status-dot ${getOverallStatus()}`"></span>
          {{ getOverallStatusText() }}
        </div>
      </div>

      <div class="stat-card">
        <h3>{{ totalTools }}</h3>
        <p>{{ $t('app.tools') }}</p>
      </div>
    </div>

    <div class="quick-actions">
      <h3>{{ $t('dashboard.quickActions') }}</h3>
      <div class="actions-grid">
        <router-link to="/servers" class="action-button">
          {{ $t('server.title') }}
        </router-link>
        <router-link to="/tools" class="action-button">
          {{ $t('tools.title') }}
        </router-link>
        <router-link to="/settings" class="action-button">
          {{ $t('settings.title') }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServerStore } from '@/stores/server.store';
import { useToolStore } from '@/stores/tool.store';

const { t } = useI18n();
const serverStore = useServerStore();
const toolStore = useToolStore();

const servers = computed(() => serverStore.servers);
const totalTools = computed(() => toolStore.tools.length);

onMounted(() => {
  serverStore.fetchServers();
  toolStore.fetchAllTools();
});

const getOverallStatus = () => {
  if (servers.value.length === 0) return 'disconnected';

  const connectedCount = servers.value.filter(s =>
    s.id && serverStore.serverStatuses[s.id]?.connected
  ).length;

  if (connectedCount === servers.value.length) return 'connected';
  if (connectedCount > 0) return 'partial';
  return 'disconnected';
};

const getOverallStatusText = () => {
  const status = getOverallStatus();
  switch (status) {
    case 'connected': return t('dashboard.status.allConnected');
    case 'partial': return t('dashboard.status.partiallyConnected');
    case 'disconnected': return t('dashboard.status.disconnected');
    default: return t('dashboard.status.unknown');
  }
};
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin: 30px 0;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.stat-card h3 {
  font-size: 2em;
  margin-bottom: 8px;
  color: var(--primary-color);
}

.status-indicator {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.connected {
  background-color: var(--success-color);
}

.status-dot.partial {
  background-color: var(--warning-color);
}

.status-dot.disconnected {
  background-color: var(--error-color);
}

.quick-actions h3 {
  margin-bottom: 16px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.action-button {
  display: block;
  padding: 16px;
  background: var(--background-color);
  border-radius: 8px;
  text-align: center;
  text-decoration: none;
  color: var(--text-color);
  font-weight: 500;
  transition: all 0.2s;
}

.action-button:hover {
  background: #eef2f7;
  transform: translateY(-2px);
}
</style>