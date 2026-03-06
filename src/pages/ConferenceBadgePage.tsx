import React, { useLayoutEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import QRCode from 'react-qr-code';

const ConferenceBadgePage: React.FC = () => {
  const { slug } = useParams();
  const { auth } = useAuth();
  const [uiData, setUiData] = useState<{
    status: string;
    zone: string;
    name: string;
    aff: string;
    id: string;
    issued: boolean;
    qrValue: string;
    receiptNumber: string;
    lastCheckIn: any;
    baseMinutes: number;
  } | null>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [liveMinutes, setLiveMinutes] = useState<number>(0);
  const [msg, setMsg] = useState("초기화 중...");

  // Gamification states
  const [totalVendors, setTotalVendors] = useState<number>(0);
  const [myStamps, setMyStamps] = useState<string[]>([]);

  useLayoutEffect(() => {
    if (!slug || !auth.user) {
      requestAnimationFrame(() => {
        setMsg("로그인이 필요합니다.");
      });
      return;
    }

    const initializeMsg = "데이터 조회 중...";
    requestAnimationFrame(() => {
      setMsg(initializeMsg);
    });

    // CRITICAL FIX: Verify auth.user is for current conference
    // auth.user.id must match registrations in this conference to avoid cross-conference data leakage
    const userId = auth.user.id;
    console.log('[ConferenceBadgePage] Looking for badge:', { userId, conference: slug });

    // Fix: Query registrations with payment status filter
    // Query: userId + conference + PAID status
    const q = query(
      collection(db, `conferences/${slug}/registrations`),
      where('userId', '==', userId),
      where('paymentStatus', '==', 'PAID'),  // CRITICAL: Only show PAID registrations
      orderBy('createdAt', 'desc') // Get most recent PAID registration
    );

    // Fetch Zones for real-time break exclusion logic
    import('firebase/firestore').then(async ({ doc, getDoc }) => {
      try {
        const rulesRef = doc(db, `conferences/${slug}/settings/attendance`);
        const rulesSnap = await getDoc(rulesRef);
        if (rulesSnap.exists()) {
          const allRules = rulesSnap.data().rules || {};
          let allZones: any[] = [];
          Object.entries(allRules).forEach(([dateStr, rule]: [string, any]) => {
            if (rule && rule.zones) {
              rule.zones.forEach((z: any) => {
                allZones.push({ ...z, ruleDate: dateStr });
              });
            }
          });
          setZones(allZones);
        }
      } catch (e) {
        console.error('Failed to load rules for live calculation', e);
      }
    });

    const unsub = onSnapshot(q, (snap) => {
      console.log('[ConferenceBadgePage] Query result:', {
        slug,
        userId,
        docsFound: snap.docs.length,
        hasData: !snap.empty
      });

      if (snap.empty) {
        setUiData(null);
        setMsg("등록 정보가 없습니다.");
        return;
      }

      const docData = snap.docs[0].data();
      const paymentStatus = docData?.paymentStatus || 'UNKNOWN';

      console.log('[ConferenceBadgePage] Registration data:', {
        id: snap.docs[0].id,
        paymentStatus,
        userName: docData?.userName,
        hasBadgeIssued: docData?.badgeIssued
      });

      // CRITICAL FIX: Only show badge for PAID registrations
      if (paymentStatus !== 'PAID') {
        setUiData(null);
        setMsg(`결제가 완료되지 않은 등록입니다. 결제 상태: ${paymentStatus}`);
        return;
      }

      // EXTREME SANITIZATION
      // Voucher QR: Use regId directly (no CONF- prefix) for InfoDesk scanning
      const regId = snap.docs[0].id;
      const voucherQr = String(docData.confirmationQr || regId);

      // Badge QR: Use BADGE-{regId} format
      const badgeQr = String(docData.badgeQr || `BADGE-${regId}`);

      const finalQrValue = docData.badgeIssued ? badgeQr : voucherQr;

      console.log('[ConferenceBadgePage] QR Code Debug:', {
        regId,
        confirmationQr: docData.confirmationQr,
        badgeQr: docData.badgeQr,
        badgeIssued: docData.badgeIssued,
        voucherQr,
        finalQrValue
      });

      const baseMinutes = Number(docData.totalMinutes || 0);

      setUiData({
        status: String(docData.attendanceStatus || 'OUTSIDE'),
        zone: String(docData.attendanceStatus === 'INSIDE' ? (docData.currentZone || 'Inside') : 'OUTSIDE'),
        name: String(docData.userName || docData.name || '이름 없음'),
        aff: String(docData.affiliation || docData.organization || docData.userAffiliation || docData.userInfo?.affiliation || '소속 없음'),
        id: String(regId || 'ERR'),
        issued: !!docData.badgeIssued,
        qrValue: finalQrValue,
        receiptNumber: String(docData.receiptNumber || docData.orderId || '-'),
        lastCheckIn: docData.lastCheckIn,
        baseMinutes
      });
      setLiveMinutes(baseMinutes);
      setMsg(""); // Clear msg
    });

    return () => unsub();
  }, [slug, auth.user]);

  // Live Duration Ticker calculation
  useLayoutEffect(() => {
    if (!uiData) return;

    const updateLiveMinutes = () => {
      if (uiData.status !== 'INSIDE' || !uiData.lastCheckIn) {
        setLiveMinutes(uiData.baseMinutes || 0);
        return;
      }

      const now = new Date();
      const start = uiData.lastCheckIn.toDate ? uiData.lastCheckIn.toDate() : new Date();
      let boundedStart = start;
      let boundedEnd = now;

      const currentZoneId = uiData.zone;
      const zoneRule = zones.find(z => z.id === currentZoneId);

      // Apply zone session boundaries to match backend GatePage calculation
      if (zoneRule && zoneRule.start && zoneRule.end) {
        const localDateStr = zoneRule.ruleDate || start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, '0') + "-" + String(start.getDate()).padStart(2, '0');
        const sessionStart = new Date(`${localDateStr}T${zoneRule.start}:00`);
        const sessionEnd = new Date(`${localDateStr}T${zoneRule.end}:00`);

        boundedStart = new Date(Math.max(start.getTime(), sessionStart.getTime()));
        boundedEnd = new Date(Math.min(now.getTime(), sessionEnd.getTime()));
      }

      let diffMins = 0;
      if (boundedEnd > boundedStart) {
        diffMins = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);
      }

      let deduction = 0;

      if (zoneRule && zoneRule.breaks && Array.isArray(zoneRule.breaks)) {
        zoneRule.breaks.forEach((brk: any) => {
          const localDateStr = zoneRule.ruleDate || start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, '0') + "-" + String(start.getDate()).padStart(2, '0');
          const breakStart = new Date(`${localDateStr}T${brk.start}:00`);
          const breakEnd = new Date(`${localDateStr}T${brk.end}:00`);
          const overlapStart = Math.max(boundedStart.getTime(), breakStart.getTime());
          const overlapEnd = Math.min(boundedEnd.getTime(), breakEnd.getTime());
          if (overlapEnd > overlapStart) {
            const overlapMins = Math.floor((overlapEnd - overlapStart) / 60000);
            deduction += overlapMins;
          }
        });
      }

      const activeMinutes = Math.max(0, diffMins - deduction);
      setLiveMinutes((uiData.baseMinutes || 0) + activeMinutes);
    };

    updateLiveMinutes();
    const timer = setInterval(updateLiveMinutes, 30000);
    return () => clearInterval(timer);
  }, [uiData, zones]);

  // Gamification Data Loader
  useLayoutEffect(() => {
    if (!slug || !uiData?.id) return;

    let unsubStamps = () => { };

    const fetchGamification = async () => {
      try {
        // 1. Fetch total vendors participating in stamp tour
        const vSnap = await getDocs(query(collection(db, `conferences/${slug}/sponsors`), where("isStampTourParticipant", "==", true)));
        // Get valid vendorIds that are actively participating in the stamp tour for this conference
        const validVendorIds = new Set(vSnap.docs.filter(d => d.data().vendorId).map(d => d.data().vendorId));
        setTotalVendors(validVendorIds.size);

        // 2. Listen to my stamps
        const sQ = query(collection(db, `conferences/${slug}/stamps`), where('userId', '==', uiData.id));
        unsubStamps = onSnapshot(sQ, (snap) => {
          const list = snap.docs.map(d => d.data());
          // Only count stamps for vendors that are CURRENTLY participants
          const uniqueVendors = Array.from(new Set(list.map(s => s.vendorId))).filter(vid => validVendorIds.has(vid));
          setMyStamps(uniqueVendors);
        });
      } catch (e) {
        console.error("Failed to load Gamification data", e);
      }
    };

    fetchGamification();

    return () => {
      unsubStamps();
    }
  }, [slug, uiData?.id]);

  // Render - outside useEffect
  if (msg) return <div className="p-10 text-center font-bold text-gray-500 flex items-center justify-center min-h-screen">{msg}</div>;
  if (!uiData) return <div className="p-10 text-center flex items-center justify-center min-h-screen">데이터 로드 실패</div>;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-4 font-sans">
      <div className={`w-full max-w-sm border-4 rounded-3xl p-8 text-center shadow-2xl transition-all ${uiData.issued ? 'border-blue-600' : 'border-gray-300'}`}>
        <h1 className="text-xl font-bold mb-6 tracking-wide text-gray-800 uppercase">
          {uiData.issued ? 'Mobile Access Badge' : 'Registration Voucher'}
        </h1>

        <div className="bg-white p-4 inline-block rounded-2xl shadow-inner border border-gray-100 mb-6">
          {/* QRCode MUST have a fallback string */}
          <QRCode
            key={uiData.qrValue}
            value={uiData.qrValue || "ERROR"}
            size={180}
          />
        </div>

        <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">{uiData.name}</h2>
        <p className="text-lg text-gray-600 font-medium mb-6">{uiData.aff}</p>

        {uiData.issued && (
          <>
            <div className={`mt-6 py-3 px-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 ${uiData.status === 'INSIDE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {uiData.status === 'INSIDE' ? '🟢 입장 중 (INSIDE)' : '🔴 퇴장 상태 (OUTSIDE)'}
            </div>

            {liveMinutes > 0 && (
              <div className="mt-3 bg-purple-50 text-purple-700 rounded-xl py-2 px-4 flex justify-between items-center text-sm font-semibold border border-purple-100">
                <span>총 수강 시간</span>
                <span>{Math.floor(liveMinutes / 60)}시간 {liveMinutes % 60}분</span>
              </div>
            )}
          </>
        )}

        {!uiData.issued && (
          <div className="mt-6 py-3 px-4 bg-gray-50 text-gray-500 text-sm rounded-xl">
            현장 데스크에서 QR코드를 제시해주세요.
          </div>
        )}
      </div>

      {/* GAMIFICATION - STAMP TOUR */}
      {uiData && uiData.issued && totalVendors > 0 && (
        <div className="mt-6 w-full max-w-sm border-2 border-dashed border-indigo-400 rounded-3xl p-6 text-center shadow-md bg-indigo-50">
          <h3 className="text-xl font-bold text-indigo-900 mb-2">⭐ 부스 스탬프 투어</h3>
          <p className="text-sm text-indigo-700 mb-4">
            파트너사 부스를 방문하고 스탬프를 모아보세요!<br />
            <span className="font-semibold text-xs text-indigo-500">모두 모으면 경품 추첨 자동 응모!</span>
          </p>

          <div className="flex justify-between items-center text-sm font-bold text-indigo-800 mb-2">
            <span>내 진행 상황</span>
            <span className="text-indigo-600 bg-white px-3 py-1 rounded-full shadow-sm">{myStamps.length} / {totalVendors}</span>
          </div>

          <div className="w-full bg-indigo-200 rounded-full h-3 mb-4 overflow-hidden">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all duration-1000 ease-out relative"
              style={{ width: `${Math.min(100, (myStamps.length / totalVendors) * 100)}%` }}
            >
              {myStamps.length === totalVendors && (
                <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {Array.from({ length: totalVendors }).map((_, i) => (
              <div
                key={i}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm border ${i < myStamps.length
                  ? 'bg-indigo-500 border-indigo-600 text-white animate-bounce'
                  : 'bg-white border-indigo-200 text-transparent'
                  }`}
              >
                {i < myStamps.length && '⭐'}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <p className="text-sm font-bold text-gray-500 tracking-wider">REF: {uiData.receiptNumber}</p>
        <p className="text-[10px] text-gray-300 font-mono tracking-widest mt-1">ID: {uiData.id}</p>
      </div>
    </div>
  );
};

export default ConferenceBadgePage;
