import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type Language = 'en' | 'zh';

export const useI18nStore = defineStore('i18n', () => {
  const currentLanguage = ref<Language>('en');
  const availableLanguages = ref<Language[]>(['en', 'zh']);

  // Load language from localStorage or detect browser language
  const initializeLanguage = () => {
    const savedLang = localStorage.getItem('mcp-hub-language') as Language | null;
    if (savedLang && availableLanguages.value.includes(savedLang)) {
      currentLanguage.value = savedLang;
    } else {
      // Detect browser language
      const browserLang = navigator.language.split('-')[0] as Language;
      if (availableLanguages.value.includes(browserLang)) {
        currentLanguage.value = browserLang;
      }
    }
  };

  const setLanguage = (lang: Language) => {
    if (availableLanguages.value.includes(lang)) {
      currentLanguage.value = lang;
      localStorage.setItem('mcp-hub-language', lang);
    }
  };

  const isLanguageAvailable = (lang: string): boolean => {
    return availableLanguages.value.includes(lang as Language);
  };

  const t = computed(() => {
    // This store works with vue-i18n, so we don't need to implement translation here
    // It just manages the language state
    return currentLanguage.value;
  });

  return {
    currentLanguage,
    availableLanguages,
    initializeLanguage,
    setLanguage,
    isLanguageAvailable,
    t
  };
});