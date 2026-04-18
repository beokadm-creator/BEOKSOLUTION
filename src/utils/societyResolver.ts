import { collection, getDoc, getDocs, doc } from 'firebase/firestore';
import { db } from '../firebase';

type SocietyLike = {
    id?: string;
    name?: { ko?: string; en?: string };
    domainCode?: string;
    slug?: string;
    aliases?: string[];
    [key: string]: unknown;
};

const normalize = (value: unknown): string => {
    return String(value || '').trim().toLowerCase();
};

const compact = (value: unknown): string => normalize(value).replace(/[^a-z0-9가-힣]/g, '');

const getNameInitials = (name?: string): string => {
    if (!name) return '';
    const words = name
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0);
    if (!words.length) return '';
    return words.map((w) => w[0]).join('').toLowerCase();
};

export const resolveSocietyByIdentifier = async (
    identifier: string
): Promise<{ id: string; data: SocietyLike } | null> => {
    const key = normalize(identifier);
    const keyCompact = compact(identifier);
    if (!key) return null;

    // Try direct doc lookup first (cheap, covers 99% of cases)
    try {
        const directRef = doc(db, 'societies', key);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
            return { id: directSnap.id, data: directSnap.data() as SocietyLike };
        }
    } catch (err) {
        // Permission denied or transient error — fall through to collection scan
        console.warn('[societyResolver] direct getDoc failed, trying fallback:', err);
    }

    // Fallback: scan collection for alias/domain/slug match
    try {
        const snap = await getDocs(collection(db, 'societies'));
        const matched = snap.docs.find((d) => {
            const data = d.data() as SocietyLike;
            const idMatch = normalize(d.id) === key;
            const idCompactMatch = compact(d.id) === keyCompact && keyCompact.length > 0;
            const domainMatch = normalize(data.domainCode) === key;
            const domainCompactMatch = compact(data.domainCode) === keyCompact && keyCompact.length > 0;
            const slugMatch = normalize(data.slug) === key;
            const slugCompactMatch = compact(data.slug) === keyCompact && keyCompact.length > 0;
            const nameEnMatch = normalize(data.name?.en) === key;
            const nameEnCompactMatch = compact(data.name?.en) === keyCompact && keyCompact.length > 0;
            const nameEnInitialsMatch = getNameInitials(data.name?.en) === key;
            const aliasMatch = Array.isArray(data.aliases)
                ? data.aliases.map((a) => normalize(a)).includes(key)
                : false;
            const aliasCompactMatch = Array.isArray(data.aliases)
                ? data.aliases.map((a) => compact(a)).includes(keyCompact)
                : false;
            return idMatch || idCompactMatch || domainMatch || domainCompactMatch || slugMatch || slugCompactMatch || nameEnMatch || nameEnCompactMatch || nameEnInitialsMatch || aliasMatch || aliasCompactMatch;
        });

        if (!matched) return null;
        return { id: matched.id, data: matched.data() as SocietyLike };
    } catch (err) {
        // Permission denied on collection scan — degrade gracefully
        console.warn('[societyResolver] collection scan failed, returning null:', err);
        return null;
    }
};
