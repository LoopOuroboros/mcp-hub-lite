<template>
  <div class="h-full overflow-y-auto">
    <el-table :data="resources || []" style="width: 100%" class="custom-table">
      <el-table-column prop="name" :label="$t('serverDetail.resources.name')" width="200">
        <template #default="{ row }">
          <div class="flex items-center gap-2">
            <el-icon><Document /></el-icon>
            <span class="font-medium">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="uri" :label="$t('serverDetail.resources.uri')" min-width="300" />
      <el-table-column prop="mimeType" :label="$t('serverDetail.resources.mimeType')" width="150" />
      <el-table-column label="" width="100" align="right">
        <template #default="{ row }">
          <el-button size="small" plain @click="handleViewResource(row)">{{
            $t('action.view')
          }}</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="!resources || resources.length === 0" class="text-center py-8 text-gray-500">
      {{ $t('serverDetail.resources.none') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { Document } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import type { Resource } from '@shared-models/resource.model';

interface Props {
  resources: Resource[] | undefined;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'view-resource', resource: Resource): void;
}>();

useI18n();

function handleViewResource(resource: Resource) {
  emit('view-resource', resource);
}
</script>
