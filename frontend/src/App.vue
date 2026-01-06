<template>
  <el-container>
    <el-header>
      <div class="logo">
        <h1>{{ $t('app.title') }}</h1>
      </div>
      <el-menu mode="horizontal" :router="true" :default-active="$route.path" class="nav-menu">
        <el-menu-item index="/">{{ $t('dashboard.title') }}</el-menu-item>
        <el-menu-item index="/servers">{{ $t('app.servers') }}</el-menu-item>
        <el-menu-item index="/tools">{{ $t('app.tools') }}</el-menu-item>
        <el-menu-item index="/settings">{{ $t('settings.title') }}</el-menu-item>
        <el-menu-item index="/about">{{ $t('about.title') }}</el-menu-item>
      </el-menu>
      <div class="lang-switch">
        <el-dropdown @command="handleLangChange">
          <span class="el-dropdown-link">
            {{ currentLang === 'zh' ? '中文' : 'English' }}
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="zh">中文</el-dropdown-item>
              <el-dropdown-item command="en">English</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const { locale } = useI18n();
const currentLang = computed(() => locale.value);

const handleLangChange = (lang: string) => {
  locale.value = lang;
};
</script>

<style>
body {
  margin: 0;
  font-family: Arial, sans-serif;
}
.el-header {
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  padding: 0 20px;
}
.logo h1 {
  margin: 0;
  margin-right: 40px;
  font-size: 20px;
}
.nav-menu {
  flex: 1;
  border-bottom: none !important;
}
.lang-switch {
  margin-left: 20px;
  cursor: pointer;
}
.el-dropdown-link {
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
}
</style>
