import { useState, useEffect } from 'react';
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

export const useConference = (targetId?: string) => {
    const params = useParams<ConferenceParams>(); // React Router v7 params - supports both slug and cid
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
            try {
                const hostname = window.location.hostname;
                const urlParams = new URLSearchParams(window.location.search);
                const societyParam = urlParams.get('society');

                // 1. Determine Environment
                let societyId: string | null = societyParam; // 쿼리 파라미터에서 society 가져오기
                let isPlatform = false;

                // Dev overrides (e.g. localhost)
                const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
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
                    if (slug && slug !== 'admin' && slug !== 'login') {
                        isPlatform = false;
                        // societyId는 이미 societyParam으로 설정됨
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

                // 3. Query Firestore: Find Conference
                // [Fix-Step 110] Multi-Path Search & Rescue
                let confId = '';
                let confData = {} as Conference;
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
                            confData = { ...docSnap.data(), societyId: societyId || '' } as Conference;
                            basePath = candidate.path;
                            found = true;
                            break;
                        }
                    } catch (e) {
                        console.log(`[useConference] ❌ ERROR checking path ${candidate.path}:`, e);
                    }
                }

                if (!found) {
                    // Final fallback: Query by slug if direct path failed (legacy)
                    // 🚨 [Fix] Query by slug, then filter by societyId in memory (no index needed)
                    console.log('[useConference] Trying fallback query by slug:', slug);
                    const q = query(collection(db, 'conferences'), where('slug', '==', slug), limit(10));
                    const querySnapshot = await getDocs(q);

                    // Filter by societyId if on subdomain
                    const matchingDocs = querySnapshot.docs.filter(doc => {
                        if (!societyId) return true; // No filter on main domain
                        return doc.data().societyId === societyId;
                    });

                    if (matchingDocs.length > 0) {
                        console.log(`[useConference] ✅ SUCCESS QUERY: slug=${slug}, confId=${matchingDocs[0].id}`);
                        confId = matchingDocs[0].id;
                        confData = matchingDocs[0].data() as Conference;
                        basePath = `conferences/${confId}`;
                        found = true;
                    } else {
                        console.log('[useConference] ❌ Fallback query returned no results');
                    }
                }

                if (!found) {
                    if (isMounted) {
                        setData(prev => ({ ...prev, loading: false, error: 'Conference not found' }));
                        clearTimeout(timeoutId);
                    }
                    return;
                }

                console.log('[useConference] Final Base Path:', basePath);
                console.log('[useConference] Conference ID:', confId);
                console.log('[useConference] Slug:', slug);

                // 4. Manual Merge of Sub-docs (Fix-Step 109)
                // [FIX 2026-02-04] Remove deprecated info/general dependency
                // Use main conference document as single source of truth for venue/dates
                // Fetch all potential settings documents in parallel
                const effectiveSocietyId = confData.societyId || (confId.includes('_') ? confId.split('_')[0] : societyId);

                console.log('[useConference] Effective Society ID for fetching identity:', effectiveSocietyId);

                const [basicSnap, identitySnap, visualSnap, registrationSnap, societyIdentitySnap] = await Promise.all([
                    getDoc(doc(db, `${basePath}/settings/basic`)),
                    getDoc(doc(db, `${basePath}/settings/identity`)),
                    getDoc(doc(db, `${basePath}/settings/visual`)),
                    getDoc(doc(db, `${basePath}/settings/registration`)),
                    effectiveSocietyId ? getDoc(doc(db, `societies/${effectiveSocietyId}/settings/identity`)) : Promise.resolve(null)
                ]);

                const basicData = basicSnap.exists() ? basicSnap.data() : {};
                const identityData = identitySnap.exists() ? identitySnap.data() : {};
                const visualData = visualSnap.exists() ? visualSnap.data() : {};
                const societyIdentityData = societyIdentitySnap && societyIdentitySnap.exists() ? societyIdentitySnap.data() : {};
                const registrationData = registrationSnap.exists() ? registrationSnap.data() : {};

                // Construct Final Info Object manually
                // [FIX] Use confData (main doc) as primary source, settings as overrides
                const infoData: ConferenceInfo & { societyId?: string; bannerUrl?: string; posterUrl?: string } = {
                    // Base from main conference document
                    title: confData.title,
                    dates: confData.dates,
                    societyId: confData.societyId,

                    // Merged Fields - prioritize main doc venue data
                    venueName: basicData.venueName || confData.venue?.name || confData.venueName || '',
                    venueAddress: basicData.venueAddress || confData.venue?.address || confData.venueAddress || '',
                    subTitle: identityData.subTitle || confData.subtitle,
                    welcomeMessage: basicData.welcomeMessage || basicData.greetings || confData.welcomeMessage,

                    // Terms & Conditions (From Society Identity + Conference Overrides)
                    termsOfService: societyIdentityData.termsOfService,
                    termsOfService_en: societyIdentityData.termsOfService_en,
                    privacyPolicy: societyIdentityData.privacyPolicy,
                    privacyPolicy_en: societyIdentityData.privacyPolicy_en,
                    thirdPartyConsent: societyIdentityData.thirdPartyConsent,
                    thirdPartyConsent_en: societyIdentityData.thirdPartyConsent_en,
                    marketingConsentText: societyIdentityData.marketingConsentText,
                    marketingConsentText_en: societyIdentityData.marketingConsentText_en,
                    infoConsentText: societyIdentityData.infoConsentText,
                    infoConsentText_en: societyIdentityData.infoConsentText_en,

                    // Refund Policy: Conference Settings > Society Identity
                    refundPolicy: registrationData.refundPolicy || societyIdentityData.refundPolicy,
                    refundPolicy_en: registrationData.refundPolicy_en || societyIdentityData.refundPolicy_en,

                    // Venue Object Construction - use main conference doc venue data
                    venue: {
                        name: typeof basicData.venueName === 'string'
                            ? { ko: basicData.venueName, en: basicData.venueName }
                            : basicData.venueName || confData.venue?.name || { ko: '', en: '' },
                        address: typeof basicData.venueAddress === 'string'
                            ? { ko: basicData.venueAddress, en: basicData.venueAddress }
                            : basicData.venueAddress || confData.venue?.address || { ko: '', en: '' },
                        mapUrl: basicData.mapUrl || confData.venue?.mapUrl || '',
                        googleMapEmbedUrl: confData.venue?.googleMapEmbedUrl
                    },

                    // Visuals - use main conference doc as fallback
                    visuals: {
                        bannerUrl: visualData.mainBannerUrl || visualData.bannerUrl || confData.bannerUrl || confData.visualAssets?.banner?.ko,
                        posterUrl: visualData.posterUrl || confData.posterUrl || confData.visualAssets?.poster?.ko,
                    },

                    bannerUrl: visualData.mainBannerUrl || visualData.bannerUrl || confData.bannerUrl || confData.visualAssets?.banner?.ko,
                    posterUrl: visualData.posterUrl || confData.posterUrl || confData.visualAssets?.poster?.ko,

                    // Defaults
                    badgeLayout: confData.badgeLayout || { width: 400, height: 600, elements: [] },
                    receiptConfig: confData.receiptConfig || { issuerName: confData.title?.ko || confData.title, stampUrl: '', nextSerialNo: 1 },
                };


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

                // Fetch registration periods from settings/registration document
                let pricing: RegistrationPeriod[] = [];

                try {
                    console.log('[useConference] Using pre-fetched registration settings');

                    console.log('[useConference] Registration settings query result:', {
                        path: `${basePath}/settings/registration`,
                        exists: registrationSnap.exists(),
                        hasData: !!registrationData
                    });

                    if (registrationSnap.exists()) {
                        console.log('[useConference] Full registration data keys:', Object.keys(registrationData));
                        const periods = registrationData.periods || [];
                        console.log('[useConference] Registration periods array:', periods);
                        console.log('[useConference] Periods length:', periods.length);

                        pricing = periods.map((p: RegistrationPeriod, index: number) => ({
                            id: p.id || `period_${index}`,
                            ...p
                        })).sort((a, b) => {
                            const aStart = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate || 0);
                            const bStart = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate || 0);
                            return aStart.getTime() - bStart.getTime();
                        });
                    } else {
                        console.log('[useConference] Registration document does not exist');
                    }
                } catch (err) {
                    console.error('[useConference] Error processing registration periods:', err);
                    pricing = [];
                }

                console.log('[useConference] Final pricing array:', pricing);
                console.log('[useConference] Pricing array length:', pricing.length);

                if (isMounted) {
                    setData({
                        isPlatform: false,
                        id: confId,
                        societyId: confData.societyId, // Use actual societyId from data
                        slug,
                        info: infoData,
                        pages,
                        agendas,
                        speakers,
                        sponsors,
                        pricing,
                        loading: false,
                        error: null
                    });
                    clearTimeout(timeoutId);
                }

            } catch (err: unknown) {
                if (isMounted) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    // Handle permission errors gracefully - still load page with minimal data
                    const isPermissionError = (err as { code?: string }).code === 'permission-denied' || (error.message?.includes('permission'));
                    if (isPermissionError) {

                        // Force loading false to prevent infinite loading state
                        setData(prev => ({ ...prev, loading: false, error: 'Permission denied. Some data may not be available.' }));
                        clearTimeout(timeoutId);
                    } else {
                        setData(prev => ({ ...prev, loading: false, error: error.message }));
                        clearTimeout(timeoutId);
                    }
                }
            }
        };

        fetchConferenceData();

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [params.slug, params.cid, targetId]);

    return data;
};
