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
          <el-tag :type="scope.row.enabled ? 'success' : 'danger'">
            {{ scope.row.enabled ? $t('server.enabled') : $t('server.disabled') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="$t('server.connection')">
        <template #default="scope">
           <el-tag v-if="isConnected(scope.row.id)" type="success">{{ $t('server.connected') }}</el-tag>
           <el-tag v-else-if="hasError(scope.row.id)" type="danger" :title="getError(scope.row.id)">{{ $t('server.error') }}</el-tag>
           <el-tag v-else type="info">{{ $t('server.disconnected') }}</el-tag>
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

    <el-dialog v-model="dialogVisible" :title="$t('server.add')" width="500px">
      <el-form :model="form" label-width="100px">
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
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ $t('server.cancel') }}</el-button>
          <el-button type="primary" @click="handleSubmit">{{ $t('server.confirm') }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useServerStore } from '../stores/server.store';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const store = useServerStore();
const dialogVisible = ref(false);

const form = reactive({
  name: '',
  command: '',
  argsStr: ''
});

onMounted(() => {
  store.fetchServers();
});

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
