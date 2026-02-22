import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ConferenceData, Conference } from '../types/schema';

/**
 * Translation hook for conference content
 * Handles multilingual content loading with caching
 */

// ✅ AGGRESSIVE OPTIMIZATION: Global cache
const translationCache = new Map<string, { data: any; timestamp: number }>();
const pendingTranslations = new Map<string, Promise<any>>();
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
    terms: any;
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

export const useTranslation = (slug: string): UseTranslationResult => {
    const [terms, setTerms] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

    // Memoize URL search params to prevent unnecessary re-renders
    const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);

    const refresh = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    useEffect(() => {
        if (!slug) return;

        // ✅ OPTIMIZATION: Check cache first
        const cacheKey = slug;
        const cached = translationCache.get(cacheKey);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp < CACHE_TTL)) {
            console.log('[useTranslation] ✅ Using cached translations for slug:', slug);
            setTerms(cached.data);
            setLoading(false);
            setError(null);
            return;
        }

        // ✅ OPTIMIZATION: Check if request is pending
        const pending = pendingTranslations.get(cacheKey);
        if (pending) {
            console.log('[useTranslation] ⏳ Waiting for pending translation for slug:', slug);
            pending.then(data => {
                setTerms(data);
                setLoading(false);
                setError(null);
            }).catch(err => {
                console.error('[useTranslation] Pending translation failed:', err);
                setError(err.message);
                setLoading(false);
            });
            return;
        }

        setLoading(true);
        setError(null);

        const fetchPromise = (async () => {
            try {
                let docData: ConferenceData | null = null;
                let confId = slug;

                // 🚨 [Fix] Determine societyId from hostname for domain-based filtering
                const host = window.location.hostname;
                const isLocalhost = host === 'localhost' || host === '127.0.0.1';
                const isFirebaseApp = host.includes('.web.app') || host.includes('firebaseapp.com');
                const parts = host.split('.');
                
                let domainSocietyId: string | null = null;

                // DEV 환경: URL 쿼리 파라미터에서 society 가져오기
                const urlParams = searchParams;
                const societyParam = urlParams.get('society');
                if (societyParam) {
                    domainSocietyId = societyParam;
                }

                // 프로덕션: 서브도메인에서 society 가져오기
                if (!domainSocietyId && parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
                    domainSocietyId = parts[0]; // e.g., 'kadd' from kadd.eregi.co.kr
                }

                // 1. 메인 문서 Fetch (slug 필드 우선 - 더 유연한 매칭)
                // 🚨 [Fix] Query by slug, then filter by societyId in memory (no index needed)
                const q = query(collection(db, 'conferences'), where('slug', '==', slug));
                const querySnap = await getDocs(q);

                // Filter by societyId if on subdomain
                const matchingDocs = querySnap.docs.filter(doc => {
                    if (!domainSocietyId) return true; // No filter on main domain
                    return doc.data().societyId === domainSocietyId;
                });

                if (matchingDocs.length > 0) {
                    docData = { id: matchingDocs[0].id, ...matchingDocs[0].data() } as ConferenceData & { id: string };
                    confId = docData.id as string;
                } else {
                    // Fallback 1: slug를 ID로 직접 검색 (e.g., slug === document ID)
                    const docRef = doc(db, 'conferences', slug);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        docData = { id: slug, ...docSnap.data() } as ConferenceData & { id: string };
                        confId = slug;
                    }
                }

                if (!docData) {
                    throw new Error(`Conference not found: ${slug}`);
                }

                console.log('[useTranslation] Conference found. Fetching subcollections with confId:', confId);

                // 2. Get terms (translations, agreements, etc.) from settings/identity
                const identityDocRef = doc(db, 'conferences', confId, 'settings', 'identity');
                const identitySnap = await getDoc(identityDocRef);

                let termsData = null;
                if (identitySnap.exists()) {
                    termsData = identitySnap.data();
                    console.log('[useTranslation] ✅ Successfully loaded terms from identity doc');
                } else {
                    console.warn('[useTranslation] ⚠️ No identity doc found for conference:', confId);
                    // Fallback: Try fetching from terms subcollection
                    try {
                        const termsRef = collection(db, 'conferences', confId, 'terms');
                        const termsSnap = await getDocs(termsRef);
                        if (!termsSnap.empty) {
                            termsData = {};
                            termsSnap.forEach(doc => {
                                termsData[doc.id] = doc.data();
                            });
                            console.log('[useTranslation] ✅ Loaded terms from terms subcollection');
                        }
                    } catch (err) {
                        console.warn('[useTranslation] Failed to load terms from subcollection:', err);
                    }
                }

                // ✅ OPTIMIZATION: Cache the result
                translationCache.set(cacheKey, { data: termsData, timestamp: now });
                pendingTranslations.delete(cacheKey);

                return termsData;

            } catch (err: any) {
                console.error('[useTranslation] Error loading translations:', err);
                throw err;
            }
        })();

        // Register pending request
        pendingTranslations.set(cacheKey, fetchPromise);

        fetchPromise
            .then(data => {
                setTerms(data);
                setLoading(false);
                setError(null);
            })
            .catch(err => {
                console.error('[useTranslation] Failed to load translations:', err);
                setError(err.message || 'Failed to load translations');
                setLoading(false);
            });

    }, [slug, refreshTrigger, searchParams]);

    return { terms, loading, error, refresh };
};
