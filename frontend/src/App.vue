<template>
  <el-container>
    <el-header>
      <div class="logo">
        <h1>MCP Hub Lite</h1>
      </div>
      <el-menu mode="horizontal" :router="true" :default-active="$route.path" class="nav-menu">
        <el-menu-item index="/servers">Servers</el-menu-item>
        <el-menu-item index="/tools">Tools</el-menu-item>
      </el-menu>
    </el-header>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>

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
</style>
