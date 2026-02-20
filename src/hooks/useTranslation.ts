import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ConferenceConfig } from '../types/conference';

interface TimestampLike {
  toDate?: () => Date;
}

interface PricingPeriod {
  start?: TimestampLike | string | number | Date;
  end?: TimestampLike | string | number | Date;
}

interface PricingItem {
  period?: PricingPeriod;
  [key: string]: unknown;
}

interface AgendaSession {
  startTime?: TimestampLike | string | number | Date;
  endTime?: TimestampLike | string | number | Date;
  [key: string]: unknown;
}

interface AgendaItem {
  startTime?: TimestampLike | string | number | Date;
  endTime?: TimestampLike | string | number | Date;
  sessions?: AgendaSession[];
  [key: string]: unknown;
}

interface ConferenceData {
  dates?: {
    start?: TimestampLike | string | number | Date;
    end?: TimestampLike | string | number | Date;
  };
  period?: PricingPeriod;
  pricing?: PricingItem[];
  agendas?: AgendaItem[];
  [key: string]: unknown;
}

// 🛠️ [Helper] Firestore Timestamp -> JS Date 변환기
const toDate = (val: TimestampLike | string | number | Date | undefined): Date | undefined => {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate(); // Firestore Timestamp
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return undefined;
};

// 🛠️ [Helper] 데이터 전체 순회하며 날짜 정제
const normalizeData = (data: ConferenceData): ConferenceData => {
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
    data.pricing = data.pricing.map((p: PricingItem) => ({
      ...p,
      period: {
        start: toDate(p.period?.start),
        end: toDate(p.period?.end),
      }
    }));
  }

  // 4. 아젠다 (agendas) - 타임스탬프 변환
  if (Array.isArray(data.agendas)) {
    data.agendas = data.agendas.map((a: AgendaItem) => ({
      ...a,
      startTime: toDate(a.startTime),
      endTime: toDate(a.endTime),
      sessions: Array.isArray(a.sessions) ? a.sessions.map((s: AgendaSession) => ({
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
  const [urlSlug] = useState<string>(slug); // Store URL slug for navigation

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
        let docData: ConferenceData | null = null;
        let confId = slug;

        // 🚨 [Fix] Determine societyId from hostname for domain-based filtering
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        let domainSocietyId: string | null = null;
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
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
          // Fallback: ID 직접 검색
          const docRef = doc(db, 'conferences', slug);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            docData = { id: docSnap.id, ...docSnap.data() } as ConferenceData & { id: string };
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
          const sponsorsRef = collection(db, 'conferences', confId, 'sponsors');
          const regSettingsRef = doc(db, 'conferences', confId, 'settings', 'registration');

          interface QuerySnapshot {
            size: number;
            docs: Array<{ id: string; data: () => Record<string, unknown> }>;
            empty: boolean;
          }

          interface DocSnapshot {
            exists: () => boolean;
            data: () => Record<string, unknown>;
          }

          let agendaSnap: QuerySnapshot = { size: 0, docs: [], empty: true };
          let speakerSnap: QuerySnapshot = { size: 0, docs: [], empty: true };
          let sponsorSnap: QuerySnapshot = { size: 0, docs: [], empty: true };
          let regSnap: DocSnapshot = { exists: () => false, data: () => ({}) };
          let societySnap: DocSnapshot | null = null;

          // 개별 쿼리별 try-catch로 식별
          try {
            agendaSnap = await getDocs(agendasRef) as QuerySnapshot;
          } catch (e) {
            // Error silently ignored
          }

          try {
            speakerSnap = await getDocs(speakersRef) as QuerySnapshot;
          } catch (e) {
            // Error silently ignored
          }

          try {
            sponsorSnap = await getDocs(sponsorsRef) as QuerySnapshot;
          } catch (e) {
            // Error silently ignored
          }

          try {
            regSnap = await getDoc(regSettingsRef) as DocSnapshot;
          } catch (e) {
            // Error silently ignored
          }

          if (docData.societyId) {
            try {
              societySnap = await getDoc(doc(db, 'societies', docData.societyId as string)) as DocSnapshot;
            } catch (e) {
              societySnap = null;
            }
          }

          // 1. Agendas 병합
          (docData as ConferenceData & { agendas?: unknown[] }).agendas = agendaSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

          // 2. Speakers 병합
          (docData as ConferenceData & { speakers?: unknown[] }).speakers = speakerSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

          // 3. Sponsors 병합
          (docData as ConferenceData & { sponsors?: unknown[] }).sponsors = sponsorSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

          // 4. 🚨 [핵심] 등록비(Pricing) 병합
          // settings/registration 문서의 'periods' 배열을 'pricing'으로 변환
          (docData as ConferenceData & { pricing?: unknown[] }).pricing = []; // 항상 빈 배열로 초기화
          if (regSnap.exists()) {
            const regData = regSnap.data();
            if (regData.periods && Array.isArray(regData.periods)) {
              (docData as ConferenceData & { pricing?: unknown[] }).pricing = (regData.periods as Array<{ [key: string]: unknown }>).map((p) => ({
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
            (docData as ConferenceData & { society?: unknown }).society = societySnap.data();
          }

          // 데이터 정제 및 적용
          const cleanData = normalizeData(docData);
          setConfig(cleanData as ConferenceConfig);
          setConfId(confId); // Store actual confId from DB

        } else {
          setError('Conference not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  const t = (val: string | Record<string, string> | undefined | null): string => {
    if (typeof val === 'string') return val;
    return val?.[currentLang] || val?.['en'] || val?.['ko'] || '';
  };

  return { t, config, loading, error, currentLang, setLanguage, confId, urlSlug };
};
