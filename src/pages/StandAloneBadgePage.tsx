import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // RAW SDK
import { getFirestore, collection, query, where, onSnapshot, orderBy, type Query } from 'firebase/firestore'; // RAW SDK
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { SESSION_KEYS } from '../utils/cookie';
import { RefreshCw, AlertCircle, CheckCircle, Loader2, Clock, FileText, Calendar, Languages, Download, User, MapPin, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

   const StandAloneBadgePage: React.FC = () => {
      // BUGFIX-20250124: Fixed React error #130 by moving unsubscribeDB to outer scope
  const { slug } = useParams();
  const navigate = useNavigate();
   const [status, setStatus] = useState("INIT"); // INIT, LOADING, READY, NO_AUTH, NO_DATA, REDIRECTING
   const [ui, setUi] = useState<{name: string, aff: string, id: string, issued: boolean, zone: string, time: string, license: string, status: string, badgeQr: string | null, receiptNumber?: string, sessionsCompleted?: number, sessionsTotal?: number} | null>(null);
   const [msg, setMsg] = useState("초기화 중...");
   const [refreshing, setRefreshing] = useState(false);
   const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
   const lastQueryRef = typeof window !== 'undefined' ? useRef<Query | null>(null) : null;

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
                   where('paymentStatus', '==', 'PAID'),  // Only show PAID registrations
                   orderBy('createdAt', 'desc')
               );

               // Store query for refresh
               if (lastQueryRef) {
                   lastQueryRef.current = q;
               }

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
           const uiReceiptNumber = String(d.receiptNumber || '');
           const uiSessionsCompleted = d.sessionsCompleted ? Number(d.sessionsCompleted) : undefined;
           const uiSessionsTotal = d.sessionsTotal ? Number(d.sessionsTotal) : undefined;
           console.log('[StandAloneBadgePage] Sanitized UI data:', { uiName, uiAff, uiId, uiIssued, uiZone, uiTime, uiLicense, uiStatus, uiBadgeQr, uiReceiptNumber });
           setUi({
               name: uiName,
               aff: uiAff,
               id: uiId,
               issued: uiIssued,
               zone: uiZone,
               time: uiTime,
               license: uiLicense,
               status: uiStatus,
               badgeQr: uiBadgeQr,
               receiptNumber: uiReceiptNumber,
               sessionsCompleted: uiSessionsCompleted,
               sessionsTotal: uiSessionsTotal
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

   // Auto-refresh when badge is NOT issued (voucher state)
   useEffect(() => {
       if (status === "READY" && ui && !ui.issued && lastQueryRef?.current) {
           // Poll every 2 seconds to check if badge has been issued
           // Faster polling for immediate switch after InfoDesk scan
           refreshIntervalRef.current = setInterval(() => {
               setRefreshing(true);
               // Re-query to get latest data
               onSnapshot(lastQueryRef.current!, (snap) => {
                   if (!snap.empty) {
                       const d = snap.docs[0].data();
                       const uiIssued = !!d.badgeIssued || !!d.badgeQr;
                       if (uiIssued) {
                           // Badge has been issued - update UI
                           setUi((prev) => ({
                               ...prev!,
                               issued: true,
                               badgeQr: d.badgeQr || null,
                               status: String(d.attendanceStatus || 'OUTSIDE'),
                               zone: String(d.attendanceStatus === 'INSIDE' ? (d.currentZone || 'Inside') : 'OUTSIDE'),
                               time: String(d.totalMinutes || '0')
                           }));
                           setRefreshing(false);
                       }
                   }
                   setRefreshing(false);
               });
           }, 2000);

           return () => {
               if (refreshIntervalRef.current) {
                   clearInterval(refreshIntervalRef.current);
                   refreshIntervalRef.current = null;
               }
           };
       } else if (refreshIntervalRef.current) {
           // Clear interval if badge is issued
           clearInterval(refreshIntervalRef.current);
           refreshIntervalRef.current = null;
       }
   }, [status, ui?.issued]);

   if (msg && status !== "READY") return (
       <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center font-sans">
           <div className="text-center">
               <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-4" />
               <p className="text-xl font-medium text-gray-600">{msg}</p>
           </div>
       </div>
   );
   if (!ui) return <div className="p-10 text-center flex items-center justify-center min-h-screen">데이터 로드 실패</div>;

    // Determine which QR to show
    const showBadgeQr = ui.issued && ui.badgeQr;
    const qrValue = showBadgeQr ? ui.badgeQr : ui.id;
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

    // VOUCHER STATE (not issued yet)
    if (!ui.issued) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex flex-col items-center justify-center p-4 font-sans">
                <div className="w-full max-w-sm">
                    {/* Temporary Voucher Card - Visually Distinct from Issued Badge */}
                    <div className="bg-white border-4 border-amber-300 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
                        {refreshing && (
                            <div className="absolute top-3 right-3 z-10">
                                <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
                            </div>
                        )}

                        {/* Pending Badge Indicator - Top Banner */}
                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-400 to-orange-400 py-2 px-4">
                            <div className="flex items-center justify-center gap-2 text-white">
                                <Clock className="w-4 h-4 animate-pulse" />
                                <span className="text-xs font-bold tracking-wide">BADGE PENDING</span>
                            </div>
                        </div>

                        {/* Watermark Background */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none mt-8">
                            <div className="text-8xl font-black text-gray-900 transform -rotate-12">TEMPORARY</div>
                        </div>

                        {/* Content Container - Relative to sit above watermark */}
                        <div className="relative z-10 mt-8">
                            {/* Header with Icon */}
                            <div className="mb-4">
                                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <FileText className="w-8 h-8 text-amber-600" />
                                </div>
                                <h1 className="text-xl font-black mb-1 tracking-wide text-amber-700">
                                    등록 확인 바우처
                                </h1>
                                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Registration Voucher</p>
                            </div>

                            {/* Warning Notice */}
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl py-2 px-3 mb-4">
                                <p className="text-xs font-bold text-amber-800">
                                    ⚠️ 현장 인포데스크에서 QR을 스캔하여<br/>디지털 명찰을 발급받아야 합니다
                                </p>
                            </div>

                            {/* Organization */}
                            <p className="text-sm text-gray-600 font-medium mb-1">{ui.aff}</p>

                            {/* Name */}
                            <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">{ui.name}</h2>

                            {/* Receipt Number - Prominent */}
                            {ui.receiptNumber && (
                                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl py-3 px-4 mb-4 border border-amber-200">
                                    <p className="text-xs font-bold text-amber-600 uppercase mb-1">Receipt Number</p>
                                    <p className="text-xl font-black text-amber-700 tracking-wider">{ui.receiptNumber}</p>
                                </div>
                            )}

                            {/* License Number */}
                            {ui.license && ui.license !== '-' && (
                                <div className="bg-gray-50 rounded-lg py-2 px-3 mb-4">
                                    <p className="text-xs font-semibold text-gray-600">면허번호</p>
                                    <p className="text-sm font-bold text-gray-800">{ui.license}</p>
                                </div>
                            )}

                            {/* QR Code - The Main Element */}
                            <div className="bg-white p-3 inline-block rounded-2xl shadow-lg border-2 border-amber-200 mb-4">
                                <div className="text-xs font-semibold text-gray-500 mb-2">인포데스크 제시용 QR</div>
                                <QRCodeSVG value={qrValue} size={160} level="M" includeMargin={false} />
                            </div>

                            {/* Instruction */}
                            <div className="bg-amber-100 border border-amber-300 rounded-xl py-3 px-4">
                                <p className="text-sm font-bold text-amber-900 flex items-center justify-center gap-2">
                                    <User className="w-4 h-4" />
                                    현장 인포데스크에 QR 제시
                                </p>
                                <p className="text-xs text-amber-700 mt-1">디지털 명찰을 발급받으세요</p>
                            </div>
                        </div>
                    </div>

                    {/* Refresh Indicator */}
                    {refreshing && (
                        <div className="mt-4 text-center text-sm text-amber-700 font-medium flex items-center justify-center gap-2 bg-white/80 rounded-lg py-2 px-4">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            명찰 발급 상태 확인 중...
                        </div>
                    )}

                    {/* Home Button */}
                    <a
                        href={`https://${hostname}/${slug && slug.includes('_') ? slug.split('_')[1] : slug || ''}`}
                        className="block w-full mt-4 py-3 px-6 bg-white text-amber-700 font-bold rounded-xl hover:bg-amber-50 transition-colors text-center border-2 border-amber-200 shadow-md"
                    >
                        학술대회 홈페이지
                    </a>
                </div>
            </div>
        );
    }

    // ISSUED BADGE STATE
    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 flex flex-col p-4 font-sans">
            <div className="w-full max-w-md mx-auto">
                {/* Digital Badge Card - Professional Name Tag */}
                <div className="bg-white border-4 border-emerald-500 rounded-3xl overflow-hidden shadow-2xl">
                    {/* Issued Badge Header - Always Visible */}
                    <div className="bg-gradient-to-r from-emerald-500 to-green-500 py-2 px-4">
                        <div className="flex items-center justify-center gap-2 text-white">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs font-bold tracking-wide">DIGITAL BADGE ISSUED</span>
                        </div>
                    </div>

                    {/* Badge Info - Always Visible */}
                    <div className="p-6 text-center">
                        <p className="text-sm text-gray-600 font-medium mb-1">{ui.aff || '-'}</p>
                        <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">{ui.name}</h2>

                        {/* License Number */}
                        {ui.license && ui.license !== '-' && (
                            <div className="bg-emerald-50 rounded-lg py-1 px-3 mb-4 inline-block">
                                <p className="text-xs font-semibold text-emerald-700">면허번호: {ui.license}</p>
                            </div>
                        )}

                        {/* QR Code - Always Visible & Accessible */}
                        <div className="bg-white p-3 inline-block rounded-2xl shadow-lg border-2 border-emerald-200 mb-3">
                            {showBadgeQr && (
                                <QRCodeSVG value={qrValue} size={140} level="M" includeMargin={false} />
                            )}
                        </div>
                        <p className="text-xs font-semibold text-emerald-700">입장/퇴장용 QR 코드</p>
                    </div>

                    {/* Tabbed Interface */}
                    <Tabs defaultValue="status" className="w-full">
                        <TabsList className="grid grid-cols-5 w-full h-auto p-1 bg-gray-50 border-t border-gray-200">
                            <TabsTrigger value="status" className="text-xs py-2 px-1 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">
                                <User className="w-3 h-3 mr-1" />
                                상태
                            </TabsTrigger>
                            <TabsTrigger value="sessions" className="text-xs py-2 px-1 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                수강
                            </TabsTrigger>
                            <TabsTrigger value="materials" className="text-xs py-2 px-1 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">
                                <FileText className="w-3 h-3 mr-1" />
                                자료
                            </TabsTrigger>
                            <TabsTrigger value="program" className="text-xs py-2 px-1 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">
                                <Calendar className="w-3 h-3 mr-1" />
                                프로그램
                            </TabsTrigger>
                            <TabsTrigger value="translation" className="text-xs py-2 px-1 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">
                                <Languages className="w-3 h-3 mr-1" />
                                번역
                            </TabsTrigger>
                        </TabsList>

                        {/* Status Tab */}
                        <TabsContent value="status" className="p-4 space-y-3">
                            <div className={`py-3 px-4 rounded-xl font-bold text-center ${
                                ui.status === 'INSIDE'
                                    ? 'bg-green-100 text-green-700 border-2 border-green-300'
                                    : 'bg-gray-100 text-gray-500 border-2 border-gray-300'
                            }`}>
                                <div className="flex items-center justify-center gap-2">
                                    {ui.status === 'INSIDE'
                                        ? <><span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" /><span>입장 중</span></>
                                        : <><span className="w-3 h-3 bg-gray-400 rounded-full" /><span>퇴장 상태</span></>
                                    }
                                </div>
                            </div>

                            {ui.zone && ui.zone !== 'OUTSIDE' && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl py-2 px-3">
                                    <p className="text-xs text-blue-600 font-semibold mb-1">현재 위치</p>
                                    <p className="text-sm font-bold text-blue-900 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {ui.zone}
                                    </p>
                                </div>
                            )}

                            {ui.time && parseInt(ui.time) > 0 && (
                                <div className="bg-purple-50 border border-purple-200 rounded-xl py-2 px-3">
                                    <p className="text-xs text-purple-600 font-semibold mb-1">총 참여 시간</p>
                                    <p className="text-sm font-bold text-purple-900 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {Math.floor(parseInt(ui.time) / 60)}시간 {parseInt(ui.time) % 60}분
                                    </p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Sessions Tab */}
                        <TabsContent value="sessions" className="p-4">
                            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl py-4 px-4 border border-emerald-200 text-center">
                                <p className="text-xs text-emerald-600 font-semibold mb-2">이수 현황</p>
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-3xl font-black text-emerald-700">
                                        {ui.sessionsCompleted || 0}
                                    </span>
                                    <span className="text-xl text-emerald-600">/</span>
                                    <span className="text-xl font-bold text-emerald-600">
                                        {ui.sessionsTotal || '-'}
                                    </span>
                                </div>
                                <p className="text-xs text-emerald-600 mt-2">완료된 세션</p>
                            </div>
                        </TabsContent>

                        {/* Materials Tab */}
                        <TabsContent value="materials" className="p-4">
                            <div className="space-y-2">
                                <a
                                    href={`https://${hostname}/${slug}/materials`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full py-3 px-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-center transition-colors"
                                >
                                    <p className="text-sm font-bold text-blue-900 flex items-center justify-center gap-2">
                                        <Download className="w-4 h-4" />
                                        강의 자료실
                                    </p>
                                </a>
                                <a
                                    href={`https://${hostname}/${slug}/abstracts`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full py-3 px-4 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-center transition-colors"
                                >
                                    <p className="text-sm font-bold text-purple-900 flex items-center justify-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        초록집
                                    </p>
                                </a>
                            </div>
                        </TabsContent>

                        {/* Program Tab */}
                        <TabsContent value="program" className="p-4">
                            <a
                                href={`https://${hostname}/${slug}/program`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full py-3 px-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-center transition-colors"
                            >
                                <p className="text-sm font-bold text-amber-900 flex items-center justify-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    학술대회 프로그램 보기
                                </p>
                            </a>
                        </TabsContent>

                        {/* Translation Tab */}
                        <TabsContent value="translation" className="p-4">
                            <div className="bg-gray-50 rounded-xl py-4 px-4 border border-gray-200 text-center">
                                <Languages className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-xs text-gray-500 font-semibold mb-2">실시간 번역</p>
                                <p className="text-xs text-gray-400 mb-3">준비 중입니다</p>
                                <p className="text-xs text-gray-400">곧 제공될 서비스입니다</p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Home Button */}
                <a
                    href={`https://${hostname}/${slug && slug.includes('_') ? slug.split('_')[1] : slug || ''}`}
                    className="block w-full mt-4 py-3 px-6 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transition-colors text-center border-2 border-emerald-200 shadow-md"
                >
                    학술대회 홈페이지
                </a>
            </div>
        </div>
    );
};

export default StandAloneBadgePage;
