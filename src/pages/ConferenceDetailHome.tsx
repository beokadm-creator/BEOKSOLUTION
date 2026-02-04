import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useUserStore } from '../store/userStore';
import TermsAgreementModal from '../components/conference/TermsAgreementModal';

// 1. SAFE DATE UTILITY (Outside component)
const safeDate = (val: unknown): string => {
  try {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) {
      const dateVal = val as { toDate?: () => Date; seconds?: number };
      if (dateVal.toDate && typeof dateVal.toDate === 'function') return dateVal.toDate().toLocaleDateString();
      if (dateVal.seconds) return new Date(dateVal.seconds * 1000).toLocaleDateString();
    }
    return String(val);
  } catch {
    return 'Date Error';
  }
};

const ConferenceDetailHome: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  // Auth state (simplified - no member/non-member distinction)
  const { auth } = useAuth('');
  const user = auth.user;
  const { language, setLanguage } = useUserStore();

  // Legal Agreement Modal state
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [targetPath, setTargetPath] = useState('');
  const [terms, setTerms] = useState<{ title?: string; content?: string; required?: boolean } | null>(null);

  // Registration state
  const [isRegistered, setIsRegistered] = useState(false);

  // Footer Info state
  const [footerInfo, setFooterInfo] = useState<{
    bizRegNumber?: string;
    representativeName?: string;
    address?: string;
    contactEmail?: string;
    contactPhone?: string;
    operatingHours?: string;
    emailNotice?: string;
  } | null>(null);

    //2. INITIALIZE WITH DEFAULT DATA (Prevent White Screen)
    const [conf, setConf] = useState({
    title: "Loading Conference...",
    societyName: "e-Regi",
    location: "Loading...",
    startDate: "",
    endDate: "",
    exists: false // Flag to track if real data is loaded
  });

    useEffect(() => {
    if (!slug) return;
    console.log("Fetching conference:", slug); // Debug Log

    const fetchConf = async () => {
      try {
        const q = query(collection(db, 'conferences'), where('slug', '==', slug));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const d = snap.docs[0].data();
          const confId = d.id;
          const societyId = (d as { societyId?: string }).societyId || '';

          // 3. APPLY SAFE PARSER
          setConf({
            title: String(d.title || 'Untitled Event'),
            societyName: String(d.societyName || 'Academic Society'),
            location: String(d.location || 'Online / TBD'),
            startDate: safeDate(d.startDate),
            endDate: safeDate(d.endDate),
            exists: true
          });

          // 4. Check registration status
          checkRegistrationStatus(confId);

          // 5. Fetch terms from Firestore
          fetchTerms(societyId);

          // 6. Fetch footer info
          fetchFooterInfo(societyId);
        } else {
          setConf(prev => ({ ...prev, title: "Conference Not Found", exists: false }));
        }
      } catch (e) {
        console.error("Fetch Error:", e);
        setConf(prev => ({ ...prev, title: "Error Loading Data", exists: false }));
      }
    };

    const checkRegistrationStatus = async (confId: string) => {
      // Check if user is registered for this conference
      try {
        if (!user?.uid) {
          console.log('[ConferenceDetailHome] No user logged in');
          return;
        }

        // Check in users/{uid}/participations
        const participationsRef = collection(db, 'users', user.uid, 'participations');
        const q = query(participationsRef, where('conferenceId', '==', confId));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const docData = snap.docs[0].data();
          const status = docData?.paymentStatus || 'PENDING';

          setPaymentStatus(status);
          setRegistrationData(docData);

          // Only set as "registered" if payment is completed
          if (status === 'PAID') {
            setIsRegistered(true);
          } else {
            // Payment not completed - show register button
            console.log(`[ConferenceDetailHome] Payment not completed: ${status}`);
            setIsRegistered(false);
            setRegistrationData(null);
          }
        }
      } catch (e) {
        console.error("Failed to check registration:", e);
      }
    };

    const fetchTerms = async (societyId: string) => {
      if (!societyId) {
        console.log('[ConferenceDetailHome] No societyId to fetch terms');
        return;
      }

      try {
        const identityDocRef = doc(db, 'societies', societyId, 'settings', 'identity');
        const docSnap = await getDoc(identityDocRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('[ConferenceDetailHome] Terms loaded from Firestore:', societyId);
          console.log('[ConferenceDetailHome] Terms data keys:', Object.keys(data));
          console.log('[ConferenceDetailHome] Terms data:', JSON.stringify(data, null, 2));
          setTerms(data);
        } else {
          console.warn('[ConferenceDetailHome] No terms document found in Firestore');
          setTerms(undefined); // Explicitly undefined - TermsAgreementModal will handle this
        }
      } catch (e) {
        console.error('[ConferenceDetailHome] Failed to fetch terms:', e);
        setTerms(undefined);
      } finally {
        console.log('[ConferenceDetailHome] Terms loading complete');
      }
    };

    const fetchFooterInfo = async (societyId: string) => {
      if (!societyId) {
        console.log('[ConferenceDetailHome] No societyId to fetch footer info');
        return;
      }

      try {
        const societyDocRef = doc(db, 'societies', societyId);
        const docSnap = await getDoc(societyDocRef);

        if (docSnap.exists()) {
          const sData = docSnap.data();
          setFooterInfo(sData.footerInfo);
          console.log('[ConferenceDetailHome] Footer info loaded:', societyId);
        }
      } catch (e) {
        console.error('[ConferenceDetailHome] Failed to fetch footer info:', e);
      }
    };

    fetchConf();
  }, [slug, user?.uid]);

  // Handle register button click - show agreement modal first
  const handleRegisterClick = () => {
    setShowAgreementModal(true);
    setTargetPath(`/${slug}/register?mode=new-flow`);
  };

  // Handle agreement confirmation - navigate to registration
  const handleAgreementConfirm = () => {
    setShowAgreementModal(false);
    if (targetPath) {
      navigate(targetPath);
    }
  };

  // 4. ALWAYS RENDER UI (No early returns that hide HTML)
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* HEADER */}
      <header className="bg-white shadow-sm py-4 px-6 flex justify-between items-center sticky top-0 z-10">
        <div className="font-bold text-xl text-blue-900">{conf.societyName}</div>
        <button
          type="button"
          onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
          className="px-3 py-1 rounded text-sm font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
        >
          {language === 'ko' ? 'EN' : 'KO'}
        </button>
      </header>

      {/* BODY */}
      <main className="flex-grow flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-4xl w-full border-t-8 border-blue-600">
          <h1 className="text-3xl md:text-5xl font-black text-gray-900 mb-6">{conf.title}</h1>

          <div className="text-lg text-gray-600 mb-10 space-y-2">
            <p>📅 {conf.startDate} {conf.endDate ? `~ ${conf.endDate}` : ''}</p>
            <p>📍 {conf.location}</p>
          </div>

          {/* REGISTER BUTTON */}
          {conf.exists ? (
            <>
              {/* NOT REGISTERED - Show Register Button */}
              {!isRegistered ? (
                <button
                  type="button"
                  onClick={handleRegisterClick}
                  className="bg-blue-600 text-white text-xl font-bold px-12 py-5 rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition-all"
                >
                  사전등록 신청하기 (Register)
                </button>
              ) : (
                /* REGISTERED - Show Check Status Button */
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => navigate(`/${slug}/check-status`)}
                    className="bg-green-600 text-white text-xl font-bold px-12 py-5 rounded-full shadow-lg hover:bg-green-700 hover:scale-105 transition-all"
                  >
                    비회원등록조회 (Check Status)
                  </button>
                  <p className="text-gray-600 text-sm">
                    이미 등록된 비회원입니다. 위 버튼을 클릭하여 등록 내역을 확인하세요.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-red-500 font-bold">
              {conf.title === 'Loading Conference...' ? '불러오는 중...' : '행사 정보를 찾을 수 없습니다.'}
            </div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white py-12 px-6 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-xs font-black">e</div>
            <span className="text-lg font-black text-slate-900 tracking-tighter">eRegi</span>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <button type="button" onClick={() => navigate('/terms')} className="hover:text-slate-900 transition-colors">이용약관</button>
            <button type="button" onClick={() => navigate('/privacy')} className="hover:text-slate-900 transition-colors">개인정보처리방침</button>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2 text-right">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
              {footerInfo?.representativeName || '대표'} | Biz No: {footerInfo?.bizRegNumber || '-'}
            </p>
            <p className="text-[10px] text-slate-400">
              {footerInfo?.address || 'Address not available'}
            </p>
            <p className="text-[10px] text-slate-400">
              {footerInfo?.contactPhone ? `TEL ${footerInfo.contactPhone}` : ''} {footerInfo?.contactEmail ? `/ ${footerInfo.contactEmail}` : ''}
            </p>
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">
              &copy; 2026 eRegi. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Terms Agreement Modal */}
      <TermsAgreementModal
        isOpen={showAgreementModal}
        onClose={() => setShowAgreementModal(false)}
        onAgree={handleAgreementConfirm}
        lang="ko"
        terms={terms}
      />
    </div>
  );
};
export default ConferenceDetailHome;
