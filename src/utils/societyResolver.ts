import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
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
        .map((word) => word.trim())
        .filter((word) => word.length > 0);

    if (!words.length) return '';
    return words.map((word) => word[0]).join('').toLowerCase();
};

export const resolveSocietyByIdentifier = async (
    identifier: string
): Promise<{ id: string; data: SocietyLike } | null> => {
    const key = normalize(identifier);
    const keyCompact = compact(identifier);
    if (!key) return null;

    const directRef = doc(db, 'societies', key);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
        return { id: directSnap.id, data: directSnap.data() as SocietyLike };
    }

    const snap = await getDocs(collection(db, 'societies'));
    const matched = snap.docs.find((snapshot) => {
        const data = snapshot.data() as SocietyLike;
        const idMatch = normalize(snapshot.id) === key;
        const idCompactMatch = compact(snapshot.id) === keyCompact && keyCompact.length > 0;
        const domainMatch = normalize(data.domainCode) === key;
        const domainCompactMatch = compact(data.domainCode) === keyCompact && keyCompact.length > 0;
        const slugMatch = normalize(data.slug) === key;
        const slugCompactMatch = compact(data.slug) === keyCompact && keyCompact.length > 0;
        const nameEnMatch = normalize(data.name?.en) === key;
        const nameEnCompactMatch = compact(data.name?.en) === keyCompact && keyCompact.length > 0;
        const nameEnInitialsMatch = getNameInitials(data.name?.en) === key;
        const aliasMatch = Array.isArray(data.aliases)
            ? data.aliases.map((alias) => normalize(alias)).includes(key)
            : false;
        const aliasCompactMatch = Array.isArray(data.aliases)
            ? data.aliases.map((alias) => compact(alias)).includes(keyCompact)
            : false;

        return (
            idMatch
            || idCompactMatch
            || domainMatch
            || domainCompactMatch
            || slugMatch
            || slugCompactMatch
            || nameEnMatch
            || nameEnCompactMatch
            || nameEnInitialsMatch
            || aliasMatch
            || aliasCompactMatch
        );
    });

    if (!matched) return null;
    return { id: matched.id, data: matched.data() as SocietyLike };
};
