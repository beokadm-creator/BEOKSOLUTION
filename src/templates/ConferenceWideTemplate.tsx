import React, { useState, useEffect } from 'react';
import { getApp } from 'firebase/app';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

import { useTranslation } from '../hooks/useTranslation';
import { WideHeaderPreview } from '../components/conference/wide-preview/WideHeaderPreview';
import { WideHeroPreview } from '../components/conference/wide-preview/WideHeroPreview';
import { WideContentPreview } from '../components/conference/wide-preview/WideContentPreview';
import { WideFooterPreview } from '../components/conference/wide-preview/WideFooterPreview';
import TermsAgreementModal from '../components/conference/TermsAgreementModal';
import { RegistrationModal } from '../components/conference/RegistrationModal';
import { Home, Calendar, Users, CreditCard, MapPin, Building2 } from 'lucide-react';

interface Props {
  slug: string;
}

export const ConferenceWideTemplate = ({ slug }: Props) => {
  const navigate = useNavigate();
  const { t, config, loading, error, currentLang, setLanguage, confId, urlSlug } = useTranslation(slug);

  // Active section state for tabs
  const [activeSection, setActiveSection] = useState<string>('welcome');

  // Registration modal state
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  // Extract societyId from confId for registration modal
  const confIdToUse = confId || (slug && slug.includes('_') ? slug : undefined);
  const societyId = confIdToUse?.split('_')[0] || 'kadd';

  // Terms Agreement Modal state
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [terms, setTerms] = useState<Record<string, unknown> | null>(null);
  const [termsLoading, setTermsLoading] = useState(false);

  // Fetch terms from Firestore
  useEffect(() => {
    const fetchTerms = async () => {
      if (!config?.societyId) return;

      setTermsLoading(true);
      try {
        const identityDocRef = doc(db, 'societies', config.societyId, 'settings', 'identity');
        const docSnap = await getDoc(identityDocRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('[ConferenceWideTemplate] Terms loaded:', Object.keys(data));
          setTerms(data);
        } else {
          console.warn('[ConferenceWideTemplate] No terms document found');
          setTerms(undefined);
        }
      } catch (e) {
        console.error('[ConferenceWideTemplate] Failed to fetch terms:', e);
        setTerms(undefined);
      } finally {
        setTermsLoading(false);
      }
    };

    fetchTerms();
  }, [config?.societyId]);

  // Handle terms agreement confirmation
  const handleTermsAgreementConfirm = () => {
    setShowTermsModal(false);
    // Navigate to registration page
    navigate(`/${urlSlug}/register?mode=new-flow`);
  };

  // Handle tab click with scroll
  const handleTabClick = (section: string) => {
    setActiveSection(section);

    // Scroll to specific section on both mobile and PC
    setTimeout(() => {
      const sectionElement = document.getElementById(`section-${section}`);
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100); // Small delay to ensure content is rendered
  };

  // Tab items configuration
  const tabItems = [
    { id: 'welcome', icon: Home, label: { ko: '홈', en: 'Home' } },
    { id: 'program', icon: Calendar, label: { ko: '프로그램', en: 'Program' } },
    { id: 'speakers', icon: Users, label: { ko: '연자진', en: 'Speakers' } },
    { id: 'pricing', icon: CreditCard, label: { ko: '등록비', en: 'Pricing' } },
    { id: 'location', icon: MapPin, label: { ko: '위치', en: 'Location' } },
    { id: 'sponsors', icon: Building2, label: { ko: '스폰서', en: 'Sponsors' } },
  ];

  const getLabel = (label: { ko: string; en: string }) => {
    return label[currentLang as 'ko' | 'en'] || label.ko;
  };

  // 로딩 상태 - loading이 true이거나 config가 아직 없으면 로딩 표시
  // 이렇게 하면 데이터 로딩 중 타이밍 이슈로 인한 에러 화면 표시를 방지
  if (loading || (!config && !error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 🚨 [진단 모드] 에러 발생 시 또는 로딩 완료 후에도 config가 없으면 DebugScreen 출력
  if (error || !config) {
    return <DebugScreen slug={slug} />;
  }

  const societyName = t(config?.society?.name) || config.societyId?.toUpperCase() || 'Conference';
  const logoUrl = config?.society?.logoUrl;

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans text-slate-900">
      {/* 1. Sticky Header */}
      <WideHeaderPreview
        lang={currentLang}
        setLang={setLanguage}
        societyName={typeof societyName === 'string' ? societyName : (currentLang === 'ko' ? societyName?.ko : societyName?.en) || societyId}
        logoUrl={logoUrl}
        slug={slug}
        confId={confIdToUse || undefined}
      />

      {/* 2. Hero Section (Full Width) */}
      <WideHeroPreview
        slug={slug}
        confId={confId || undefined}
        lang={currentLang}
        title={t(config.title)}
        subtitle={t(config.subtitle)}
        venueName={t(config.venue?.name) || 'Venue'}
        bgImage={t(config.visualAssets?.banner)}
        period={config.dates || config.period}
        societyName={typeof societyName === 'string' ? societyName : (currentLang === 'ko' ? societyName?.ko : societyName?.en) || societyId}
      />

      {/* 3. Main Content Area */}
      <div data-content-area className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <WideContentPreview
          config={config}
          lang={currentLang}
          t={t}
          activeSection={activeSection}
        />
      </div>

      {/* 4. Mobile-Optimized Bottom Tab Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg z-50 safe-area-inset-bottom">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="flex items-center justify-between gap-2 py-3 sm:py-4">
            {/* Tab Buttons */}
            <div className="flex justify-around sm:justify-center sm:gap-8 flex-1 overflow-x-auto scrollbar-hide">
              {tabItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabClick(item.id)}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 rounded-xl font-medium transition-all duration-200 min-w-[60px] sm:min-w-[100px] ${isActive
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <Icon className={`w-6 h-6 sm:w-5 sm:h-5 md:w-6 md:h-6 ${isActive ? 'text-blue-600' : ''}`} />
                    <span className="text-[10px] sm:text-sm md:text-base font-medium">
                      {getLabel(item.label)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Footer */}
      <WideFooterPreview society={config?.society} language={currentLang as 'ko' | 'en'} />

      {/* Terms Agreement Modal */}
      <TermsAgreementModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAgree={handleTermsAgreementConfirm}
        lang={currentLang as 'ko' | 'en'}
        terms={terms}
        isLoading={termsLoading}
      />

      {/* Registration Modal - Using same modal as Hero section */}
      <RegistrationModal
        isOpen={showRegistrationModal}
        onClose={() => setShowRegistrationModal(false)}
        societyId={societyId}
        societyName={typeof societyName === 'string' ? societyName : (currentLang === 'ko' ? societyName?.ko : societyName?.en) || societyId}
        confId={confIdToUse || ''}
        lang={currentLang as 'ko' | 'en'}
        initialMode="member-auth"
      />
    </div>
  );
};

// --------------------------------------------------------------------------
// [진단 도구] DebugScreen 컴포넌트
// --------------------------------------------------------------------------
const DebugScreen = ({ slug }: { slug: string }) => {
  const [dbInfo, setDbInfo] = useState<{ projectId: string, docs: string[] }>({ projectId: 'Checking...', docs: [] });
  const [status, setStatus] = useState('DB 스캔 중...');

  useEffect(() => {
    const diagnose = async () => {
      try {
        const app = getApp();
        const projectId = app.options.projectId || 'Unknown';
        const snap = await getDocs(collection(db, 'conferences'));
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
          * 목록이 문서가 안 보인다면 Firestore 보안 규칙을 확인하세요.
        </div>
      </div>
    </div>
  );
};

export default ConferenceWideTemplate;
