<template>
  <div class="about">
    <div class="card">
      <h2>{{ $t('about.title') }}</h2>

      <div class="info-section">
        <h3>{{ $t('about.overview.title') }}</h3>
        <p>{{ $t('about.overview.description') }}</p>
      </div>

      <div class="info-section">
        <h3>{{ $t('about.features.title') }}</h3>
        <ul>
          <li>{{ $t('about.features.item1') }}</li>
          <li>{{ $t('about.features.item2') }}</li>
          <li>{{ $t('about.features.item3') }}</li>
          <li>{{ $t('about.features.item4') }}</li>
          <li>{{ $t('about.features.item5') }}</li>
          <li>{{ $t('about.features.item6') }}</li>
        </ul>
      </div>

      <div class="info-section">
        <h3>{{ $t('about.architecture.title') }}</h3>
        <p>{{ $t('about.architecture.description') }}</p>
      </div>

      <div class="info-section">
        <h3>{{ $t('about.version.title') }}</h3>
        <div class="version-info">
          <div class="version-item">
            <span class="label">{{ $t('about.version.mcpHubLite') }}:</span>
            <span class="value">0.0.1</span>
          </div>
          <div class="version-item">
            <span class="label">{{ $t('about.version.vue') }}:</span>
            <span class="value">{{ vueVersion }}</span>
          </div>
          <div class="version-item">
            <span class="label">{{ $t('about.version.nodejs') }}:</span>
            <span class="value">{{ nodeVersion }}</span>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h3>{{ $t('about.license.title') }}</h3>
        <p>{{ $t('about.license.type') }}</p>
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