<template>
  <div class="server-manager">
    <div class="header">
      <h2>Server Management</h2>
      <el-button type="primary" @click="dialogVisible = true">Add Server</el-button>
    </div>

    <el-alert v-if="store.error" :title="store.error" type="error" show-icon class="mb-4" />

    <el-table :data="store.servers" style="width: 100%" v-loading="store.loading">
      <el-table-column prop="name" label="Name" />
      <el-table-column prop="command" label="Command" />
      <el-table-column prop="enabled" label="Status">
        <template #default="scope">
          <el-tag :type="scope.row.enabled ? 'success' : 'danger'">
            {{ scope.row.enabled ? 'Enabled' : 'Disabled' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Actions">
        <template #default="scope">
          <el-button size="small" type="danger" @click="handleDelete(scope.row.id)">Delete</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="Add New Server" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="Name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="Command">
          <el-input v-model="form.command" />
        </el-form-item>
        <el-form-item label="Args">
            <el-input v-model="form.argsStr" placeholder="Space separated arguments" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">Cancel</el-button>
          <el-button type="primary" @click="handleSubmit">Confirm</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useServerStore } from '../stores/server.store';

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
  if (confirm('Are you sure you want to delete this server?')) {
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
</style>
