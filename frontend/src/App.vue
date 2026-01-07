<template>
  <el-config-provider :locale="elLocale" class="dark">
    <div class="app-container dark:bg-gray-900 dark:text-white h-screen w-screen overflow-hidden">
      <router-view />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'

const { locale } = useI18n()

const elLocale = computed(() => {
  return locale.value === 'zh' ? zhCn : en
})
</script>

<style>
body {
  margin: 0;
  padding: 0;
  background-color: #1a1b26; /* Dark theme background matching the image */
  color: #c0caf5;
  font-family: 'Inter', sans-serif;
}
</style>
