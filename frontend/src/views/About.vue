<template>
  <div class="about">
    <div class="card">
      <h2>About MCP Hub Lite</h2>

      <div class="info-section">
        <h3>Overview</h3>
        <p>
          MCP Hub Lite is a lightweight MCP (Model Context Protocol) gateway system designed for independent developers.
          It provides a simple and efficient way to manage multiple MCP servers and tools through a unified interface.
        </p>
      </div>

      <div class="info-section">
        <h3>Features</h3>
        <ul>
          <li>Manage multiple MCP servers</li>
          <li>Discover and explore MCP tools</li>
          <li>Simple configuration management</li>
          <li>Lightweight single-process architecture</li>
          <li>Web-based dashboard interface</li>
          <li>Command-line interface with 6 core commands</li>
        </ul>
      </div>

      <div class="info-section">
        <h3>Architecture</h3>
        <p>
          Built with Vue 3, TypeScript, and Fastify, MCP Hub Lite follows a simplified single-process architecture
          that eliminates unnecessary complexity while maintaining essential functionality.
        </p>
      </div>

      <div class="info-section">
        <h3>Version Information</h3>
        <div class="version-info">
          <div class="version-item">
            <span class="label">MCP Hub Lite:</span>
            <span class="value">0.0.1</span>
          </div>
          <div class="version-item">
            <span class="label">Vue:</span>
            <span class="value">{{ vueVersion }}</span>
          </div>
          <div class="version-item">
            <span class="label">Node.js:</span>
            <span class="value">{{ nodeVersion }}</span>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h3>License</h3>
        <p>MIT License</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const vueVersion = ref('3.x');
const nodeVersion = ref('Unknown');

onMounted(() => {
  // Node version would need to come from backend API
  fetch('/web/health')
    .then(response => response.json())
    .then(data => {
      if (data.nodeVersion) {
        nodeVersion.value = data.nodeVersion;
      }
    })
    .catch(() => {
      // Ignore errors
    });
});
</script>

<style scoped>
.about {
  padding: 20px;
}

.info-section {
  margin-bottom: 24px;
}

.info-section h3 {
  margin-bottom: 12px;
  color: var(--text-color);
}

.info-section p,
.info-section ul {
  line-height: 1.6;
}

.info-section ul {
  padding-left: 20px;
}

.info-section li {
  margin-bottom: 8px;
}

.version-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.version-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.version-item .label {
  font-weight: 500;
  color: var(--text-color);
}

.version-item .value {
  color: var(--info-color);
}
</style>