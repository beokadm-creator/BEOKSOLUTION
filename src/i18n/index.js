// Very light-weight i18n helper
import ko from './ko.json';
import en from './en.json';

const translations = { ko, en };

export function t(key, locale = 'ko') {
  const keys = key.split('.');
  let value = translations[locale];
  for (const k of keys) {
    value = value?.[k];
    if (value == null) return key; // fallback to key if missing
  }
  return value;
}

export function setLocale(locale) {
  // Simple dynamic locale switcher if needed in future
  return translations[locale] ? locale : 'ko';
}
