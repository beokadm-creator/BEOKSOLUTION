import { useState, useEffect, useRef, useMemo } from 'react';
import { doc, getDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { ConferenceInfo, Page, Agenda, Speaker, Sponsor, RegistrationPeriod, Conference } from '../types/schema';
import { useParams } from 'react-router-dom';

// Conference route params can be either 'slug' or 'cid'
type ConferenceParams = {
    slug?: string;
    cid?: string;
};

interface ConferenceData {
    isPlatform: boolean;
    id: string | null; // This is the full composite ID (e.g. kap_2026spring)
    info: (ConferenceInfo & { societyId?: string }) | null; // Updated to include societyId
    pages: Page[];
    agendas: Agenda[];
    speakers: Speaker[];
    sponsors: Sponsor[];
    pricing: RegistrationPeriod[]; // Add registration periods
    loading: boolean;
    error: string | null;
    societyId?: string;
    slug?: string;
}

// ✅ AGGRESSIVE OPTIMIZATION: Global cache to prevent duplicate fetches across ALL component instances
const conferenceCache = new Map<string, { data: ConferenceData; timestamp: number }>();
const pendingRequests = new Map<string, Promise<ConferenceData>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

/**
 * Clear conference cache (useful for testing or admin updates)
 */
export const clearConferenceCache = (slug?: string) => {
    if (slug) {
        conferenceCache.delete(slug);
        pendingRequests.delete(slug);
    } else {
        conferenceCache.clear();
        pendingRequests.clear();
    }
};

export const useConference = (targetId?: string) => {
    const params = useParams<ConferenceParams>();

    // Memoize URL search params to prevent unnecessary re-renders
    const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);

    // Track current fetching slug to prevent duplicate requests within same component
    const fetchingSlugRef = useRef<string | null>(null);

    const [data, setData] = useState<ConferenceData>({
        isPlatform: false,
        id: null,
        info: null,
        pages: [],
        agendas: [],
        speakers: [],
        sponsors: [],
        pricing: [],
        loading: true,
        error: null,
    });

    useEffect(() => {
        // Support both 'slug' (from public routes) and 'cid' (from admin routes)
        const slug = targetId || params.slug?.toLowerCase() || params.cid?.toLowerCase();
        console.log('[useConference] useEffect triggered, slug:', slug);

        let isMounted = true;
        const timeoutId = setTimeout(() => {
            if (isMounted) {
                setData(prev => ({
                    ...prev,
                    loading: false,
                    error: 'Connection Timeout. Please check your internet or try refreshing.'
                }));
            }
        }, 10000);

        const fetchConferenceData = async () => {
            // Prevent duplicate requests for the same slug
            if (fetchingSlugRef.current === slug) {
                console.log('[useConference] Skipping duplicate request for slug:', slug);
                return;
            }

            try {
                fetchingSlugRef.current = slug;

                if (!slug) {
                    if (isMounted) {
                        setData(prev => ({ ...prev, loading: false }));
                        clearTimeout(timeoutId);
                    }
                    return;
                }

                // ✅ OPTIMIZATION: Check cache first
                const cached = conferenceCache.get(slug);
                const now = Date.now();
                if (cached && (now - cached.timestamp < CACHE_TTL)) {
                    console.log('[useConference] ✅ Using cached data for slug:', slug);
                    if (isMounted) {
                        setData(cached.data);
                        clearTimeout(timeoutId);
                    }
                    return;
                }

                // ✅ OPTIMIZATION: Check if request is already pending
                const pending = pendingRequests.get(slug);
                if (pending) {
                    console.log('[useConference] ⏳ Waiting for pending request for slug:', slug);
                    const result = await pending;
                    if (isMounted) {
                        setData(result);
                        clearTimeout(timeoutId);
                    }
                    return;
                }

                // Determine environment
                const hostname = window.location.hostname;
                let societyId: string | null = null;
                let isPlatform = false;

                // DEV 환경: URL 쿼리 파라미터에서 society 가져오기
                const societyParam = searchParams.get('society');
                if (societyParam) {
                    societyId = societyParam;
                }

                const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
                const isFirebaseApp = hostname.includes('.web.app') || hostname.includes('firebaseapp.com');
                const parts = hostname.split('.');

                console.log('[useConference] Environment detection:', {
                    hostname,
                    isLocalhost,
                    isFirebaseApp,
                    parts,
                    slug,
                    societyId,
                    societyParam
                });

                if (isLocalhost || isFirebaseApp) {
                    // On Localhost/Platform, if there is a slug, we treat it as Conference Mode for testing.
                    // IMPORTANT: If we are in /admin/conf/..., the slug is passed.
                    // If we are in /admin/society, the slug might be undefined or different.
                    // For safety, on Dev/Firebase hosting, we allow cross-society access or default to platform
                    
                    if (slug && slug !== 'admin' && slug !== 'login') {
                        isPlatform = false;
                        // societyId is already set from societyParam if available
                        // If not, try to extract from slug if it follows pattern society_conf
                        if (!societyId && slug.includes('_')) {
                            societyId = slug.split('_')[0];
                        }
                    } else {
                        isPlatform = true;
                    }
                } else {
                    // Subdomain logic: kap.eregi.co.kr -> kap
                    if (!societyId && parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
                        societyId = parts[0];
                    }

                    if (!societyId) {
                        isPlatform = true;
                    }
                }

                if (isPlatform) {
                    if (isMounted) {
                        setData(prev => ({ ...prev, isPlatform: true, loading: false }));
                        clearTimeout(timeoutId);
                    }
                    return;
                }

                // Safety Guard: Ignore reserved admin routes
                if (slug === 'admin' || slug === 'login') {
                    if (isMounted) {
                        setData(prev => ({ ...prev, loading: false }));
                        clearTimeout(timeoutId);
                    }
                    return;
                }

                if (!slug) {
                    if (isMounted) {
                        setData(prev => ({ ...prev, loading: false }));
                        clearTimeout(timeoutId);
                    }
                    return;
                }

                // ✅ Create promise for this request
                const fetchPromise = (async () => {
                    // Query Firestore: Find Conference
                    let confId = '';
                    let confData = {} as Conference & Record<string, unknown>;
                    let basePath = '';
                    let found = false;

                    // Path Candidates
                    const pathsToTry = [];
                    if (societyId && slug) {
                        pathsToTry.push({ path: `societies/${societyId}/conferences/${slug}`, type: 'nested' });
                        pathsToTry.push({ path: `conferences/${societyId}_${slug}`, type: 'root_composite' }); // e.g. kadd_2026spring
                    }
                    if (slug) {
                        pathsToTry.push({ path: `conferences/${slug}`, type: 'root_simple' });
                    }

                    console.log('[useConference] Searching paths:', pathsToTry);

                    for (const candidate of pathsToTry) {
                        try {
                            const docRef = doc(db, candidate.path);
                            const docSnap = await getDoc(docRef);

                            if (docSnap.exists()) {
                                console.log(`[useConference] ✅ SUCCESS PATH: ${candidate.path}`);
                                confId = docSnap.id;
                                confData = { ...docSnap.data(), societyId: societyId || '' } as unknown as Conference & Record<string, unknown>;
                                basePath = candidate.path;
                                found = true;
                                break;
                            }
                        } catch (e) {
                            console.warn(`[useConference] Error checking path ${candidate.path}:`, e);
                        }
                    }

                    if (!found) {
                        // Final fallback: Query by slug if direct path failed (legacy)
                        const q = query(collection(db, 'conferences'), where('slug', '==', slug), limit(1));
                        const querySnapshot = await getDocs(q);
                        if (!querySnapshot.empty) {
                            console.log(`[useConference] ✅ SUCCESS QUERY: slug=${slug}`);
                            confId = querySnapshot.docs[0].id;
                            confData = querySnapshot.docs[0].data() as unknown as Conference & Record<string, unknown>;
                            basePath = `conferences/${confId}`;
                            found = true;
                        }
                    }

                    if (!found) {
                        throw new Error('Conference not found');
                    }

                    console.log('[useConference] Final Base Path:', basePath);
                    console.log('[useConference] Conference ID:', confId);
                    console.log('[useConference] Slug:', slug);

                    // ✅ CRITICAL FIX: Use actual societyId from conference data, not derived
                    const effectiveSocietyId = confData.societyId || societyId;
                    console.log('[useConference] Effective Society ID for fetching identity:', effectiveSocietyId);

                    // Fetch all potential settings documents in parallel
                    const [infoSnap, basicSnap, identitySnap, visualSnap] = await Promise.all([
                        getDoc(doc(db, `${basePath}/info/general`)),
                        getDoc(doc(db, `${basePath}/settings/basic`)),
                        getDoc(doc(db, `${basePath}/settings/identity`)),
                        getDoc(doc(db, `${basePath}/settings/visual`))
                    ]);

                    const basicData = basicSnap.exists() ? basicSnap.data() : {};
                    const identityData = identitySnap.exists() ? identitySnap.data() : {};
                    const visualData = visualSnap.exists() ? visualSnap.data() : {};
                    const infoGeneralData = infoSnap.exists() ? infoSnap.data() : {};

                    // Construct Final Info Object manually
                    const infoData: ConferenceInfo & { societyId?: string } = {
                        title: confData.title,
                        dates: confData.dates,
                        societyId: effectiveSocietyId,
                        ...infoGeneralData,
                        venueName: basicData.venueName || confData.venueName,
                        venueAddress: basicData.venueAddress || confData.venueAddress,
                        subTitle: identityData.subTitle || confData.subTitle,
                        welcomeMessage: basicData.welcomeMessage || basicData.greetings || confData.welcomeMessage,
                        venue: {
                            name: typeof basicData.venueName === 'string'
                                ? { ko: basicData.venueName, en: basicData.venueName }
                                : basicData.venueName || infoGeneralData.venue?.name,
                            address: typeof basicData.venueAddress === 'string'
                                ? { ko: basicData.venueAddress, en: basicData.venueAddress }
                                : basicData.venueAddress || infoGeneralData.venue?.address,
                            mapUrl: basicData.mapUrl || infoGeneralData.venue?.mapUrl
                        },
                        visuals: {
                            bannerUrl: visualData.mainBannerUrl || visualData.bannerUrl || confData.bannerUrl,
                            posterUrl: visualData.posterUrl || confData.posterUrl,
                        },
                        badgeLayout: infoGeneralData.badgeLayout || { width: 400, height: 600, elements: [] },
                        receiptConfig: infoGeneralData.receiptConfig || {
                            issuerName: confData.title.ko,
                            stampUrl: '',
                            nextSerialNo: 1
                        },
                    } as unknown as ConferenceInfo & { societyId?: string };

                    // Fetch subcollections
                    const pagesRef = collection(db, `${basePath}/pages`);
                    const pagesSnap = await getDocs(pagesRef);
                    const pages = pagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Page));

                    const agendasRef = collection(db, `${basePath}/agendas`);
                    const agendasSnap = await getDocs(agendasRef);
                    const agendas = agendasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agenda));

                    const speakersRef = collection(db, `${basePath}/speakers`);
                    const speakersSnap = await getDocs(speakersRef);
                    const speakers = speakersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Speaker));

                    const sponsorsRef = collection(db, `${basePath}/sponsors`);
                    const sponsorsSnap = await getDocs(sponsorsRef);
                    const sponsors = sponsorsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sponsor));

                    // ✅ OPTIMIZATION: Fetch registration settings
                    let pricing: RegistrationPeriod[] = [];
                    try {
                        const regSettingsRef = doc(db, `${basePath}/settings/registration`);
                        const regSettingsSnap = await getDoc(regSettingsRef);
                        if (regSettingsSnap.exists()) {
                            const regData = regSettingsSnap.data();
                            if (regData.periods && Array.isArray(regData.periods)) {
                                pricing = regData.periods as RegistrationPeriod[];
                            }
                        }
                    } catch (e) {
                        console.warn('[useConference] Failed to fetch registration settings:', e);
                    }

                    const result: ConferenceData = {
                        isPlatform: false,
                        id: confId,
                        societyId: effectiveSocietyId,
                        slug,
                        info: infoData,
                        pages,
                        agendas,
                        speakers,
                        sponsors,
                        pricing,
                        loading: false,
                        error: null
                    };

                    // ✅ OPTIMIZATION: Cache the result
                    conferenceCache.set(slug, { data: result, timestamp: now });
                    pendingRequests.delete(slug);

                    return result;
                })();

                // Register pending request
                pendingRequests.set(slug, fetchPromise);

                // Wait for fetch
                const result = await fetchPromise;

                if (isMounted) {
                    setData(result);
                    clearTimeout(timeoutId);
                }

            } catch (err: unknown) {
                pendingRequests.delete(slug);

                if (isMounted) {
                    // Handle permission errors gracefully
                    const errCode = (err as { code?: string; message?: string })?.code;
                    const errMsg = (err as { code?: string; message?: string })?.message;
                    const isPermissionError = errCode === 'permission-denied' || errMsg?.includes('permission');
                    if (isPermissionError) {
                        setData(prev => ({
                            ...prev,
                            loading: false,
                            error: 'Permission denied. Some data may not be available.'
                        }));
                    } else {
                        setData(prev => ({ ...prev, loading: false, error: errMsg || 'Failed to load conference' }));
                    }
                    clearTimeout(timeoutId);
                }
            }
        };

        fetchConferenceData();

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            fetchingSlugRef.current = null; // Reset on unmount
        };
    }, [params.slug, params.cid, targetId, searchParams]);

    // ✅ OPTIMIZATION: Memoize returned data to prevent unnecessary re-renders
    return useMemo(() => data, [data]);
};
