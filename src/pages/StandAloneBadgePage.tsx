import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // RAW SDK
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore'; // RAW SDK
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { SESSION_KEYS } from '../utils/cookie';

   const StandAloneBadgePage: React.FC = () => {
      // BUGFIX-20250124: Fixed React error #130 by moving unsubscribeDB to outer scope
  const { slug } = useParams();
  const navigate = useNavigate();
   const [status, setStatus] = useState("INIT"); // INIT, LOADING, READY, NO_AUTH, NO_DATA, REDIRECTING
   const [ui, setUi] = useState<{name: string, aff: string, id: string, issued: boolean, zone: string, time: string, license: string, status: string, badgeQr: string | null} | null>(null);
   const [msg, setMsg] = useState("초기화 중...");

  // Helper to determine correct confId
  const getConfIdToUse = (slugVal: string | undefined): string => {
      if (!slugVal) return 'kadd_2026spring';

      if (slugVal.includes('_')) {
          return slugVal;
      } else {
          const hostname = window.location.hostname;
          const parts = hostname.split('.');
          let societyIdToUse = 'kadd';

          if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
              societyIdToUse = parts[0].toLowerCase();
          }

          return `${societyIdToUse}_${slugVal}`;
      }
  };

   useEffect(() => {
      const auth = getAuth();
      const db = getFirestore();

      let unsubscribeDB: (() => void) | null = null; // Track DB subscription in outer scope

      // 1. Listen for Firebase Auth FIRST (for regular members)
      const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
          if (user) {
              // Firebase user authenticated - proceed to show badge
              setStatus("LOADING");
              setMsg("데이터 로드 중...");

              const confIdToUse = getConfIdToUse(slug);

              console.log('[StandAloneBadgePage] Firebase user authenticated, fetching badge:', { userId: user.uid, confId: confIdToUse });

              // CRITICAL FIX: Query by userId field, NOT by document ID
              // Registration doc ID is different from userId
              // We need to query registrations where userId === user.uid
              const q = query(
                  collection(db, 'conferences', confIdToUse, 'registrations'),
                  where('userId', '==', user.uid),
                  where('paymentStatus', '==', 'PAID')  // Only show PAID registrations
              );

              unsubscribeDB = onSnapshot(q, (snap) => {
      if (snap.empty) {
          console.log('[StandAloneBadgePage] No PAID registration found for user');
          setStatus("NO_DATA");
          setMsg("등록 정보가 없습니다.");
      } else {
          // Get most recent registration (first one in query)
          const d = snap.docs[0].data();
          console.log('[StandAloneBadgePage] Registration found:', d);
          // EXTREME SAFETY: String() everything - prevent object rendering error
          const uiName = String(d.userName || d.userInfo?.name || 'No Name');
          const uiAff = String(d.affiliation || d.userAffiliation || d.userInfo?.affiliation || '-');
          const uiId = String(snap.docs[0].id);
          const uiIssued = !!d.badgeIssued || !!d.badgeQr;
          const uiZone = String(d.attendanceStatus === 'INSIDE' ? (d.currentZone || 'Inside') : 'OUTSIDE');
          const uiTime = String(d.totalMinutes || '0');
          const uiLicense = String(d.licenseNumber || d.userInfo?.licenseNumber || '-');
          const uiStatus = String(d.attendanceStatus || 'OUTSIDE');
          const uiBadgeQr = d.badgeQr || null;
          console.log('[StandAloneBadgePage] Sanitized UI data:', { uiName, uiAff, uiId, uiIssued, uiZone, uiTime, uiLicense, uiStatus, uiBadgeQr });
          setUi({
              name: uiName,
              aff: uiAff,
              id: uiId,
              issued: uiIssued,
              zone: uiZone,
              time: uiTime,
              license: uiLicense,
              status: uiStatus,
              badgeQr: uiBadgeQr
          });
          setStatus("READY");
          setMsg("");
                  }
              });
          } else {
              // No Firebase user - check for non-member session
              const nonMemberSession = sessionStorage.getItem(SESSION_KEYS.NON_MEMBER);
              if (nonMemberSession) {
                  try {
                      const session = JSON.parse(nonMemberSession);
                      const currentConfId = session.cid;

                      // Verify session is for current conference
                      if (!slug) return;

                      const confIdToUse = getConfIdToUse(slug);

                      // Check if session is for different conference
                      if (currentConfId !== confIdToUse) {
                          console.log('[StandAloneBadgePage] Session for different conference, redirecting to check-status');
                          navigate(`/${slug}/check-status?lang=ko`, { replace: true });
                          return;
                      }

                      // For non-members, redirect to NonMemberHubPage which has QR code
                      console.log('[StandAloneBadgePage] Non-member detected, redirecting to hub', { registrationId: session.registrationId });
                      navigate(`/${slug}/non-member/hub`, { replace: true });
                      return;
                  } catch (err) {
                      console.error('[StandAloneBadgePage] Failed to parse non-member session:', err);
                  }
              } else {
                  setStatus("NO_AUTH");
                  setMsg("로그인이 필요합니다.");
              }
          }
      });

      return () => {
          if (unsubscribeDB) unsubscribeDB(); // Clean up DB subscription first
          if (unsubscribeAuth) unsubscribeAuth(); // Then clean up auth subscription
      };
  }, [slug, navigate]);

  if (msg && status !== "READY") return <div className="p-10 text-center font-bold text-gray-500 flex items-center justify-center min-h-screen">{msg}</div>;
  if (!ui) return <div className="p-10 text-center flex items-center justify-center min-h-screen">데이터 로드 실패</div>;

   // Determine which QR to show
   const showBadgeQr = ui.issued && ui.badgeQr;
   const qrValue = showBadgeQr ? ui.badgeQr : ui.id;

   return (
        <div className="min-h-screen bg-white flex flex-col items-center p-4 font-sans">
          <div className={`w-full max-w-sm border-4 rounded-3xl p-8 text-center shadow-2xl transition-all ${ui.issued ? 'border-blue-600' : 'border-gray-300'}`}>
            <h1 className="text-xl font-bold mb-6 tracking-wide text-gray-800 uppercase">
              {ui.issued ? 'Digital Name Tag' : 'Registration Voucher'}
            </h1>

            {/* 소속 (상단에 배치) */}
            <p className="text-lg text-gray-600 font-medium mb-2">{ui.aff}</p>

            {/* 이름 */}
            <h2 className="text-3xl font-black text-gray-900 mb-6 tracking-tight">{ui.name}</h2>

            {/* QR Code - Switch based on issuance status */}
            <div className="bg-white p-4 inline-block rounded-2xl shadow-inner border border-gray-100 mb-6">
              <QRCodeSVG value={qrValue} size={180} level="M" includeMargin={false} />
            </div>

            {/* 면허번호 */}
            {ui.license && ui.license !== '-' && (
              <div className="mt-2 mb-6 py-2 px-4 bg-gray-50 rounded-lg text-sm font-medium text-gray-700">
                면허번호: {ui.license}
              </div>
            )}

            {/* Digital Badge Only - Attendance Info */}
            {ui.issued && (
              <div className="space-y-3 mb-6">
                {/* Attendance Status */}
                <div className={`py-3 px-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 ${
                  ui.status === 'INSIDE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {ui.status === 'INSIDE' ? '🟢 입장 중 (INSIDE)' : '🔴 퇴장 상태 (OUTSIDE)'}
                </div>

                {/* Current Zone */}
                {ui.zone && ui.zone !== 'OUTSIDE' && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl py-2 px-4">
                    <p className="text-sm text-blue-800 font-medium">
                      현재 위치: {ui.zone}
                    </p>
                  </div>
                )}

                {/* Total Attendance Time */}
                {ui.time && parseInt(ui.time) > 0 && (
                  <div className="bg-purple-50 border border-purple-100 rounded-xl py-2 px-4">
                    <p className="text-sm text-purple-800 font-medium">
                      총 참여 시간: {Math.floor(parseInt(ui.time) / 60)}시간 {parseInt(ui.time) % 60}분
                    </p>
                  </div>
                )}
              </div>
            )}

            {!ui.issued && (
              <div className="mb-6 py-3 px-4 bg-gray-50 text-gray-500 text-sm rounded-xl">
                현장 데스크에서 QR코드를 제시해주세요.
              </div>
            )}

             {/* 학술대회 홈페이지 바로 가기 버튼 */}
             <a
               href={`https://${window.location.hostname}/${slug.split('_')[1]}`}
               className="inline-block w-full mt-4 py-3 px-6 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-center"
             >
                학술대회 홈페이지 바로 가기
             </a>
          </div>
        </div>
   );
};

export default StandAloneBadgePage;
