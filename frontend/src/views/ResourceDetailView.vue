<template>
  <div
    class="resource-detail py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 shrink-0">
      <div class="flex items-center gap-4">
        <el-button :icon="ArrowLeft" plain @click="navigateBack" class="shrink-0">
          {{ $t('action.back') }}
        </el-button>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          Resource Details: {{ resourceName }}
        </h2>
      </div>
    </div>

    <div v-loading="loading" class="flex-1 flex flex-col gap-6 overflow-hidden">
      <!-- Meta Info Card -->
      <div
        class="bg-white dark:bg-[#1e1e1e] rounded-lg shadow p-6 shrink-0 border border-gray-200 dark:border-gray-700"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">URI</div>
            <div class="font-mono text-sm break-all select-all">{{ resourceUri }}</div>
          </div>
          <div>
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">MIME Type</div>
            <div class="font-mono text-sm">{{ resourceMimeType }}</div>
          </div>
          <div class="md:col-span-2">
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Server</div>
            <div class="text-sm">{{ serverName }}</div>
          </div>
        </div>
      </div>

      <!-- Content Preview Card -->
      <div
        class="bg-white dark:bg-[#1e1e1e] rounded-lg shadow flex-1 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
      >
        <div
          class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-[#2d2d2d]"
        >
          <div class="font-medium">Content Preview</div>
          <div class="flex gap-2">
            <el-radio-group v-model="viewMode" size="small">
              <el-radio-button value="preview">
                <el-icon class="mr-1"><View /></el-icon> Preview
              </el-radio-button>
              <el-radio-button value="source">
                <el-icon class="mr-1"><Document /></el-icon> Source
              </el-radio-button>
            </el-radio-group>
            <el-button size="small" :icon="Download" @click="downloadResource">Download</el-button>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-[#0f172a]">
          <!-- Loading State -->
          <div v-if="loading" class="h-full flex items-center justify-center text-gray-400">
            Loading content...
          </div>

          <!-- Error State -->
          <div
            v-else-if="error"
            class="h-full flex flex-col items-center justify-center text-red-500"
          >
            <el-icon class="text-4xl mb-2"><Warning /></el-icon>
            <div>{{ error }}</div>
          </div>

          <!-- Content Display -->
          <div v-else class="h-full">
            <!-- Preview Mode -->
            <div v-if="viewMode === 'preview'" class="h-full">
              <div v-if="isImage" class="h-full flex items-center justify-center">
                <img
                  :src="imageSrc"
                  class="max-w-full max-h-full object-contain rounded shadow-lg"
                />
              </div>
              <!--
                <div v-else-if="isMarkdown" class="prose dark:prose-invert max-w-none bg-white dark:bg-[#1e1e1e] p-8 rounded shadow-sm min-h-full" v-html="renderedMarkdown"></div>
                -->
              <div
                v-else
                class="bg-white dark:bg-[#1e1e1e] p-4 rounded shadow-sm h-full overflow-auto font-mono text-sm whitespace-pre-wrap"
              >
                {{ contentText }}
              </div>
            </div>

            <!-- Source Mode -->
            <div v-else class="h-full">
              <pre
                class="bg-gray-900 text-gray-100 p-4 rounded-lg h-full overflow-auto font-mono text-sm"
              ><code>{{ contentText }}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, View, Document, Download, Warning } from '@element-plus/icons-vue';
import { useServerStore } from '@stores/server';

const route = useRoute();
const router = useRouter();
const store = useServerStore();

const serverName = computed(() => route.params.name as string);
const resourceUri = computed(() => route.query.uri as string);
const resourceName = computed(() => (route.query.name as string) || 'Unknown Resource');
const resourceMimeType = computed(
  () => (route.query.mimeType as string) || 'application/octet-stream'
);

const loading = ref(false);
const error = ref<string | null>(null);
const content = ref<unknown>(null);
const viewMode = ref('preview');

const isImage = computed(() => resourceMimeType.value.startsWith('image/'));
// const isMarkdown = computed(() => resourceMimeType.value === 'text/markdown' || resourceName.value.endsWith('.md'))

const contentText = computed(() => {
  if (!content.value) return '';
  const contentVal = content.value as Record<string, unknown> | null;
  if (
    contentVal &&
    typeof contentVal === 'object' &&
    'text' in contentVal &&
    typeof contentVal.text === 'string'
  ) {
    return contentVal.text;
  }
  if (contentVal && typeof contentVal === 'object' && 'blob' in contentVal) {
    return '[Binary Data]'; // Should handle base64 if needed
  }
  return '';
});

const imageSrc = computed(() => {
  if (!isImage.value || !content.value) return '';
  const contentVal = content.value as Record<string, unknown> | null;
  if (
    contentVal &&
    typeof contentVal === 'object' &&
    'blob' in contentVal &&
    typeof contentVal.blob === 'string'
  ) {
    return `data:${resourceMimeType.value};base64,${contentVal.blob}`;
  }
  // Fallback if we somehow got text for an image (unlikely but possible with some MCP servers)
  return '';
});

/*
const renderedMarkdown = computed(() => {
  if (!contentText.value) return ''
  try {
    return DOMPurify.sanitize(marked.parse(contentText.value) as string)
  } catch (e) {
    return contentText.value
  }
})
*/

function navigateBack() {
  router.back();
}

async function loadContent() {
  loading.value = true;
  error.value = null;
  try {
    content.value = await store.readResource(serverName.value, resourceUri.value);
  } catch (e) {
    error.value = (e as Error).message || 'Failed to load resource content';
  } finally {
    loading.value = false;
  }
}

function downloadResource() {
  const element = document.createElement('a');
  const file = new Blob([contentText.value], { type: resourceMimeType.value });

  const contentVal = content.value as Record<string, unknown> | null;
  if (
    contentVal &&
    typeof contentVal === 'object' &&
    'blob' in contentVal &&
    typeof contentVal.blob === 'string'
  ) {
    // Handle binary download
    const byteCharacters = atob(contentVal.blob);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: resourceMimeType.value });
    element.href = URL.createObjectURL(blob);
  } else {
    element.href = URL.createObjectURL(file);
  }

  element.download = resourceName.value;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

onMounted(() => {
  if (resourceUri.value) {
    loadContent();
  }
});
</script>

<style scoped>
.resource-detail {
  height: calc(100vh - 64px); /* Adjust based on layout */
}
</style>
