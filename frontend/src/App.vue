<template>
  <el-config-provider :locale="elLocale">
    <!-- Root container handling theme bg/text - HOT RELOAD TEST -->
    <div :class="[
      'app-container h-screen w-screen overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300',
      theme === 'dark' ? 'dark' : ''
    ]">
      <Header />
      <div class="flex-1 flex overflow-hidden relative">
        <router-view />
      </div>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import Header from './components/Header.vue'
import { useTheme } from './composables/useTheme'
import { useSystemStore } from './stores/system'
import { useWebSocketStore } from './stores/websocket'

const { locale } = useI18n()
const { theme, setTheme } = useTheme()
const systemStore = useSystemStore()
const wsStore = useWebSocketStore()

const elLocale = computed(() => {
  return locale.value === 'zh' ? zhCn : en
})

onMounted(async () => {
  await systemStore.fetchConfig()

  // Apply initial config
  if (systemStore.config.system.language) {
    locale.value = systemStore.config.system.language
  }
  if (systemStore.config.system.theme) {
    setTheme(systemStore.config.system.theme as any)
  }
})

// Watch for store changes to sync global state
watch(() => systemStore.config.system.theme, (newTheme) => {
  if (newTheme && newTheme !== theme.value) {
    setTheme(newTheme as any)
  }
})

watch(() => systemStore.config.system.language, (newLang) => {
  if (newLang && newLang !== locale.value) {
    locale.value = newLang
  }
})
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', sans-serif;
}

/* Scrollbar styles for the whole app */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.dark ::-webkit-scrollbar-thumb {
  background: #475569;
}
.dark ::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>
