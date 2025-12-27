<template>
  <el-container>
    <el-header>
      <h1>MCP Hub Lite</h1>
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
  background-color: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
}
</style>
