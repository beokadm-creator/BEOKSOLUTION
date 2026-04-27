export const safeText = (value: unknown, lang: 'ko' | 'en' = 'ko'): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  
  // Handles bilingual objects, including accidentally nested shapes like { ko: { ko, en }, en }.
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const preferred = obj[lang] ?? obj.ko ?? obj.en ?? obj.title;
    if (preferred !== undefined && preferred !== value) {
      return safeText(preferred, lang);
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
   
  return String(value);
};
