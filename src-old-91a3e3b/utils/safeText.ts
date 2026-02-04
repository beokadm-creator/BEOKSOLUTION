export const safeText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  
  // Handle's bilingual object { ko, en } 
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return (obj.ko || obj.en || obj.title || JSON.stringify(value)) as string;
  }
  
  return String(value);
};