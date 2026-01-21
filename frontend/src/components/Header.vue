<template>
  <header class="h-14 px-4 flex items-center justify-between bg-white dark:bg-[#1e293b] border-b border-gray-200 dark:border-gray-700 transition-colors duration-300 shrink-0 z-50">
    <!-- Left: Logo & Nav -->
    <div class="flex items-center gap-8">
      <!-- Logo -->
      <div class="flex items-center gap-2 font-bold text-xl text-gray-900 dark:text-white cursor-pointer" @click="navigateTo('dashboard')">
        <el-icon class="text-blue-600 dark:text-blue-400"><ElementPlus /></el-icon>
        <span>MCP Hub Lite</span>
      </div>

      <!-- Main Navigation -->
      <nav class="hidden md:flex items-center gap-1">
        <button 
          @click="navigateTo('dashboard')"
          class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          :class="[isDashboardActive ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800']"
        >
          {{ $t('sidebar.dashboard') }}
        </button>
        <button 
          @click="navigateTo('tools')"
          class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          :class="[isToolsActive ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800']"
        >
          {{ $t('tools.title') }}
        </button>
        <button 
          @click="navigateTo('clients')"
          class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          :class="[isClientsActive ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800']"
        >
          {{ $t('sidebar.clients') }}
        </button>
        <button 
          @click="navigateTo('settings')"
          class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          :class="[isSettingsActive ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800']"
        >
          {{ $t('sidebar.settings') }}
        </button>
      </nav>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-3">
      <!-- Theme Switcher -->
      <el-dropdown trigger="click" @command="handleThemeCommand">
        <button class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors flex items-center justify-center">
          <el-icon v-if="theme === 'light'" :size="18"><Sunny /></el-icon>
          <el-icon v-else-if="theme === 'dark'" :size="18"><Moon /></el-icon>
          <el-icon v-else :size="18"><Monitor /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="light" :class="{ 'text-blue-500': theme === 'light' }">
              <el-icon><Sunny /></el-icon> Light
            </el-dropdown-item>
            <el-dropdown-item command="dark" :class="{ 'text-blue-500': theme === 'dark' }">
              <el-icon><Moon /></el-icon> Dark
            </el-dropdown-item>
            <el-dropdown-item command="system" :class="{ 'text-blue-500': theme === 'system' }">
              <el-icon><Monitor /></el-icon> System
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- Language Switcher -->
      <el-dropdown trigger="click" @command="handleLangCommand">
        <button class="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors text-sm font-medium">
          {{ locale === 'zh' ? '中文' : 'EN' }}
          <el-icon :size="12"><ArrowDown /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="en" :class="{ 'text-blue-500': locale === 'en' }">English</el-dropdown-item>
            <el-dropdown-item command="zh" :class="{ 'text-blue-500': locale === 'zh' }">中文</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTheme, type Theme } from '../composables/useTheme'
import { useServerStore } from '../stores/server'
import { useSystemStore } from '../stores/system'
import { Sunny, Moon, Monitor, ArrowDown, ElementPlus } from '@element-plus/icons-vue'

const { locale } = useI18n()
const { theme, setTheme } = useTheme()
const store = useServerStore()
const systemStore = useSystemStore()
const router = useRouter()
const route = useRoute()

const isDashboardActive = computed(() => route.name === 'dashboard' && !store.selectedServerId)
const isToolsActive = computed(() => route.name === 'tools')
const isClientsActive = computed(() => route.name === 'clients')
const isSettingsActive = computed(() => route.name === 'settings')

const handleThemeCommand = (command: string) => {
  setTheme(command as Theme)
  systemStore.updateConfig({ theme: command })
}

const handleLangCommand = (command: string) => {
  locale.value = command
  systemStore.updateConfig({ language: command })
}

const navigateTo = (name: string) => {
  store.selectedServerId = null
  router.push({ name })
}
</script>
