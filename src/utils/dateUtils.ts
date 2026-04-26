/**
 * Returns today's date string in KST (YYYY-MM-DD).
 * This safely calculates KST without using error-prone UTC manipulation.
 */
export const getKstToday = (date: Date = new Date()): string => {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
};

/**
 * Safely formats various date types into a locale date string.
 * Handles Date objects, Firestore Timestamps, objects with seconds, and string dates.
 */
/**
 * Union type covering all date representations found in Firestore data:
 * - `Date` — native JS date objects
 * - `Timestamp` — Firestore Timestamp instances (have `.toDate()`)
 * - `{ seconds: number; nanoseconds?: number }` — serialized Firestore Timestamp JSON
 * - `string | number` — ISO strings, epoch millis, or parseable date strings
 */
export type DateLike = Date | { toDate(): Date | unknown } | { seconds: number; nanoseconds?: number } | string | number;

export function hasToDate(d: DateLike): d is { toDate(): Date | unknown } & Record<string, unknown> {
    return !!d && typeof d !== 'string' && typeof d !== 'number' && !Array.isArray(d) && typeof (d as Record<string, unknown>).toDate === 'function';
}

export function hasSeconds(d: DateLike): d is { seconds: number; nanoseconds?: number } {
    return !!d && typeof d !== 'string' && typeof d !== 'number' && !Array.isArray(d) && typeof (d as Record<string, unknown>).seconds === 'number';
}

export function tryParseDate(d: DateLike): Date | null {
    if (d instanceof Date) return d;
    if (hasToDate(d)) {
        const val = d.toDate();
        return val instanceof Date ? val : null;
    }
    if (hasSeconds(d)) {
        return new Date(d.seconds * 1000);
    }
    if (typeof d === 'string' || typeof d === 'number') {
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

export const safeFormatDate = (d: DateLike, locale = 'ko-KR', options?: Intl.DateTimeFormatOptions): string => {
    if (!d) return '';
    try {
        if (hasToDate(d)) {
            const val = d.toDate();
            if (val instanceof Date) return val.toLocaleDateString(locale, options);
            return String(val);
        }
        const date = tryParseDate(d);
        if (date) return date.toLocaleDateString(locale, options);
        return String(d);
    } catch (err) {
        console.error('[DateUtils] Date format error:', d, err);
        return typeof d === 'string' ? d : '';
    }
};

/**
 * Safely formats into a full locale date and time string.
 */
export const safeFormatDateTime = (d: DateLike, locale = 'ko-KR', options?: Intl.DateTimeFormatOptions): string => {
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        ...options
    };

    if (!d) return '';
    try {
        if (hasToDate(d)) {
            const val = d.toDate();
            if (val instanceof Date) return val.toLocaleString(locale, defaultOptions);
            return String(val);
        }
        const date = tryParseDate(d);
        if (date) return date.toLocaleString(locale, defaultOptions);
        return String(d);
    } catch (err) {
        console.error('[DateUtils] DateTime format error:', d, err);
        return typeof d === 'string' ? d : '';
    }
};

export const parseDatetimeLocalAsKst = (dtStr: string): Date => {
  if (!dtStr) return new Date();
  const [datePart, timePart] = dtStr.split('T');
  if (!datePart || !timePart) return new Date(dtStr);
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  // KST is UTC+9, so to get the UTC time, we subtract 9 hours from the KST hour
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0));
};
