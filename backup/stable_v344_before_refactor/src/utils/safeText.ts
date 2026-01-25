export const safeText = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  
  // Handle the bilingual object { ko, en } 
  if (typeof value === 'object') {
    return value.ko || value.en || value.title || JSON.stringify(value);
  }
  
  return String(value);
};