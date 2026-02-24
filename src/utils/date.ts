/**
 * Safely converts various date formats (Firestore Timestamp, string, number, Date) to a Date object.
 * Returns null if the input is invalid or null/undefined.
 */
export const toSafeDate = (val: unknown): Date | null => {
  if (!val) return null;
  
  // Already a Date object
  if (val instanceof Date) return val;
  
  // Firestore Timestamp (has toDate method)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as any).toDate === 'function') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (val as any).toDate();
      if (result instanceof Date) return result;
      // If toDate() returned something else (e.g. string/number), try to convert it
      const d = new Date(result);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {
      console.warn('Error calling toDate() on object:', e);
      return null;
    }
  }
  
  // Firestore Timestamp-like object (seconds)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof val === 'object' && val !== null && 'seconds' in val && typeof (val as any).seconds === 'number') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Date((val as any).seconds * 1000);
  }
  
  // String or Number
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  
  return null;
};

/**
 * Safely formats a date value to a string using toLocaleDateString.
 * Returns empty string if invalid.
 */
export const formatSafeDate = (val: unknown, locale: string = 'ko-KR'): string => {
  try {
    const date = toSafeDate(val);
    if (date && typeof date.toLocaleDateString === 'function') {
      return date.toLocaleDateString(locale);
    }
    return '';
  } catch (e) {
    console.warn('Error formatting date:', e);
    return '';
  }
};
