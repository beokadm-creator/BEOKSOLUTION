import { useState, useEffect } from 'react';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Translation hook for conference content
 * Handles multilingual content loading with caching
 */

// ✅ AGGRESSIVE OPTIMIZATION: Global cache
const translationCache = new Map<string, { data: unknown; timestamp: number }>();
const pendingTranslations = new Map<string, Promise<unknown>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const clearTranslationCache = (slug?: string) => {
    if (slug) {
        translationCache.delete(slug);
        pendingTranslations.delete(slug);
    } else {
        translationCache.clear();
        pendingTranslations.clear();
    }
};

interface UseTranslationResult {
    t: (obj: unknown) => string;
    config: any; // Using any temporarily for backward compatibility with complex types
    loading: boolean;
    error: string | null;
    currentLang: string;
    setLanguage: (lang: string) => void;
    confId: string | null;
    urlSlug: string;
    refresh: () => void;
}

export const useTranslation = (slug: string): UseTranslationResult => {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [currentLang, setCurrentLang] = useState<string>(localStorage.getItem('preferredLanguage') || 'ko');
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

    const setLanguage = (lang: string) => {
        setCurrentLang(lang);
        localStorage.setItem('preferredLanguage', lang);
    };

    const t = (obj: unknown) => {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;
        const localized = obj as Record<string, string>;
        return localized[currentLang === 'en' ? 'en' : 'ko'] || localized.ko || localized.en || '';
    };

    const refresh = () => setRefreshTrigger(prev => prev + 1);

    useEffect(() => {
        if (!slug) return;

        const cacheKey = `${slug}_${currentLang}`;
        const cached = translationCache.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp < CACHE_TTL)) {
            setConfig(cached.data);
            setLoading(false);
            return;
        }

        const pending = pendingTranslations.get(cacheKey);
        if (pending) {
            pending.then(data => {
                setConfig(data);
                setLoading(false);
            });
            return;
        }

        setLoading(true);

        const fetchPromise = (async () => {
            try {
                // 1. Find Conference Document
                const q = query(collection(db, 'conferences'), where('slug', '==', slug));
                const querySnap = await getDocs(q);

                let confDoc = querySnap.docs[0];
                if (!confDoc) {
                    const directDoc = await getDoc(doc(db, 'conferences', slug));
                    if (directDoc.exists()) confDoc = directDoc;
                }

                if (!confDoc) throw new Error(`Conference not found: ${slug}`);

                const confId = confDoc.id;
                const confData = confDoc.data();
                const societyId = confData.societyId || confId.split('_')[0] || 'kadd';

                // 2. Parallel Fetch ALL required configurations
                const [identitySnap, societySnap, visualSnap, infoSnap] = await Promise.all([
                    getDoc(doc(db, 'conferences', confId, 'settings', 'identity')),
                    getDoc(doc(db, 'societies', societyId)),
                    getDoc(doc(db, 'conferences', confId, 'settings', 'visual')),
                    getDoc(doc(db, 'conferences', confId, 'info', 'general'))
                ]);

                // 3. Parallel Fetch Sub-collections (Performance Boost)
                const [pagesSnap, agendasSnap, speakersSnap, sponsorsSnap] = await Promise.all([
                    getDocs(collection(db, 'conferences', confId, 'pages')),
                    getDocs(collection(db, 'conferences', confId, 'agendas')),
                    getDocs(collection(db, 'conferences', confId, 'speakers')),
                    getDocs(collection(db, 'conferences', confId, 'sponsors'))
                ]);

                const combinedConfig = {
                    ...confData,
                    id: confId,
                    societyId,
                    identity: identitySnap.exists() ? identitySnap.data() : null,
                    society: societySnap.exists() ? societySnap.data() : null,
                    visualAssets: visualSnap.exists() ? visualSnap.data() : null,
                    info: infoSnap.exists() ? infoSnap.data() : null,
                    pages: pagesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                    agendas: agendasSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                    speakers: speakersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                    sponsors: sponsorsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                };

                translationCache.set(cacheKey, { data: combinedConfig, timestamp: now });
                pendingTranslations.delete(cacheKey);
                return combinedConfig;

            } catch (err: unknown) {
                console.error('[useTranslation] Fetch error:', err);
                throw err;
            }
        })();

        pendingTranslations.set(cacheKey, fetchPromise);

        fetchPromise.then(data => {
            setConfig(data);
            setLoading(false);
            setError(null);
        }).catch(err => {
            setError((err as Error).message || 'Unknown error');
            setLoading(false);
        });

    }, [slug, refreshTrigger, currentLang]);

    return {
        t,
        config,
        loading,
        error,
        currentLang,
        setLanguage,
        confId: config?.id || null,
        urlSlug: slug,
        refresh
    };
};
