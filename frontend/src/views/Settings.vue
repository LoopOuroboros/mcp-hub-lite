<template>
  <div class="settings">
    <div class="card">
      <h2>{{ $t('settings.title') }}</h2>

      <div class="setting-group">
        <h3>{{ $t('settings.general.title') }}</h3>

        <div class="setting-item">
          <label for="language">{{ $t('settings.general.language') }}</label>
          <select id="language" v-model="selectedLanguage" @change="changeLanguage">
            <option value="en">{{ $t('settings.languages.en') }}</option>
            <option value="zh">{{ $t('settings.languages.zh') }}</option>
          </select>
        </div>
      </div>

      <div class="setting-group">
        <h3>{{ $t('settings.serverConfig.title') }}</h3>

        <div class="setting-item">
          <label for="autoConnect">{{ $t('settings.serverConfig.autoConnect') }}</label>
          <input type="checkbox" id="autoConnect" v-model="autoConnect" @change="saveAutoConnect">
        </div>
      </div>

      <div class="setting-group">
        <h3>{{ $t('settings.exportImport.title') }}</h3>

        <div class="setting-item">
          <button @click="exportConfig" class="button button--primary">
            {{ $t('settings.exportImport.exportButton') }}
          </button>
          <button @click="importConfig" class="button" style="margin-left: 10px;">
            {{ $t('settings.exportImport.importButton') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { locale, t } = useI18n();
const selectedLanguage = ref(locale.value);
const autoConnect = ref(false);

const changeLanguage = () => {
  locale.value = selectedLanguage.value;
  // Save to localStorage
  localStorage.setItem('mcp-hub-language', selectedLanguage.value);
};

const saveAutoConnect = () => {
  localStorage.setItem('mcp-hub-auto-connect', autoConnect.value.toString());
};

const exportConfig = async () => {
  try {
    const response = await fetch('/web/config/export');
    if (!response.ok) throw new Error('Failed to export config');

    const config = await response.json();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mcp-hub-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
    alert(t('settings.exportImport.exportFailed'));
  }
};

const importConfig = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const config = JSON.parse(text);

      const response = await fetch('/web/config/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!response.ok) throw new Error('Failed to import config');
      alert(t('settings.exportImport.importSuccess'));
      location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      alert(t('settings.exportImport.importFailed'));
    }
  };
  input.click();
};

onMounted(() => {
  // Load saved settings
  const savedLang = localStorage.getItem('mcp-hub-language');
  if (savedLang) {
    selectedLanguage.value = savedLang;
    locale.value = savedLang;
  }

  const savedAutoConnect = localStorage.getItem('mcp-hub-auto-connect');
  if (savedAutoConnect) {
    autoConnect.value = savedAutoConnect === 'true';
  }
});
</script>

<style scoped>
.settings {
  padding: 20px;
}

.setting-group {
  margin-bottom: 24px;
}

.setting-group h3 {
  margin-bottom: 16px;
  color: var(--text-color);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item label {
  font-weight: 500;
}

.setting-item select,
.setting-item input[type="checkbox"] {
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}
</style>