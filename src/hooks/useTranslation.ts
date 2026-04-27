import { useState, useEffect } from 'react';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { DOMAIN_CONFIG, extractSocietyFromHost } from '../utils/domainHelper';

const translationCache = new Map<string, { data: unknown; timestamp: number }>();
const pendingTranslations = new Map<string, Promise<unknown>>();
const CACHE_TTL = 5 * 60 * 1000;

export const clearTranslationCache = (slug?: string, societyId?: string) => {
    if (slug) {
        const prefix = societyId ? `${societyId}_${slug}` : slug;
        // Clear all language variants for this tenant+slug combination
        for (const key of [...translationCache.keys()]) {
            if (key === `${prefix}_ko` || key === `${prefix}_en` || key === `${slug}_ko` || key === `${slug}_en`) {
                translationCache.delete(key);
            }
        }
        for (const key of [...pendingTranslations.keys()]) {
            if (key === `${prefix}_ko` || key === `${prefix}_en` || key === `${slug}_ko` || key === `${slug}_en`) {
                pendingTranslations.delete(key);
            }
        }
    } else {
        translationCache.clear();
        pendingTranslations.clear();
    }
};

interface TranslationConfig {
    id?: string;
    [key: string]: unknown;
}

interface UseTranslationResult {
    t: (obj: unknown) => string;
    config: TranslationConfig | null;
    loading: boolean;
    error: string | null;
    currentLang: string;
    setLanguage: (lang: string) => void;
    confId: string | null;
    urlSlug: string;
    refresh: () => void;
}

const toLocalizedText = (obj: unknown, lang: string) => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    const localized = obj as Record<string, string>;
    return localized[lang === 'en' ? 'en' : 'ko'] || localized.ko || localized.en || '';
};

export const useTranslation = (slug: string): UseTranslationResult => {
    const [config, setConfig] = useState<TranslationConfig | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [currentLang, setCurrentLang] = useState<string>(localStorage.getItem('preferredLanguage') || 'ko');
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

    const setLanguage = (lang: string) => {
        setCurrentLang(lang);
        localStorage.setItem('preferredLanguage', lang);
    };

    const t = (obj: unknown) => toLocalizedText(obj, currentLang);
    const refresh = () => setRefreshTrigger(prev => prev + 1);

    useEffect(() => {
        if (!slug) return;

        // ✅ Determine societyId BEFORE cache lookup to prevent cross-tenant cache contamination
        const hostSociety = extractSocietyFromHost(window.location.hostname);
        const preSocietyId = hostSociety || (slug.includes('_') ? slug.split('_')[0] : null);
        const cacheKey = `${preSocietyId || 'unknown'}_${slug}_${currentLang}`;
        const cached = translationCache.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp < CACHE_TTL)) {
            setConfig(cached.data as TranslationConfig);
            setLoading(false);
            return;
        }

        const pending = pendingTranslations.get(cacheKey);
        if (pending) {
            pending.then(data => {
                setConfig(data as TranslationConfig);
                setLoading(false);
            });
            return;
        }

        setLoading(true);

        const fetchPromise = (async () => {
            try {
                // Reuse pre-resolved societyId from cache key computation
                const hostSociety = extractSocietyFromHost(window.location.hostname);
                const inferredSociety = hostSociety || (slug.includes('_') ? slug.split('_')[0] : null);

                const inferredConfId = inferredSociety ? `${inferredSociety}_${slug}` : null;
                const pathCandidates = [
                    ...(inferredSociety ? [`societies/${inferredSociety}/conferences/${slug}`] : []),
                    ...(inferredConfId ? [`societies/${inferredSociety}/conferences/${inferredConfId}`] : []),
                    ...(inferredConfId ? [`conferences/${inferredConfId}`] : []),
                    `conferences/${slug}`,
                ];

                let confDoc: { id: string; data: () => Record<string, unknown> } | null = null;
                let basePath = '';

                for (const path of pathCandidates) {
                    try {
                        const snap = await getDoc(doc(db, path));
                        if (snap.exists()) {
                            confDoc = snap as unknown as { id: string; data: () => Record<string, unknown> };
                            basePath = path;
                            break;
                        }
                    } catch (err) {
                        console.warn('[useTranslation] direct path read failed:', path, err);
                    }
                }

                if (!confDoc) {
                    try {
                        const slugQuery = query(collection(db, 'conferences'), where('slug', '==', slug));
                        const querySnap = await getDocs(slugQuery);
                        if (!querySnap.empty) {
                            confDoc = querySnap.docs[0] as unknown as { id: string; data: () => Record<string, unknown> };
                            basePath = `conferences/${querySnap.docs[0].id}`;
                        }
                    } catch (err) {
                        console.warn('[useTranslation] slug query failed:', err);
                    }
                }

                if (!confDoc) throw new Error(`Conference not found: ${slug}`);

                const confId = confDoc.id;
                const confData = confDoc.data();
                const societyId = (confData.societyId as string) || confId.split('_')[0] || DOMAIN_CONFIG.DEFAULT_SOCIETY;

                if (!basePath) {
                    basePath = `conferences/${confId}`;
                }

                const fullConfId = societyId && !slug.includes('_') ? `${societyId}_${slug}` : confId;
                const altPaths = [
                    `societies/${societyId}/conferences/${slug}`,
                    `societies/${societyId}/conferences/${confId}`,
                    `societies/${societyId}/conferences/${fullConfId}`,
                    `conferences/${societyId}_${slug}`,
                    `conferences/${confId}`,
                    `conferences/${slug}`,
                ].filter((p, idx, arr) => p !== basePath && arr.indexOf(p) === idx);

                const allBasePaths = [basePath, ...altPaths];

                const readFirstExistingDoc = async (relativePath: string) => {
                    for (const p of allBasePaths) {
                        try {
                            const snap = await getDoc(doc(db, `${p}/${relativePath}`));
                            if (snap.exists()) return snap;
                        } catch (err) {
                            console.warn('[useTranslation] doc read failed:', `${p}/${relativePath}`, err);
                        }
                    }
                    return null;
                };

                const readFirstNonEmptyCollection = async (relativePath: string) => {
                    for (const p of allBasePaths) {
                        try {
                            const snap = await getDocs(collection(db, `${p}/${relativePath}`));
                            if (!snap.empty) return snap;
                        } catch (err) {
                            console.warn('[useTranslation] collection read failed:', `${p}/${relativePath}`, err);
                        }
                    }
                    return null;
                };

                const [identityRes, societyRes, visualRes, infoRes, regRes] = await Promise.allSettled([
                    readFirstExistingDoc('settings/identity'),
                    getDoc(doc(db, 'societies', societyId)),
                    readFirstExistingDoc('settings/visual'),
                    readFirstExistingDoc('info/general'),
                    readFirstExistingDoc('settings/registration')
                ]);

                const identitySnap = identityRes.status === 'fulfilled' ? identityRes.value : null;
                const societySnap = societyRes.status === 'fulfilled' ? societyRes.value : null;
                const visualSnap = visualRes.status === 'fulfilled' ? visualRes.value : null;
                const infoSnap = infoRes.status === 'fulfilled' ? infoRes.value : null;
                const regSnap = regRes.status === 'fulfilled' ? regRes.value : null;

                const registrationSettings = regSnap?.exists() ? regSnap.data() : null;

                const baseConfig = {
                    ...confData,
                    id: confId,
                    societyId,
                    identity: identitySnap?.exists() ? identitySnap.data() : null,
                    society: societySnap?.exists() ? societySnap.data() : null,
                    visualAssets: confData.visualAssets || (visualSnap?.exists() ? visualSnap.data() : null),
                    info: infoSnap?.exists() ? infoSnap.data() : null,
                    registrationSettings,
                    paymentMode: (registrationSettings as { paymentMode?: string } | null)?.paymentMode,
                    fieldSettings: (registrationSettings as { fieldSettings?: unknown } | null)?.fieldSettings,
                    pricing: (registrationSettings as { periods?: unknown[] } | null)?.periods || [],
                    pages: [],
                    agendas: [],
                    speakers: [],
                    sponsors: [],
                    subCollectionsLoading: true,
                };

                Promise.allSettled([
                    readFirstNonEmptyCollection('pages'),
                    readFirstNonEmptyCollection('agendas'),
                    readFirstNonEmptyCollection('speakers'),
                    readFirstNonEmptyCollection('sponsors')
                ]).then(([pagesRes, agendasRes, speakersRes, sponsorsRes]) => {
                    const fullConfig = {
                        ...baseConfig,
                        pages: pagesRes.status === 'fulfilled' && pagesRes.value ? pagesRes.value.docs.map(d => ({ id: d.id, ...d.data() })) : [],
                        agendas: agendasRes.status === 'fulfilled' && agendasRes.value ? agendasRes.value.docs.map(d => ({ id: d.id, ...d.data() })) : [],
                        speakers: speakersRes.status === 'fulfilled' && speakersRes.value ? speakersRes.value.docs.map(d => ({ id: d.id, ...d.data() })) : [],
                        sponsors: sponsorsRes.status === 'fulfilled' && sponsorsRes.value ? sponsorsRes.value.docs.map(d => ({ id: d.id, ...d.data() })) : [],
                        subCollectionsLoading: false,
                    };
                    translationCache.set(cacheKey, { data: fullConfig, timestamp: Date.now() });
                    setConfig(fullConfig);
                }).catch(err => {
                    console.error('[useTranslation] Background fetch error:', err);
                });

                translationCache.set(cacheKey, { data: baseConfig, timestamp: now });
                pendingTranslations.delete(cacheKey);
                return baseConfig;
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
