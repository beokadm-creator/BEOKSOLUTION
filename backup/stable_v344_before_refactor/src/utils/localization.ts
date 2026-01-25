import { LocalizedText } from '../types/schema';

export type Language = 'ko' | 'en';

export const getText = (text: LocalizedText | undefined, lang: Language): string => {
  if (!text) return '';
  if (lang === 'en' && text.en) {
    return text.en;
  }
  return text.ko;
};
