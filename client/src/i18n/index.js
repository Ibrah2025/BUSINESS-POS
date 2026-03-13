import { useSettingsStore } from '../store/settingsStore';
import en from './en.json';
import ha from './ha.json';

const translations = { en, ha };

export function t(key, lang = 'en') {
  return translations[lang]?.[key] || translations.en[key] || key;
}

export function useTranslation() {
  const language = useSettingsStore((s) => s.language);
  return {
    t: (key) => t(key, language),
    language,
  };
}
