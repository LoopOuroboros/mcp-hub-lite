<template>
  <div class="tag-manager">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ $t('settings.tagDefinitions') }}
      </h3>
      <el-button type="primary" @click="openAddDialog">
        <el-icon class="mr-1"><Plus /></el-icon>
        {{ $t('settings.addTag') }}
      </el-button>
    </div>

    <div
      v-if="tagDefinitions.length === 0"
      class="text-center py-8 text-gray-500 dark:text-gray-400"
    >
      {{ $t('settings.noTagsDefined') }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="tag in tagDefinitions"
        :key="tag.key"
        class="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-900 dark:text-white">{{ tag.key }}</span>
            <el-tag size="small" type="info">{{ tag.type }}</el-tag>
          </div>
          <div v-if="tag.description" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ tag.description }}
          </div>
          <div v-if="tag.type === 'enum' && tag.values && tag.values.length > 0" class="mt-2">
            <div class="flex flex-wrap gap-1">
              <el-tag v-for="value in tag.values" :key="value" size="small" type="success">
                {{ value }}
              </el-tag>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 ml-4">
          <el-button size="small" @click="openEditDialog(tag)">
            <el-icon><Edit /></el-icon>
          </el-button>
          <el-button size="small" type="danger" @click="confirmDelete(tag)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? $t('settings.editTag') : $t('settings.addTag')"
      width="500px"
      class="custom-dialog"
      :before-close="resetForm"
    >
      <el-form :model="form" :rules="formRules" ref="formRef" label-position="top">
        <el-form-item :label="$t('settings.tagKey')" prop="key">
          <el-input
            v-model="form.key"
            :placeholder="$t('settings.tagKeyPlaceholder')"
            :disabled="isEditing"
          />
        </el-form-item>

        <el-form-item :label="$t('settings.tagDescription')" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            :placeholder="$t('settings.tagDescriptionPlaceholder')"
          />
        </el-form-item>

        <el-form-item :label="$t('settings.tagType')" prop="type">
          <el-select v-model="form.type" class="w-full">
            <el-option label="String" value="string" />
            <el-option label="Number" value="number" />
            <el-option label="Boolean" value="boolean" />
            <el-option label="Enum" value="enum" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.type === 'enum'" :label="$t('settings.tagValues')" prop="values">
          <el-select
            v-model="form.values"
            multiple
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            :placeholder="$t('settings.tagValuesPlaceholder')"
            class="w-full"
          >
            <el-option v-for="value in form.values" :key="value" :label="value" :value="value" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="resetForm">{{ $t('action.cancel') }}</el-button>
          <el-button type="primary" @click="saveTag" :loading="isSubmitting">
            {{ $t('action.save') }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Delete Confirmation -->
    <el-dialog
      v-model="deleteDialogVisible"
      :title="$t('settings.deleteTag')"
      width="400px"
      class="custom-dialog"
    >
      <p class="text-gray-600 dark:text-gray-300">{{ $t('settings.deleteTagConfirm') }}</p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="deleteDialogVisible = false">{{ $t('action.cancel') }}</el-button>
          <el-button type="danger" @click="deleteTag" :loading="isSubmitting">
            {{ $t('action.delete') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Plus, Edit, Delete } from '@element-plus/icons-vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import type { TagDefinition } from '@stores/system';

const props = defineProps<{
  modelValue?: TagDefinition[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: TagDefinition[]): void;
}>();

const { t } = useI18n();

const tagDefinitions = computed({
  get: () => props.modelValue || [],
  set: (val) => emit('update:modelValue', val)
});

const dialogVisible = ref(false);
const deleteDialogVisible = ref(false);
const isEditing = ref(false);
const isSubmitting = ref(false);
const formRef = ref<FormInstance>();
const editingTag = ref<TagDefinition | null>(null);

const form = ref<TagDefinition>({
  key: '',
  description: '',
  type: 'string',
  values: []
});

const formRules: FormRules<TagDefinition> = {
  key: [
    { required: true, message: 'Tag key is required', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9-]*$/,
      message: 'Key must start with a letter and contain only letters, numbers, and hyphens',
      trigger: 'blur'
    }
  ],
  type: [{ required: true, message: 'Tag type is required', trigger: 'change' }],
  values: [
    {
      validator: (_rule, value, callback) => {
        if (form.value.type === 'enum' && (!value || value.length === 0)) {
          callback(new Error('At least one value is required for enum type'));
        } else {
          callback();
        }
      },
      trigger: 'change'
    }
  ]
};

function openAddDialog() {
  isEditing.value = false;
  editingTag.value = null;
  form.value = {
    key: '',
    description: '',
    type: 'string',
    values: []
  };
  dialogVisible.value = true;
}

function openEditDialog(tag: TagDefinition) {
  isEditing.value = true;
  editingTag.value = tag;
  form.value = { ...tag };
  dialogVisible.value = true;
}

function resetForm() {
  dialogVisible.value = false;
  formRef.value?.resetFields();
  form.value = {
    key: '',
    description: '',
    type: 'string',
    values: []
  };
  isEditing.value = false;
  editingTag.value = null;
}

function saveTag() {
  formRef.value?.validate((valid) => {
    if (!valid) return;

    isSubmitting.value = true;

    try {
      if (isEditing.value && editingTag.value) {
        // Update existing tag
        const index = tagDefinitions.value.findIndex((t) => t.key === editingTag.value!.key);
        if (index !== -1) {
          const newTags = [...tagDefinitions.value];
          newTags[index] = { ...form.value };
          tagDefinitions.value = newTags;
        }
      } else {
        // Check for duplicate key
        if (tagDefinitions.value.some((t) => t.key === form.value.key)) {
          ElMessage.error('Tag key already exists');
          isSubmitting.value = false;
          return;
        }
        // Add new tag
        tagDefinitions.value = [...tagDefinitions.value, { ...form.value }];
      }

      ElMessage.success(t('action.saved'));
      resetForm();
    } finally {
      isSubmitting.value = false;
    }
  });
}

function confirmDelete(tag: TagDefinition) {
  editingTag.value = tag;
  deleteDialogVisible.value = true;
}

function deleteTag() {
  if (!editingTag.value) return;

  isSubmitting.value = true;

  try {
    tagDefinitions.value = tagDefinitions.value.filter((t) => t.key !== editingTag.value!.key);
    ElMessage.success(t('action.saved'));
    deleteDialogVisible.value = false;
    editingTag.value = null;
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style>
/* Adapt to dark mode, apply dark background only in dark mode */
html.dark .custom-dialog {
  --el-dialog-bg-color: #1e293b;
  border: 1px solid #334155;
}

/* Ensure title and close button colors are correct */
html.dark .custom-dialog .el-dialog__title {
  color: white;
}
</style>
