import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { UI_TEXT } from '../../../constants/defaults';
import { RegistrationModal } from '../RegistrationModal';
import { safeFormatDate, type DateLike } from '../../../utils/dateUtils';
import { DOMAIN_CONFIG, extractSocietyFromHost } from '../../../utils/domainHelper';

type LocalizedString = { [lang: string]: string } | string;

interface WideHeroProps {
  slug: string; // ✅ slug 추가
  confId?: string; // ✅ DB에서 실제 confId (예: kadd_2026spring)
  title: LocalizedString;
  subtitle?: LocalizedString;
  period?: { start: Date; end: Date };
  venueName: string;
  category?: LocalizedString;
  societyName?: LocalizedString;
  bgImage?: string;
  lang: string;
  labels?: {
    register: string;
    abstracts: string;
    checkStatus: string;
    date: string;
    venue: string;
  };
  onRegisterClick?: () => void;
  onAbstractsClick?: () => void;
  onCheckStatusClick?: () => void;
}

export const WideHero: React.FC<WideHeroProps> = ({
  slug,
  confId: propConfId, // ✅ prop으로 받은 confId
  title,
  subtitle,
  period,
  venueName,
  category,
  societyName,
  bgImage,
  lang,
}) => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { conferenceId: urlConfId } = useParams<{ conferenceId?: string }>();
  const [showModal, setShowModal] = useState(false);
  const [modalInitialMode, setModalInitialMode] = useState<'member-auth' | 'non-member' | 'registration-check'>('member-auth');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);

  // Extract societyId from confId (format: kadd_2026spring)
  const confIdToUse = propConfId || (slug && slug.includes('_') ? slug : undefined);
  const societyId = confIdToUse?.split('_')[0] || DOMAIN_CONFIG.DEFAULT_SOCIETY;

  const t = (val: LocalizedString | undefined): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return (lang === 'en' ? val.en : val.ko) || val.ko || '';
  };

  const formatDate = (date: DateLike) => safeFormatDate(date);

  const dates = period ? `${formatDate(period.start)} ~ ${formatDate(period.end)}` : '';

  //1. URL에서 urlSlug 추출 (예: /2026spring/register 에서 '2026spring' 추출)
  // window.location.pathname을 사용하므로 클라이언트 사이드 렌더링에서만 유효함
  const urlSlug = typeof window !== 'undefined'
    ? (window.location.pathname.split('/')[1] || '2026spring')
    : '2026spring';

  const targetSlug = slug || urlSlug;

  // 2. 등록 여부 확인 (로그인한 회원만)
  useEffect(() => {
    const checkRegistrationStatus = async () => {
      if (!auth.user) {
        setIsRegistered(false);
        return;
      }

      try {
        // confId 결정 로직 (중복 societyId 방지)
        // 1. propConfId가 있으면 우선 사용 (DB에서 가져온 정확한 confId)
        // 2. 없으면 urlConfId 사용
        // 3. 없으면 slug가 이미 confId 형식(societyId_slug)인지 확인
        // 4. 형식이 맞으면 그대로 사용, 아니면 societyId 붙이기
        let confIdToUse: string;

        if (propConfId) {
          // ✅ DB에서 가져온 정확한 confId (최우선)
          confIdToUse = propConfId;
        } else if (urlConfId) {
          confIdToUse = urlConfId;
        } else if (slug && slug.includes('_')) {
          // slug가 이미 confId 형식인 경우 (예: 'kadd_2026spring')
          // 이미 societyId가 포함되어 있으므로 그대로 사용
          confIdToUse = slug;
        } else {
          // URL에서 societyId 추출
          const hostname = window.location.hostname;
          const societyIdToUse = extractSocietyFromHost(hostname) || DOMAIN_CONFIG.DEFAULT_SOCIETY;

          confIdToUse = `${societyIdToUse}_${targetSlug}`;
        }

        // registrations collection에서 해당 회원의 등록 확인
        // Try multiple status values: PENDING, COMPLETED, or any status
        const q = query(
          collection(db, 'conferences', confIdToUse, 'registrations'),
          where('userId', '==', auth.user.id)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          // 등록 기록이 있음
          const reg = snap.docs[0].data();
          // 결제가 완료된(PAID) 경우만 등록 완료로 간주
          const isPaid = reg.paymentStatus === 'PAID';
          console.log('[WideHero] Found registration:', reg.paymentStatus, 'isPaid:', isPaid);
          setIsRegistered(isPaid);
        } else {
          console.log('[WideHero] No registration found');
          setIsRegistered(false);
        }
      } catch (error) {
        console.error('[WideHero] Error checking registration status:', error);
        setIsRegistered(false);
      }
    };

    checkRegistrationStatus();
  }, [auth.user, targetSlug, urlConfId, propConfId, slug]);

  return (
    <section className="relative w-full min-h-[85vh] md:min-h-[75vh] flex items-center justify-center overflow-hidden bg-slate-900">
      {/* 1. Full Background Image with Enhanced Gradient */}
      {bgImage && (
        <div className="absolute inset-0 z-0">
          <img
            src={bgImage}
            className="w-full h-full object-cover opacity-50 md:opacity-60"
            alt="Conference Hero"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/70" />
        </div>
      )}

      {/* 2. Main Content with Better Mobile Spacing */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 flex flex-col items-center text-center text-white py-16 md:py-28 lg:py-32">
        {/* Category Badge - Enhanced with Mobile Optimization */}
        <span className="inline-block px-4 py-1.5 md:px-5 md:py-2 mb-6 md:mb-8 bg-blue-500/25 backdrop-blur-md border border-blue-400/40 rounded-full text-blue-100 text-xs md:text-sm font-bold tracking-widest uppercase shadow-lg shadow-blue-900/30 animate-fade-in">
          {t(category) || UI_TEXT.conference.default.ko}
        </span>

        {/* Title - Improved Typography & Mobile Optimization */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold font-heading-1 leading-tight md:leading-[1.15] mb-6 md:mb-8 drop-shadow-2xl max-w-4xl md:max-w-5xl px-2">
          {t(title)}
        </h1>

        {/* Subtitle - Better Mobile Readability */}
        {subtitle && (
          <p className="text-base sm:text-xl md:text-2xl lg:text-3xl text-blue-50/90 md:text-slate-200 mb-10 md:mb-12 max-w-2xl md:max-w-3xl font-normal md:font-light leading-relaxed md:leading-relaxed drop-shadow-md px-4">
            {t(subtitle)}
          </p>
        )}

        {/* Buttons - Enhanced Mobile Stack with Better Touch Targets */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full max-w-md sm:max-w-none items-center justify-center mt-6 md:mt-8">
          {auth.user ? (
            // 로그인한 회원
            <>
              {isRegistered ? (
                // 이미 등록한 회원: 등록확인 버튼 -> QR 페이지로 랜딩
                <button
                  type="button"
                  onClick={() => navigate(`/${targetSlug}/badge?lang=${lang}`)}
                  className="w-full sm:w-auto px-6 sm:px-8 py-4 md:py-4.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-base md:text-lg lg:text-xl font-bold rounded-xl shadow-xl shadow-emerald-900/30 hover:shadow-emerald-900/50 transition-all duration-300 transform hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  {lang === 'ko' ? '등록확인' : 'Registration Check'}
                </button>
              ) : (
                // 아직 등록하지 않은 회원: 등록하기 버튼 -> 모달 표시
                <button
                  type="button"
                  onClick={() => {
                    setModalInitialMode('member-auth');
                    setShowModal(true);
                  }}
                  className="w-full sm:w-auto px-6 sm:px-8 py-4 md:py-4.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-base md:text-lg lg:text-xl font-bold rounded-xl shadow-xl shadow-blue-900/30 hover:shadow-blue-900/50 transition-all duration-300 transform hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  {lang === 'ko' ? '등록(조회)하기' : 'Register / Check'}
                </button>
              )}
            </>
          ) : (
            // 비로그인: 등록하기 버튼 (클릭 시 모달 표시)
            <button
              type="button"
              onClick={() => {
                setModalInitialMode('member-auth');
                setShowModal(true);
              }}
              className="w-full sm:w-auto px-6 sm:px-8 py-4 md:py-4.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-base md:text-lg lg:text-xl font-bold rounded-xl shadow-xl shadow-blue-900/30 hover:shadow-blue-900/50 transition-all duration-300 transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {lang === 'ko' ? '등록(조회)하기' : 'Register / Check'}
            </button>
          )}

          {!auth.user && (
            <button
              type="button"
              onClick={() => {
                setModalInitialMode('registration-check');
                setShowModal(true);
              }}
              className="w-full sm:w-auto px-6 sm:px-8 py-4 md:py-4.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/40 text-base md:text-lg lg:text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {lang === 'ko' ? '등록조회' : 'Registration Lookup'}
            </button>
          )}

          <a
            href={`/${targetSlug}/abstracts?lang=${lang}`}
            className="w-full sm:w-auto px-6 sm:px-8 py-4 md:py-4.5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white text-base md:text-lg lg:text-xl font-bold rounded-xl shadow-xl shadow-teal-900/30 hover:shadow-teal-900/50 transition-all duration-300 transform hover:-translate-y-0.5 active:scale-[0.98] text-center"
          >
            {lang === 'ko' ? '초록 접수' : 'Abstract Submission'}
          </a>
        </div>

        {/* Chip Info - Better Mobile Stack */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 md:gap-4 mt-8 md:mt-10">
          <span className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/30 text-sm md:text-base font-medium text-white/90 shadow-lg">
            <span className="text-lg">📅</span>
            <span>{dates}</span>
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/30 text-sm md:text-base font-medium text-white/90 shadow-lg">
            <span className="text-lg">📍</span>
            <span>{venueName}</span>
          </span>
        </div>
      </div>

      {/* 3. Floating Info Bar (Removed as per request to use Chip style below title) */}

      {/* MODAL - New Registration Modal */}
      <RegistrationModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setTimeout(() => setModalInitialMode('member-auth'), 300);
        }}
        societyId={societyId}
        societyName={typeof societyName === 'string' ? societyName : (lang === 'ko' ? societyName?.ko : societyName?.en) || societyId}
        confId={confIdToUse || ''}
        lang={lang as 'ko' | 'en'}
        initialMode={modalInitialMode}
      />
    </section>
  );
};
