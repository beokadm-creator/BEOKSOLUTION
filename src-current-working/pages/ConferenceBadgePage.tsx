import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import QRCode from 'react-qr-code';

const ConferenceBadgePage: React.FC = () => {
  const { slug } = useParams();
  const { auth } = useAuth('');
  // Use a single simple state for UI to avoid sync issues
  const [uiData, setUiData] = useState<{status: string, name: string, aff: string, id: string, issued: boolean} | null>(null);
  const [msg, setMsg] = useState("초기화 중...");

  useEffect(() => {
    if (!slug || !auth.user) { setMsg("로그인이 필요합니다."); return; }

    setMsg("데이터 조회 중...");

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

    const unsub = onSnapshot(q, (snap) => {
      console.log('[ConferenceBadgePage] Query result:', {
        slug,
        userId,
        docsFound: snap.docs.length,
        hasData: !snap.empty
      });

      if (snap.empty) { setUiData(null); setMsg("등록 정보가 없습니다."); return; }

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
      setUiData({
        status: String(docData.attendanceStatus || 'OUTSIDE'),
        name: String(docData.userName || '이름 없음'),
        aff: String(docData.affiliation || docData.userAffiliation || '소속 없음'),
        id: String(snap.docs[0]?.id || 'ERR'),
        issued: !!docData.badgeIssued
      });
      setMsg(""); // Clear msg
    });

    return () => unsub();
  }, [slug, auth.user, msg]);

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
          <QRCode value={uiData.id || "ERROR"} size={180} />
        </div>

        <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">{uiData.name}</h2>
        <p className="text-lg text-gray-600 font-medium mb-6">{uiData.aff}</p>

        {uiData.issued && (
          <div className={`mt-6 py-3 px-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 ${uiData.status === 'INSIDE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {uiData.status === 'INSIDE' ? '🟢 입장 중 (INSIDE)' : '🔴 퇴장 상태 (OUTSIDE)'}
          </div>
        )}

        {!uiData.issued && (
          <div className="mt-6 py-3 px-4 bg-gray-50 text-gray-500 text-sm rounded-xl">
            현장 데스크에서 QR코드를 제시해주세요.
          </div>
        )}
      </div>
      <p className="mt-6 text-[10px] text-gray-300 font-mono tracking-widest">{uiData.id}</p>
    </div>
  );
};

export default ConferenceBadgePage;
