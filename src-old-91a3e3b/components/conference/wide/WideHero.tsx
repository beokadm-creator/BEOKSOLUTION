import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { UI_TEXT } from '../../../constants/defaults';

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
  labels = {
    register: 'Registration',
    abstracts: 'Abstract Submission',
    checkStatus: 'Check Status',
    date: 'Date',
    venue: 'Venue'
  },
}) => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { conferenceId: urlConfId } = useParams<{ conferenceId?: string }>();
  const [showModal, setShowModal] = useState(false);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [registrationStatus, setRegistrationStatus] = useState<'PENDING' | 'PAID' | null>(null);

  const t = (val: LocalizedString | undefined): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return (lang === 'en' ? val.en : val.ko) || val.ko || '';
  };

  const formatDate = (date: Date) => {
    return date ? date.toLocaleDateString() : '';
  };

  const dates = period ? `${formatDate(period.start)} ~ ${formatDate(period.end)}` : '';

  // 1. URL에서 urlSlug 추출 (예: /2026spring/register 에서 '2026spring' 추출)
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
        setRegistrationStatus(null);
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
          const parts = hostname.split('.');
          let societyIdToUse = 'kadd';

          if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
            societyIdToUse = parts[0].toLowerCase();
          }

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
          setIsRegistered(true);
          setRegistrationStatus(reg.paymentStatus as 'PENDING' | 'PAID');
        } else {
          setIsRegistered(false);
          setRegistrationStatus(null);
        }
      } catch (error) {
        console.error('[WideHero] Error checking registration status:', error);
        setIsRegistered(false);
      }
    };

    checkRegistrationStatus();
  }, [auth.user, targetSlug, urlConfId]);

  return (
    <section className="relative w-full min-h-[75vh] flex items-center justify-center overflow-hidden bg-slate-900">
      {/* 1. Full Background Image */}
      {bgImage && (
        <div className="absolute inset-0 z-0">
          <img
            src={bgImage}
            className="w-full h-full object-cover opacity-60"
            alt="Conference Hero"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent" />
        </div>
      )}

      {/* 2. Main Content */}
      <div className="relative z-10 container mx-auto px-4 flex flex-col items-center text-center text-white pt-28 pb-20">
        {/* Category Badge */}
        <span className="inline-block px-4 py-1.5 mb-6 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 rounded-full text-blue-200 text-sm font-bold tracking-widest uppercase">
          {t(category) || UI_TEXT.conference.default.ko}
        </span>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold font-heading-1 leading-tight mb-6 drop-shadow-lg max-w-5xl">
          {t(title)}
        </h1>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xl md:text-2xl text-slate-200 mb-10 max-w-3xl font-light drop-shadow">
            {t(subtitle)}
          </p>
        )}

        {/* Buttons */}
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto mt-8">
          {auth.user ? (
            // 로그인한 회원
            <>
              {isRegistered ? (
                // 이미 등록한 회원: 등록확인 버튼 -> QR 페이지로 랜딩
                <button
                  onClick={() => navigate(`/${targetSlug}/badge?lang=${lang}`)}
                  className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white text-xl font-bold rounded-xl shadow-xl shadow-green-900/20 transition-all transform hover:-translate-y-1 hover:shadow-2xl text-center"
                >
                  {lang === 'ko' ? '등록확인' : 'Registration Check'}
                </button>
              ) : (
                // 아직 등록하지 않은 회원: 등록하기 버튼
                <button
                  onClick={() => {
                    navigate(`/${targetSlug}/register?lang=${lang}`);
                  }}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-xl font-bold rounded-xl shadow-xl shadow-blue-900/20 transition-all transform hover:-translate-y-1 hover:shadow-2xl text-center"
                >
                  {lang === 'ko' ? '등록하기' : 'Register Now'}
                </button>
              )}
            </>
          ) : (
            // 비로그인: 등록하기 버튼 (클릭 시 모달 표시)
            <button
              onClick={() => {
                setShowModal(true);
              }}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-xl font-bold rounded-xl shadow-xl shadow-blue-900/20 transition-all transform hover:-translate-y-1 hover:shadow-2xl text-center"
            >
              {lang === 'ko' ? '등록하기' : 'Register Now'}
            </button>
          )}
          {!auth.user && (
            <a
              href={`/${targetSlug}/check-status?lang=${lang}`}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border border-white/30 text-xl font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-1 text-center"
            >
              {lang === 'ko' ? '비회원등록조회' : 'Non-Member Registration Check'}
            </a>
          )}
          <a
            href={`/${targetSlug}/abstracts?lang=${lang}`}
            className="px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white text-xl font-bold rounded-xl shadow-xl shadow-teal-900/20 transition-all transform hover:-translate-y-1 hover:shadow-2xl text-center"
          >
            {lang === 'ko' ? '초록 접수' : 'Abstract Submission'}
          </a>
        </div>
        {/* Chip Info */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <span className="inline-flex items-center px-4 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-sm font-medium text-slate-100">
            📅 {dates}
          </span>
          <span className="inline-flex items-center px-4 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-sm font-medium text-slate-100">
            📍 {venueName}
          </span>
        </div>
      </div>

      {/* 3. Floating Info Bar (Removed as per request to use Chip style below title) */}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
            <h3 className="text-2xl font-bold mb-6 text-gray-900">등록 유형 선택</h3>
            <div className="space-y-3">
              <button onClick={() => navigate(`/${targetSlug}/auth?mode=login`)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition">
                로그인 / 회원가입 후 등록
                <span className="block text-xs font-normal opacity-80">이수 내역 관리 및 명찰 발급 가능</span>
              </button>
              <button onClick={() => navigate(`/${targetSlug}/register?mode=guest`)} className="w-full bg-gray-100 text-gray-800 py-4 rounded-xl font-bold hover:bg-gray-200 transition">
                비회원(Guest) 등록
                <span className="block text-xs font-normal opacity-60">일회성 등록</span>
              </button>
            </div>
            <button onClick={() => setShowModal(false)} className="mt-8 text-gray-400 text-sm hover:text-gray-600 font-medium">닫기</button>
          </div>
        </div>
      )}
    </section>
  );
};
