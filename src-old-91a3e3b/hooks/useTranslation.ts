import { useState, useEffect } from 'react'; 
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { ConferenceConfig } from '../types/conference'; 

// 🛠️ [Helper] Firestore Timestamp -> JS Date 변환기 
const toDate = (val: any): Date | undefined => { 
  if (!val) return undefined; 
  if (val instanceof Date) return val; 
  if (typeof val.toDate === 'function') return val.toDate(); // Firestore Timestamp 
  if (typeof val === 'string' || typeof val === 'number') return new Date(val); 
  return undefined; 
}; 

// 🛠️ [Helper] 데이터 전체 순회하며 날짜 정제 
const normalizeData = (data: any): any => { 
  if (!data) return data; 

  // 1. 최상위 날짜 (dates) 
  if (data.dates) { 
    data.dates.start = toDate(data.dates.start); 
    data.dates.end = toDate(data.dates.end); 
  } 

  // 2. 최상위 기간 (period - 호환성) 
  if (data.period) { 
    if (typeof data.period === 'object') { 
      data.period.start = toDate(data.period.start); 
      data.period.end = toDate(data.period.end); 
    } 
  } 

  // 3. 가격 정보 (pricing) - 배열 내부 순회 
  if (Array.isArray(data.pricing)) { 
    data.pricing = data.pricing.map((p: any) => ({ 
      ...p, 
      period: { 
        start: toDate(p.period?.start), 
        end: toDate(p.period?.end), 
      } 
    })); 
  } 

  // 4. 아젠다 (agendas) - 타임스탬프 변환 
  if (Array.isArray(data.agendas)) { 
    data.agendas = data.agendas.map((a: any) => ({ 
      ...a, 
      startTime: toDate(a.startTime), 
      endTime: toDate(a.endTime), 
      sessions: Array.isArray(a.sessions) ? a.sessions.map((s: any) => ({ 
         ...s, 
         startTime: toDate(s.startTime), 
         endTime: toDate(s.endTime), 
      })) : [] 
    })); 
  } 

  return data; 
}; 

export const useTranslation = (slug: string) => {
  const [config, setConfig] = useState<ConferenceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLang, setLanguage] = useState('ko');
  const [confId, setConfId] = useState<string | null>(null); // Store actual confId from DB
  const [urlSlug, setUrlSlug] = useState<string>(slug); // Store URL slug for navigation 

  // 🚀 [추가] URL Query Parameter (?lang=en) 감지 및 적용
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const langParam = params.get('lang');
    if (langParam && (langParam.toLowerCase() === 'en' || langParam.toLowerCase() === 'ko')) {
        setLanguage(langParam.toLowerCase());
    }
  }, []);

  useEffect(() => { 
    const fetchData = async () => { 
      if (!slug) return;
      setLoading(true);

      try {
        let docData: any = null;
        let confId = slug;

        // 1. 메인 문서 Fetch (slug 필드 우선 - 더 유연한 매칭)
        const q = query(collection(db, 'conferences'), where('slug', '==', slug));
        const querySnap = await getDocs(q);

        if (!querySnap.empty) {
          docData = { id: querySnap.docs[0].id, ...querySnap.docs[0].data() };
          confId = docData.id;
        } else {
          // Fallback: ID 직접 검색
          const docRef = doc(db, 'conferences', slug);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            docData = { id: docSnap.id, ...docSnap.data() };
          }
        }

        if (docData) {
          console.log('[useTranslation] Conference found. Fetching subcollections with confId:', confId);
          // -------------------------------------------------------
          // 🚀 [추가] 분리된 데이터 가져오기 (개별 try-catch로 식별)
          // -------------------------------------------------------

          // 경로 준비
          const agendasRef = collection(db, 'conferences', confId, 'agendas');
          const speakersRef = collection(db, 'conferences', confId, 'speakers');
          const regSettingsRef = doc(db, 'conferences', confId, 'settings', 'registration');

          let agendaSnap: any = { size: 0, docs: [], empty: true };
          let speakerSnap: any = { size: 0, docs: [], empty: true };
          let regSnap: any = { exists: () => false };
          let societySnap: any = null;

          // 개별 쿼리별 try-catch로 식별
          try {
            agendaSnap = await getDocs(agendasRef);
          } catch (e: any) {
            // Error silently ignored
          }

          try {
            speakerSnap = await getDocs(speakersRef);
          } catch (e: any) {
            // Error silently ignored
          }

          try {
            regSnap = await getDoc(regSettingsRef);
          } catch (e: any) {
            // Error silently ignored
          }

          if (docData.societyId) {
            try {
              societySnap = await getDoc(doc(db, 'societies', docData.societyId));
            } catch (e: any) {
              societySnap = null;
            }
          }

          // 1. Agendas 병합
          docData.agendas = agendaSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

          // 2. Speakers 병합
          docData.speakers = speakerSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

          // 3. 🚨 [핵심] 등록비(Pricing) 병합
          // settings/registration 문서의 'periods' 배열을 'pricing'으로 변환
          docData.pricing = []; // 항상 빈 배열로 초기화
          if (regSnap.exists()) {
            const regData = regSnap.data();
            if (regData.periods && Array.isArray(regData.periods)) {
              docData.pricing = regData.periods.map((p: any) => ({
                ...p, // ✅ 원본 데이터 전체 복사 (startDate, endDate 포함)
                id: p.id,
                type: p.type,
                name: p.name,
                period: { start: p.startDate, end: p.endDate }, // 호환성 유지
                prices: p.prices, // 가격 맵
                currency: 'KRW',   // 기본 통화
                refundPolicy: regData.refundPolicy
              }));
            }
          }

          // 4. Society 병합
          if (societySnap && societySnap.exists()) {
            docData.society = societySnap.data();
          } 

          // 데이터 정제 및 적용
          const cleanData = normalizeData(docData);
          setConfig(cleanData as ConferenceConfig);
          setConfId(confId); // Store actual confId from DB

        } else {
          setError('Conference not found');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      } 
    }; 

    fetchData(); 
  }, [slug]); 

  const t = (val: any) => { 
    if (typeof val === 'string') return val; 
    return val?.[currentLang] || val?.['en'] || val?.['ko'] || ''; 
  }; 

  return { t, config, loading, error, currentLang, setLanguage, confId, urlSlug };
};
