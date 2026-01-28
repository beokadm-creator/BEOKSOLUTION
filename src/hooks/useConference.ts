import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { ConferenceInfo, Page, Agenda, Conference, Speaker } from '../types/schema';
import { useParams } from 'react-router-dom';

interface ConferenceData {
  isPlatform: boolean;
  id: string | null; // This is the full composite ID (e.g. kap_2026spring)
  info: (ConferenceInfo & { societyId?: string }) | null; // Updated to include societyId
  pages: Page[];
  agendas: Agenda[];
  speakers: Speaker[];
  loading: boolean;
  error: string | null;
  societyId?: string;
  slug?: string;
}

export const useConference = () => {
  const params = useParams<{ slug: string }>(); // React Router v6 params
  const [data, setData] = useState<ConferenceData>({
    isPlatform: false,
    id: null,
    info: null,
    pages: [],
    agendas: [],
    speakers: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
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
        const slug = params.slug?.toLowerCase(); // Case-insensitive match

        // 1. Determine Environment
        let societyId: string | null = null;
        let isPlatform = false;

        // Dev overrides (e.g. localhost)
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isFirebaseApp = hostname.includes('web.app') || hostname.includes('firebaseapp.com');
        const parts = hostname.split('.');

        if (isLocalhost || isFirebaseApp) {
             // On Localhost/Platform, if there is a slug, we treat it as Conference Mode for testing.
             if (slug && slug !== 'admin' && slug !== 'login') {
                 isPlatform = false;
                 // societyId remains null here, we will query by slug only
             } else {
                 isPlatform = true;
             }
        } else {
             // Subdomain logic: kap.eregi.co.kr -> kap
             if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
                 societyId = parts[0];
             } else {
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
        let confDocRef;
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

        // console.log(`[useConference] Searching paths:`, pathsToTry); // Debug removed

        for (const candidate of pathsToTry) {
            try {
                const docRef = doc(db, candidate.path);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    // console.log(`✅ SUCCESS PATH: ${candidate.path}`); // Debug removed
                    confId = docSnap.id;
                    confData = { ...docSnap.data(), societyId: societyId || '' } as Conference;
                    basePath = candidate.path;
                    found = true;
                    break; 
                }
            } catch (e) {
                // console.warn(`Error checking path ${candidate.path}`, e); // Keep clean
            }
        }

        if (!found) {
            // Final fallback: Query by slug if direct path failed (legacy)
            const q = query(collection(db, 'conferences'), where('slug', '==', slug), limit(1));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                // console.log(`✅ SUCCESS QUERY: slug=${slug}`); // Debug removed
                confId = querySnapshot.docs[0].id;
                confData = querySnapshot.docs[0].data() as Conference;
                basePath = `conferences/${confId}`;
                found = true;
            }
        }

        if (!found) {
            if (isMounted) {
                setData(prev => ({ ...prev, loading: false, error: 'Conference not found' }));
                clearTimeout(timeoutId);
            }
            return;
        }

        // console.log(`[useConference] Final Base Path: ${basePath}`); // Debug removed

        // 4. Manual Merge of Sub-docs (Fix-Step 109)
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
            // Base
            title: confData.title,
            dates: confData.dates,
            societyId: confData.societyId,
            
            // Info/General Overrides
            ...infoGeneralData,

            // Merged Fields
            venueName: basicData.venueName || (confData as any).venueName,
            venueAddress: basicData.venueAddress || (confData as any).venueAddress,
            subTitle: identityData.subTitle || (confData as any).subTitle,
            welcomeMessage: basicData.welcomeMessage || basicData.greetings || (confData as any).welcomeMessage,
            
            // Venue Object Construction
            venue: {
                name: typeof basicData.venueName === 'string' 
                    ? { ko: basicData.venueName, en: basicData.venueName } 
                    : basicData.venueName || infoGeneralData.venue?.name,
                address: typeof basicData.venueAddress === 'string'
                    ? { ko: basicData.venueAddress, en: basicData.venueAddress } 
                    : basicData.venueAddress || infoGeneralData.venue?.address,
                mapUrl: basicData.mapUrl || infoGeneralData.venue?.mapUrl
            },

            // Visuals
            visuals: {
                bannerUrl: visualData.mainBannerUrl || visualData.bannerUrl || (confData as any).bannerUrl,
                posterUrl: visualData.posterUrl || (confData as any).posterUrl,
            },
            
            // Defaults
            badgeLayout: infoGeneralData.badgeLayout || { width: 400, height: 600, elements: [] },
            receiptConfig: infoGeneralData.receiptConfig || { issuerName: confData.title.ko, stampUrl: '', nextSerialNo: 1 },
        } as any;


        const pagesRef = collection(db, `${basePath}/pages`);
        const pagesSnap = await getDocs(pagesRef);
        const pages = pagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Page));

        const agendasRef = collection(db, `${basePath}/agendas`);
        const agendasSnap = await getDocs(agendasRef);
        const agendas = agendasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agenda));

        const speakersRef = collection(db, `${basePath}/speakers`);
        const speakersSnap = await getDocs(speakersRef);
        const speakers = speakersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Speaker));

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
                loading: false,
                error: null
            });
            clearTimeout(timeoutId);
        }

      } catch (err: any) {
        if (isMounted) {
            // Handle permission errors gracefully - still load page with minimal data
            const isPermissionError = (err as { code?: string }).code === 'permission-denied' || (err instanceof Error && err.message?.includes('permission'));
            if (isPermissionError) {

                // Force loading false to prevent infinite loading state
                setData(prev => ({ ...prev, loading: false, error: 'Permission denied. Some data may not be available.' }));
                clearTimeout(timeoutId);
            } else {
                setData(prev => ({ ...prev, loading: false, error: err.message }));
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
  }, [params.slug]);

  return data;
};
