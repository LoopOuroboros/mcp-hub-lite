<template>
  <div class="server-manager">
    <div class="header">
      <h2>{{ $t('server.title') }}</h2>
      <el-button type="primary" @click="dialogVisible = true">{{ $t('server.add') }}</el-button>
    </div>

    <el-alert v-if="store.error" :title="store.error" type="error" show-icon class="mb-4" />

    <el-table :data="store.servers" style="width: 100%" v-loading="store.loading">
      <el-table-column prop="name" :label="$t('server.name')" />
      <el-table-column prop="command" :label="$t('server.command')" />
      <el-table-column prop="enabled" :label="$t('server.status')">
        <template #default="scope">
          <StatusBadge :enabled="scope.row.enabled" />
        </template>
      </el-table-column>
      <el-table-column :label="$t('server.connection')">
        <template #default="scope">
          <StatusBadge
            :connected="isConnected(scope.row.id)"
            :error="hasError(scope.row.id) ? getError(scope.row.id) : undefined"
          />
        </template>
      </el-table-column>
      <el-table-column :label="$t('server.actions')" width="250">
        <template #default="scope">
          <el-button 
            size="small" 
            :type="isConnected(scope.row.id) ? 'warning' : 'success'" 
            @click="handleConnection(scope.row)"
            :loading="store.loading"
          >
            {{ isConnected(scope.row.id) ? $t('server.disconnect') : $t('server.connect') }}
          </el-button>
          <el-button size="small" type="danger" @click="handleDelete(scope.row.id)">{{ $t('server.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="$t('server.add')" width="600px">
      <el-tabs v-model="activeTab">
        <el-tab-pane :label="$t('server.manualInput')" name="manual">
          <el-form :model="form" label-width="100px" class="mt-4">
            <el-form-item :label="$t('server.name')">
              <el-input v-model="form.name" />
            </el-form-item>
            <el-form-item :label="$t('server.command')">
              <el-input v-model="form.command" />
            </el-form-item>
            <el-form-item :label="$t('server.args')">
                <el-input v-model="form.argsStr" :placeholder="$t('server.placeholder.args')" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane :label="$t('server.jsonImport')" name="json">
          <div class="json-import-container mt-4">
            <el-input
              v-model="jsonInput"
              type="textarea"
              :rows="10"
              :placeholder="$t('server.pasteJson')"
              class="mb-4"
            />
            <el-button type="primary" @click="handleParseJson" style="width: 100%">
              {{ $t('server.parseAndFill') }}
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ $t('server.cancel') }}</el-button>
          <el-button type="primary" @click="handleSubmit" :disabled="activeTab === 'json'">{{ $t('server.confirm') }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, watch } from 'vue';
import { useServerStore } from '../stores/server.store';
import { useI18n } from 'vue-i18n';
import StatusBadge from '../components/StatusBadge.vue';
import { ElMessage } from 'element-plus';

const { t } = useI18n();
const store = useServerStore();
const dialogVisible = ref(false);
const activeTab = ref('manual');
const jsonInput = ref('');

const form = reactive({
  name: '',
  command: '',
  argsStr: ''
});

// Reset tabs when dialog opens/closes
watch(dialogVisible, (val) => {
  if (val) {
    activeTab.value = 'manual';
    jsonInput.value = '';
  }
});

onMounted(() => {
  store.fetchServers();
});

const handleParseJson = () => {
  try {
    const config = JSON.parse(jsonInput.value);
    let serverName = '';
    let serverConfig: any = null;

    if (config.mcpServers) {
      // Standard config format: { "mcpServers": { "name": { ... } } }
      const keys = Object.keys(config.mcpServers);
      if (keys.length > 0) {
        // Take the first server found
        const firstKey = keys[0];
        if (firstKey) {
            serverName = firstKey;
            serverConfig = config.mcpServers[serverName];
        }
      }
    } else if (config.command) {
      // Simplified config object: { "command": "...", "args": ... }
      serverConfig = config;
    } else {
       // Maybe just a key-value pair { "name": { "command": ... } }
       const keys = Object.keys(config);
       if (keys.length === 1) {
           const firstKey = keys[0];
           if (firstKey && config[firstKey]?.command) {
               serverName = firstKey;
               serverConfig = config[serverName];
           }
       }
    }

    if (serverConfig && serverConfig.command) {
      if (serverName) form.name = serverName;
      form.command = serverConfig.command;

      if (Array.isArray(serverConfig.args)) {
        form.argsStr = serverConfig.args.join(' ');
      } else if (typeof serverConfig.args === 'string') {
        form.argsStr = serverConfig.args;
      } else {
        form.argsStr = '';
      }

      activeTab.value = 'manual'; // Switch back to form
      ElMessage.success(t('server.parseAndFill') + ' Success');
    } else {
      ElMessage.error(t('server.noServerFound'));
    }
  } catch (e: any) {
    ElMessage.error(t('server.parseError', { msg: e.message }));
  }
};

const handleDelete = async (id: string) => {
  if (confirm(t('server.deleteConfirm'))) {
    await store.removeServer(id);
  }
};

const handleSubmit = async () => {
  const args = form.argsStr.split(' ').filter(a => a.trim().length > 0);
  await store.addServer({
    name: form.name,
    command: form.command,
    args: args,
    enabled: true
  });
  dialogVisible.value = false;
  // Reset form
  form.name = '';
  form.command = '';
  form.argsStr = '';
};

function isConnected(id: string) {
    return store.serverStatuses[id]?.connected || false;
}
function hasError(id: string) {
     return !!store.serverStatuses[id]?.error;
}
function getError(id: string) {
     return store.serverStatuses[id]?.error;
}
async function handleConnection(server: any) {
    if (isConnected(server.id)) {
        await store.disconnectServer(server.id);
    } else {
        await store.connectServer(server.id);
    }
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.mb-4 {
    margin-bottom: 1rem;
}
.error-text {
    color: red;
    font-size: 12px;
    margin-top: 4px;
}
</style>
