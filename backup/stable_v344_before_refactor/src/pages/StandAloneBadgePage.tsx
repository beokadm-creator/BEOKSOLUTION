import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // RAW SDK
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore'; // RAW SDK
// import QRCode from 'react-qr-code'; // REMOVED TO PREVENT CRASHES

const StandAloneBadgePage: React.FC = () => {
  const { slug } = useParams();
  const [status, setStatus] = useState("INIT"); // INIT, LOADING, READY, NO_AUTH, NO_DATA
  const [ui, setUi] = useState<{name: string, aff: string, id: string, issued: boolean, zone: string, time: string, license: string} | null>(null);

  useEffect(() => {
      const auth = getAuth();
      const db = getFirestore();

      // 1. Listen for Auth directly
      const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
          if (!user) {
              setStatus("NO_AUTH");
              return;
          }

          if (!slug) return;

          // 2. Listen for Data directly
          setStatus("LOADING");
          const q = query(collection(db, 'registrations'), where('userId', '==', user.uid), where('slug', '==', slug));

          const unsubscribeDB = onSnapshot(q, (snap) => {
              if (snap.empty) {
                  setStatus("NO_DATA");
              } else {
                  const d = snap.docs[0].data();
                  // EXTREME SAFETY: String() everything
                  setUi({
                      name: String(d.userName || 'No Name'),
                      aff: String(d.affiliation || d.userAffiliation || '-'),
                      id: String(snap.docs[0].id),
                      issued: !!d.badgeIssued,
                      zone: String(d.attendanceStatus === 'INSIDE' ? (d.currentZone || 'Inside') : 'OUTSIDE'),
                      time: String(d.totalMinutes || '0'),
                      license: String(d.licenseNumber || '-')
                  });
                  setStatus("READY");
              }
          });

          return () => unsubscribeDB();
      });

      return () => unsubscribeAuth();
  }, [slug]);

  // RENDER (Pure HTML)
  if (status === "INIT") return <div className="p-10 text-center mt-10">Initializing...</div>;
  if (status === "NO_AUTH") return (
      <div className="p-10 text-center mt-10">
          <h2 className="text-xl font-bold mb-4">로그인이 필요합니다.</h2>
          <a href="/auth" className="text-blue-600 underline">로그인 하기</a>
      </div>
  );
  if (status === "LOADING") return <div className="p-10 text-center mt-10">Loading Badge...</div>;
  if (status === "NO_DATA") return <div className="p-10 text-center mt-10">등록 정보가 없습니다.</div>;
  if (!ui) return null;

  return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-sans">
           <div className={`w-full max-w-sm border-4 rounded-3xl p-8 text-center shadow-xl transition-all ${ui.issued ? 'border-blue-600' : 'border-gray-300'}`}>
              <h1 className="text-xl font-bold mb-8 text-gray-800 uppercase tracking-wide">
                  {ui.issued ? '디지털 명찰 (Digital Badge)' : '등록 확인증 (Voucher)'}
              </h1>
              
              <h2 className="text-3xl font-black mb-2 text-gray-900">{ui.name}</h2>
              <p className="text-gray-600 mb-8 text-lg">{ui.aff}</p>

              <div className="flex justify-center mb-8">
                  <div className="p-4 border rounded-2xl shadow-inner bg-white">
                      {/* CRASH-PROOF QR CODE (IMAGE API) */}
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${ui.id}`} 
                        alt="QR Code" 
                        className="w-48 h-48 mx-auto"
                      />
                  </div>
              </div>
              
              <p className="text-sm text-gray-400 mb-8">면허번호: {ui.license}</p>

              {ui.issued ? (
                   <div className="bg-blue-50 p-4 rounded-xl font-bold text-blue-800 border border-blue-100">
                      <div className="text-lg mb-1">
                          {ui.zone === 'OUTSIDE' ? '⚪ 퇴장 상태' : `🟢 입장 중 (${ui.zone})`}
                      </div>
                      <div className="text-sm font-normal text-blue-600">이수 시간: {ui.time}분</div>
                   </div>
              ) : (
                   <div className="bg-gray-50 p-4 rounded-xl text-gray-500 text-sm border border-gray-100">
                      인포데스크에서 활성화해주세요.
                   </div>
              )}
           </div>
           
           <div className="mt-8">
               <a href="/mypage" className="text-gray-400 text-sm underline hover:text-gray-600">
                   &larr; 목록으로 돌아가기
               </a>
           </div>
      </div>
  );
};
export default StandAloneBadgePage;
