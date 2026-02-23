import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "sidebar": {
        "dashboard": "Dashboard",
        "materials": "Materials",
        "production": "Production",
        "settings": "Settings"
      },
      "common": { "welcome": "Welcome", "loading": "Loading..." }
    }
  },
  ru: {
    translation: {
      "sidebar": {
        "dashboard": "Панель управления",
        "materials": "Склад материалов",
        "production": "Производство",
        "settings": "Настройки"
      },
      "common": { "welcome": "Добро пожаловать", "loading": "Загрузка..." }
    }
  },
  uk: {
    translation: {
      "sidebar": {
        "dashboard": "Панель управління",
        "materials": "Склад матеріалів",
        "production": "Виробництво",
        "settings": "Налаштування"
      },
      "common": { "welcome": "Ласкаво просимо", "loading": "Завантаження..." }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    interpolation: { escapeValue: false }
  });

export default i18n;