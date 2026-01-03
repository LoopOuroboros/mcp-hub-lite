import { createI18n } from 'vue-i18n';

// Load JSON files from public directory
const en = await fetch('/locales/en.json').then(res => res.json());
const zh = await fetch('/locales/zh.json').then(res => res.json());

const i18n = createI18n({
  legacy: false,
  locale: 'zh',
  fallbackLocale: 'en',
  messages: {
    en,
    zh
  }
});

export default i18n;
