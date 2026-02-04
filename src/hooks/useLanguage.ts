import { useState, useCallback } from 'react';

type Language = 'ko' | 'en';

export const useLanguage = () => {
  const [language, setLanguageState] = useState<Language>('ko');

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    // Optional: Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-language', lang);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState(prev => prev === 'ko' ? 'en' : 'ko');
  }, []);

  // Get localized text
  const t = useCallback((text: LocalizedText | string | undefined): string => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[language] || text.ko || '';
  }, [language]);

  return {
    language,
    setLanguage,
    toggleLanguage,
    t,
    isKO: language === 'ko',
    isEN: language === 'en',
  };
};

export type { Language };

export interface LocalizedText {
  ko: string;
  en?: string;
}
