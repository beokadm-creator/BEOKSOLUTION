import { Timestamp } from 'firebase/firestore';

/**
 * Safely formats various date types into a locale date string.
 * Handles Date objects, Firestore Timestamps, objects with seconds, and string dates.
 */
export const safeFormatDate = (d: any, locale = 'ko-KR', options?: Intl.DateTimeFormatOptions): string => {
    if (!d) return '';
    try {
        // Handle native Date
        if (d instanceof Date) {
            return d.toLocaleDateString(locale, options);
        }

        // Handle Firestore Timestamp or objects with toDate()
        if (d && typeof d.toDate === 'function') {
            const dateVal = d.toDate();
            return dateVal instanceof Date ? dateVal.toLocaleDateString(locale, options) : String(dateVal);
        }

        // Handle objects with seconds field (standard Firestore JSON representation)
        if (d && typeof d.seconds === 'number') {
            return new Date(d.seconds * 1000).toLocaleDateString(locale, options);
        }

        // Handle strings or numbers
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
            return parsed.toLocaleDateString(locale, options);
        }

        return String(d);
    } catch (err) {
        console.error('[DateUtils] Date format error:', d, err);
        return typeof d === 'string' ? d : '';
    }
};

/**
 * Safely formats into a full locale date and time string.
 */
export const safeFormatDateTime = (d: any, locale = 'ko-KR', options?: Intl.DateTimeFormatOptions): string => {
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
        if (d instanceof Date) return d.toLocaleString(locale, defaultOptions);
        if (d && typeof d.toDate === 'function') {
            const dateVal = d.toDate();
            return dateVal instanceof Date ? dateVal.toLocaleString(locale, defaultOptions) : String(dateVal);
        }
        if (d && typeof d.seconds === 'number') {
            return new Date(d.seconds * 1000).toLocaleString(locale, defaultOptions);
        }
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) return parsed.toLocaleString(locale, defaultOptions);
        return String(d);
    } catch (err) {
        console.error('[DateUtils] DateTime format error:', d, err);
        return typeof d === 'string' ? d : '';
    }
};
