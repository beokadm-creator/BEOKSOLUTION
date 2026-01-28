import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// 1. SAFE DATE UTILITY (Outside component)
const safeDate = (val: any): string => {
  try {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val.toDate && typeof val.toDate === 'function') return val.toDate().toLocaleDateString();
    if (val.seconds) return new Date(val.seconds * 1000).toLocaleDateString();
    return String(val); // Fallback
  } catch (e) {
    return 'Date Error';
  }
};

const ConferenceDetailHome: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  // 2. INITIALIZE WITH DEFAULT DATA (Prevent White Screen)
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
          // 3. APPLY SAFE PARSER
          setConf({
            title: String(d.title || 'Untitled Event'),
            societyName: String(d.societyName || 'Academic Society'),
            location: String(d.location || 'Online / TBD'),
            startDate: safeDate(d.startDate),
            endDate: safeDate(d.endDate),
            exists: true
          });
        } else {
            setConf(prev => ({ ...prev, title: "Conference Not Found", exists: false }));
        }
      } catch (e) {
        console.error("Fetch Error:", e);
        setConf(prev => ({ ...prev, title: "Error Loading Data", exists: false }));
      }
    };
    fetchConf();
  }, [slug]);

  // 4. ALWAYS RENDER UI (No early returns that hide HTML)
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* HEADER */}
      <header className="bg-white shadow-sm py-4 px-6 flex justify-between items-center sticky top-0 z-10">
        <div className="font-bold text-xl text-blue-900">{conf.societyName}</div>
        <div className="space-x-3">
             <button onClick={() => navigate(`/${slug}/auth?mode=login`)} className="text-gray-600 font-medium text-sm">Log In</button>
             <button onClick={() => navigate(`/${slug}/mypage`)} className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm font-bold">My Badge</button>
        </div>
      </header>

      {/* BODY */}
      <main className="flex-grow flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-4xl w-full border-t-8 border-blue-600">
            <h1 className="text-3xl md:text-5xl font-black text-gray-900 mb-6">{conf.title}</h1>
            
            <div className="text-lg text-gray-600 mb-10 space-y-2">
                <p>📅 {conf.startDate} {conf.endDate ? `~ ${conf.endDate}` : ''}</p>
                <p>📍 {conf.location}</p>
            </div>

            {/* REGISTER BUTTON (Only show if data exists) */}
            {conf.exists ? (
                <button
                    onClick={() => navigate(`/${slug}/register`)}
                    className="bg-blue-600 text-white text-xl font-bold px-12 py-5 rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition-all"
                >
                    사전등록 신청하기 (Register)
                </button>
            ) : (
                <div className="text-red-500 font-bold">
                    {conf.title === 'Loading Conference...' ? '불러오는 중...' : '행사 정보를 찾을 수 없습니다.'}
                </div>
            )}
        </div>
      </main>
      
      {/* DEBUG FOOTER */}
      <footer className="py-6 text-center text-xs text-gray-400">
         Slug: {slug} | Status: {conf.exists ? 'LOADED' : 'WAITING'} | V186
      </footer>
    </div>
  );
};
export default ConferenceDetailHome;
