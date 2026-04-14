import { Stringable, UserReg } from './types';

export const forceString = (val: unknown): string => {
    try {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && val !== null) {
            const obj = val as Stringable;
            if (obj.ko) return forceString(obj.ko);
            if (obj.en) return forceString(obj.en);
            if (obj.name) return forceString(obj.name);
            return '';
        }
        return String(val);
    } catch { return ''; }
};

export const getSafeConferenceSlug = (slug?: string): string => {
    if (!slug) return '';
    const trimmed = slug.trim();
    if (!trimmed || trimmed === 'unknown') return '';
    return trimmed;
};

export const getSocietyIdFromSlug = (slug?: string): string => {
    const safeSlug = getSafeConferenceSlug(slug);
    if (!safeSlug || !safeSlug.includes('_')) return '';
    return safeSlug.split('_')[0] || '';
};

export const normalizeSocietyKey = (value: unknown): string => forceString(value).trim().toLowerCase();

export const getTimeValue = (d: unknown): number => {
    if (!d) return 0;
    if (typeof d === 'object' && d !== null && 'toMillis' in d && typeof (d as { toMillis?: () => number }).toMillis === 'function') {
        return (d as { toMillis: () => number }).toMillis();
    }
    if (typeof d === 'object' && d !== null && 'toDate' in d && typeof (d as { toDate?: () => Date }).toDate === 'function') {
        return (d as { toDate: () => Date }).toDate().getTime();
    }
    if (d instanceof Date) return d.getTime();
    if (typeof d === 'string') return new Date(d).getTime();
    return 0;
};

export const isCanceledLike = (status: unknown): boolean => {
    const raw = forceString(status);
    if (!raw) return false;
    const s = raw.toUpperCase();
    const normalized = s.replace(/[\s-]+/g, '_');
    return [
        'CANCELED',
        'CANCELLED',
        'CANCEL',
        'CANCELLATION',
        'REFUND',
        'REJECT',
        'DENIED',
        'FAILED',
        'EXPIRED',
        'VOID',
        'VOIDED',
        'ABORT',
        'WITHDRAW',
        '취소',
        '환불',
        '거절',
        '실패',
        '만료',
        '무효'
    ].some(k => s.includes(k) || normalized.includes(k));
};

export const isPaidLike = (r: UserReg): boolean => {
    const p = forceString(r.paymentStatus).toUpperCase();
    const s = forceString(r.status).toUpperCase();
    const paidKeywords = ['PAID', 'COMPLETED', 'SUCCESS', 'SUCCEEDED', 'APPROVED', 'DONE', '결제완료'];
    return paidKeywords.some((k) => p === k || s === k || p.includes(k) || s.includes(k));
};

export const isPendingLike = (r: UserReg): boolean => {
    const p = forceString(r.paymentStatus).toUpperCase();
    const s = forceString(r.status).toUpperCase();
    const allow = ['PENDING', 'READY', 'SUBMITTED', 'PENDING_PAYMENT', 'WAITING_FOR_DEPOSIT', 'WAITING_DEPOSIT', 'DEPOSIT_WAITING', '입금대기'];
    return allow.includes(p) || allow.includes(s);
};

export const isVisibleActiveReg = (r: UserReg): boolean => {
    if (isCanceledLike(r.paymentStatus) || isCanceledLike(r.status)) return false;
    return isPaidLike(r) || isPendingLike(r);
};

export const pickLatestVisibleReg = (regs: UserReg[]): UserReg | null => {
    if (!regs.length) return null;
    const sorted = [...regs].sort((a, b) => getTimeValue(b.paymentDate) - getTimeValue(a.paymentDate));
    const latestCanceled = sorted.find((r) => isCanceledLike(r.paymentStatus) || isCanceledLike(r.status));
    const latestActive = sorted.find((r) => isVisibleActiveReg(r));

    if (!latestActive) return null;
    if (!latestCanceled) return latestActive;

    const canceledAt = getTimeValue(latestCanceled.paymentDate);
    const activeAt = getTimeValue(latestActive.paymentDate);

    // Conservative rule: if cancel time is unknown or newer/equal, hide from "등록학회"
    if (canceledAt === 0) return null;
    if (activeAt === 0) return null;
    if (activeAt <= canceledAt) return null;

    return latestActive;
};
