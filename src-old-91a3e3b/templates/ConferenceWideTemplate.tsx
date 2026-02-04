import React, { useState, useEffect } from 'react'; // ✅ React Hooks 추가 
import { getApp } from 'firebase/app'; // ✅ Firebase App 추가 
import { collection, getDocs } from 'firebase/firestore'; // ✅ Firestore 함수 추가 
import { db } from '../firebase'; // ✅ DB 인스턴스 추가

import { useTranslation } from '../hooks/useTranslation';
import { WideHeader } from '../components/conference/wide/WideHeader';
import { WideHero } from '../components/conference/wide/WideHero';
import { WideProgram } from '../components/conference/wide/WideProgram';
import { WidePricing } from '../components/conference/wide/WidePricing';
import { WideSpeakers } from '../components/conference/wide/WideSpeakers';
import { WideLocation } from '../components/conference/wide/WideLocation';
import { WideFooter } from '../components/conference/wide/WideFooter';
import { WideAbout } from '../components/conference/wide/WideAbout';

interface Props {
  slug: string;
}

// -------------------------------------------------------------------------- 
// 1. 메인 템플릿 컴포넌트 
// -------------------------------------------------------------------------- 
export const ConferenceWideTemplate = ({ slug }: Props) => {
  // 🔥 [DEBUG] 템플릿 버전 확인용 로그 (2026-01-19 v2)
  const { t, config, loading, error, currentLang, setLanguage, confId, urlSlug } = useTranslation(slug);

  // 로딩 상태 
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 🚨 [진단 모드] 에러 발생 시 DebugScreen 출력 
  if (error || !config) {
    return <DebugScreen slug={slug} />;
  }

  // 정상 렌더링 (KAP 표준 구조)
  const footerData = {
    organization: t((config as Record<string, unknown>).society?.name) || config.societyId,
    address: t((config as Record<string, unknown>).society?.address),
    president: t((config as Record<string, unknown>).society?.president),
    businessNumber: (config as Record<string, unknown>).society?.businessNumber as string | undefined,
    email: (config as Record<string, unknown>).society?.email as string | undefined,
    phone: (config as Record<string, unknown>).society?.phone as string | undefined,
  };

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans text-slate-900">
      {/* 1. Sticky Header */}
      <WideHeader
        lang={currentLang}
        setLang={setLanguage}
        societyName={t(config?.society?.name) || 'Conference'}
      />

      {/* 2. Hero Section (Full Width) */}
      <WideHero
        slug={slug} // ✅ slug 전달
        confId={confId || undefined} // ✅ confId 전달
        lang={currentLang}
        title={t(config.title)}
        subtitle={t(config.subtitle)}
        venueName={t((config as Record<string, unknown>).venue?.name) || 'Venue'}
        bgImage={t((config as Record<string, unknown>).visualAssets?.banner)}
        period={(config as Record<string, unknown>).dates || (config as Record<string, unknown>).period}
      />

      {/* 3. About Section (White) */}
      {config.welcomeMessage && (
        <section className="py-20 md:py-32 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <WideAbout title="Welcome Message" description={t(config.welcomeMessage)} />
          </div>
        </section>
      )}

      {/* 4. Program Section (Slate-50) */}
      <section className="py-20 md:py-32 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <WideProgram agendas={config.agendas} lang={currentLang} />
        </div>
      </section>

      {/* 5. Speakers Section (White) */}
      {config.speakers && config.speakers.length > 0 && (
        <section className="py-20 md:py-32 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <WideSpeakers speakers={config.speakers} lang={currentLang} />
          </div>
        </section>
      )}

      {/* 6. Pricing Section (Slate-50) */}
      <section className="py-20 md:py-32 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <WidePricing
            slug={urlSlug} // ✅ urlSlug 전달 (순수 슬러그)
            societyId={config.societyId} // ✅ Pass societyId for Grade Localization
            lang={currentLang}
            pricing={config.pricing?.map((p) => ({ ...p, prices: (p as { prices?: Record<string, unknown> }).prices || {} })) || []}
            currency="KRW"
          />
        </div>
      </section>

      {/* 7. Location Section (White) */}
      <section className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <WideLocation
            venueName={t((config as Record<string, unknown>).venue?.name) || 'Venue'}
            address={t((config as Record<string, unknown>).venue?.address)}
            mapUrl={(config as Record<string, unknown>).venue?.mapUrl}
          />
        </div>
      </section>

      <WideFooter data={footerData} />
    </div>
  );
};

// -------------------------------------------------------------------------- 
// 2. [진단 도구] DebugScreen 컴포넌트 (타입 에러 수정됨) 
// -------------------------------------------------------------------------- 
const DebugScreen = ({ slug }: { slug: string }) => {
  // ✅ 타입 명시 추가 
  const [dbInfo, setDbInfo] = useState<{ projectId: string, docs: string[] }>({ projectId: 'Checking...', docs: [] });
  const [status, setStatus] = useState('DB 스캔 중...');

  useEffect(() => {
    const diagnose = async () => {
      try {
        // 1. 현재 연결된 프로젝트 ID 확인 
        const app = getApp();
        const projectId = app.options.projectId || 'Unknown';

        // 2.//2. 실제 DB 문서 읽어오기 
        const snap = await getDocs(collection(db, 'conferences'));
        // ✅ map 내부 파라미터 타입 지정 (d: any) 
        const docIds = snap.docs.map((d) => d.id);

        setDbInfo({ projectId, docs: docIds });
        setStatus(docIds.length > 0 ? '스캔 완료' : '문서가 하나도 없음 (권한 또는 프로젝트 문제)');
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        setDbInfo((prev) => ({ ...prev, projectId: getApp().options.projectId || 'Error' }));
        setStatus(`진단 실패: ${errorMessage}`);
      }
    };
    diagnose();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-mono">
      <div className="bg-slate-800 p-8 rounded-xl border-2 border-red-500 max-w-3xl w-full shadow-2xl">
        <h1 className="text-3xl font-bold text-red-500 mb-6 flex items-center gap-2">
          🚨 SYSTEM DISCONNECTED
        </h1>

        <div className="mb-6 bg-black/50 p-4 rounded border border-slate-600">
          <p className="text-slate-400 text-sm mb-1">CONNECTED PROJECT ID (Check .env):</p>
          <p className="text-2xl text-yellow-400 font-bold tracking-wider">
            {dbInfo.projectId}
          </p>
        </div>

        <div className="mb-6">
          <p className="text-slate-400 text-sm">REQUESTED DOCUMENT ID:</p>
          <p className="text-xl text-blue-400">"{slug}"</p>
        </div>

        <div className="border-t border-slate-600 pt-6">
          <p className="text-green-400 font-bold mb-2">🔎 ACTUAL DATABASE CONTENTS:</p>
          <div className="bg-black p-4 rounded h-64 overflow-y-auto border border-slate-700">
            {status !== '스캔 완료' ? (
              <p className="text-red-400">{status}</p>
            ) : (
              <ul className="space-y-1">
                {dbInfo.docs.map((id: string) => (
                  <li key={id} className={id === slug ? "bg-green-900 text-white px-2" : "text-slate-500"}>
                    • "{id}" {id === slug ? "✅ MATCH FOUND!" : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-500 text-center">
          * 프로젝트 ID가 Firebase Console과 다르다면 .env 설정을 확인하세요.<br />
          * 목록에 문서가 안 보인다면 Firestore 보안 규칙을 확인하세요.
        </div>
      </div>
    </div>
  );
};

export default ConferenceWideTemplate; // ✅ Export 추가
