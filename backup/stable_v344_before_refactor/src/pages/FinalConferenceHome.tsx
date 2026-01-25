import React, { useEffect, useState } from 'react'; 
import { useParams, useNavigate } from 'react-router-dom'; 
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'; 
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'; 

// --- SAFE RECURSIVE TRANSFORMER --- 
const getTx = (val: any, lang: 'KO' | 'EN'): string => { 
  try { 
    // 1. Null Check 
    if (val === null || val === undefined) return ''; 

    // 2. Primitives 
    if (typeof val === 'string') return val; 
    if (typeof val === 'number') return String(val); 
    if (typeof val === 'boolean') return ''; 

    // 3. Timestamps 
    if (val.toDate && typeof val.toDate === 'function') return val.toDate().toLocaleDateString(); 
    if (val.seconds) return new Date(val.seconds * 1000).toLocaleDateString(); 

    // 4. Objects (The Danger Zone) 
    if (typeof val === 'object') { 
       // Priority 1: Language Key 
       let candidate = lang === 'KO' ? val.ko : val.en; 
       
       // Priority 2: Fallbacks 
       if (!candidate) candidate = val.ko || val.en || val.name || val.title || val.label || val.text || val.address; 

       // CRITICAL RECURSION: If candidate is found but is ALSO an object, dive deeper. 
       if (candidate && typeof candidate === 'object') { 
           return getTx(candidate, lang); 
       } 
       
       // If candidate is a string/number 
       if (candidate) return String(candidate); 
       
       // Last Resort: If array, join it 
       if (Array.isArray(val)) return val.map(v => getTx(v, lang)).join(', '); 

       return ''; // Give up, return empty string. Never return the object itself. 
    } 
    return ''; 
  } catch (e) { 
    return ''; 
  } 
}; 

// --- VIEW MODEL --- 
interface ConferenceView { 
  title: string; 
  subtitle: string; 
  societyName: string; 
  description: string; 
  location: string; 
  dates: string; 
  contact: string; 
  president: string; 
  bizNum: string; 
  address: string; 
  email: string; 
} 

const EMPTY_VIEW: ConferenceView = { 
  title: '', subtitle: '', societyName: '', description: '', location: '', 
  dates: '', contact: '', president: '', bizNum: '', address: '', email: '' 
}; 

const FinalConferenceHome: React.FC = () => { 
  const { slug } = useParams(); 
  const navigate = useNavigate(); 
  
  const [user, setUser] = useState<any>(null); 
  const [loading, setLoading] = useState(true); 
  const [lang, setLang] = useState<'KO' | 'EN'>('KO'); 
  const [showModal, setShowModal] = useState(false); 
  
  const [rawData, setRawData] = useState<{conf: any, soc: any} | null>(null); 
  const [view, setView] = useState<ConferenceView>(EMPTY_VIEW); 

  // 1. FETCH 
  useEffect(() => { 
    const auth = getAuth(); 
    const unsub = onAuthStateChanged(auth, setUser); 

    const init = async () => { 
       if (!slug) return; 
       const db = getFirestore(); 
       const hostname = window.location.hostname; 
       let societyId = hostname.split('.')[0]; 
       if (hostname.includes('localhost') || hostname.includes('web.app')) societyId = ""; 

       let q = query(collection(db, 'conferences'), where('slug', '==', slug)); 
       if (societyId && societyId !== 'www' && societyId !== 'eregi') { 
           q = query(collection(db, 'conferences'), where('slug', '==', slug), where('societyId', '==', societyId)); 
       } 

       const snap = await getDocs(q); 
       if (!snap.empty) { 
           const cData = snap.docs[0].data(); 
           let sData = {}; 
           
           const targetSocId = cData.societyId || societyId; 
           if (targetSocId) { 
               try { 
                   const sSnap = await getDoc(doc(db, 'societies', targetSocId)); 
                   if (sSnap.exists()) sData = sSnap.data(); 
               } catch (e) {} 
           } 
           setRawData({ conf: cData, soc: sData }); 
       } 
       setLoading(false); 
    }; 
    init(); 
    return () => unsub(); 
  }, [slug]); 

  // 2. TRANSFORM (With Recursive Sanitizer) 
  useEffect(() => { 
      if (!rawData) return; 
      const { conf, soc } = rawData; 
      
      const sDate = getTx(conf.startDate, lang); 
      const eDate = getTx(conf.endDate, lang); 
      // Ensure date strings are valid 
      const d1 = sDate.includes('object') ? '' : sDate; 
      const d2 = eDate.includes('object') ? '' : eDate; 

      const newView: ConferenceView = { 
          title: getTx(conf.title, lang), 
          subtitle: getTx(conf.subtitle || conf.slogan, lang), 
          societyName: getTx(conf.societyName || soc.name || soc.societyName, lang), 
          description: getTx(conf.description || conf.welcomeMessage, lang), 
          location: getTx(conf.location || conf.venue || conf.place, lang), 
          dates: d1 === d2 ? d1 : `${d1} ~ ${d2}`, 
          contact: getTx(conf.contact || conf.contactInfo || soc.contact || soc.phone, lang), 
          president: getTx(conf.presidentName || conf.president || soc.presidentName || soc.president || soc.owner, lang), 
          bizNum: getTx(conf.businessNumber || conf.bizNum || soc.businessNumber || soc.bizNum, lang), 
          address: getTx(conf.societyAddress || conf.address || soc.address || soc.location, lang), 
          email: getTx(conf.contactEmail || conf.email || soc.email || soc.contactEmail, lang) 
      }; 
      
      console.log("SAFE VIEW MODEL GENERATED:", newView); // Double Check in Console 
      setView(newView); 
  }, [rawData, lang]); 

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>; 
  if (!rawData) return <div className="min-h-screen flex items-center justify-center">Conference Not Found ({slug})</div>; 

  const UI = { 
      login: lang === 'KO' ? '로그인' : 'Log In', 
      logout: lang === 'KO' ? '로그아웃' : 'Log Out', 
      myBadge: lang === 'KO' ? '나의 명찰' : 'My Badge', 
      welcome: lang === 'KO' ? '초대의 글' : 'Welcome Message', 
      overview: lang === 'KO' ? '행사 개요' : 'Overview', 
      date: lang === 'KO' ? '일시' : 'Date', 
      venue: lang === 'KO' ? '장소' : 'Venue', 
      contact: lang === 'KO' ? '문의' : 'Contact', 
      regBtn: user ? (lang === 'KO' ? '등록 확인 / 명찰 보기' : 'Check Registration') : (lang === 'KO' ? '사전등록 신청하기' : 'Register Now'), 
      footer: { 
          prez: lang === 'KO' ? '대표자' : 'President', 
          biz: lang === 'KO' ? '사업자번호' : 'Biz License', 
          addr: lang === 'KO' ? '주소' : 'Address', 
      } 
  }; 

  return ( 
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900"> 
        {/* HEADER */} 
        <nav className="bg-white shadow-sm sticky top-0 z-50 px-6 py-4 flex justify-between items-center"> 
            <div className="font-bold text-xl text-blue-900">{view.societyName}</div> 
            <div className="flex items-center gap-3"> 
                <button onClick={() => setLang(lang === 'KO' ? 'EN' : 'KO')} className="text-xs font-bold border border-gray-300 px-3 py-1 rounded hover:bg-gray-100">{lang === 'KO' ? 'EN' : '한글'}</button> 
                {user ? ( 
                   <> 
                     <span className="hidden sm:inline text-sm text-gray-500">{user.email}</span> 
                     <button onClick={() => navigate(`/${slug}/mypage`)} className="text-blue-600 font-bold text-sm bg-blue-50 px-3 py-1 rounded">{UI.myBadge}</button> 
                     <button onClick={async () => {
                         try {
                             await signOut(getAuth());
                             window.location.href = '/';
                         } catch (e) { window.location.href = '/'; }
                     }} className="text-sm text-red-500 hover:underline">{UI.logout}</button> 
                   </> 
                ) : ( 
                   <button onClick={() => navigate(`/${slug}/auth?mode=login`)} className="text-sm font-medium hover:text-blue-600">{UI.login}</button> 
                )} 
            </div> 
        </nav> 

        {/* HERO */} 
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white py-16 px-4 text-center"> 
            <h1 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">{view.title}</h1> 
            {view.subtitle && <p className="text-xl text-blue-200 mb-8">{view.subtitle}</p>} 
            <p className="mb-8 opacity-80 text-lg">{view.dates} | {view.location}</p> 
            
            <div className="flex justify-center gap-4 flex-wrap">
                {/* Primary: Register */}
                <button 
                    onClick={() => user ? navigate(`/${slug}/register`) : setShowModal(true)} 
                    className="bg-white text-blue-900 px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-gray-100 transition-all transform hover:scale-105" 
                > 
                    {lang === 'KO' ? '등록하기 (Registration)' : 'Register Now'} 
                </button> 
                
                {/* Secondary: Program */}
                <button 
                    onClick={() => navigate(`/${slug}/agenda`)} 
                    className="bg-blue-800 text-white border border-blue-600 px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all transform hover:scale-105" 
                > 
                    {lang === 'KO' ? '프로그램 안내 (Program)' : 'Program / Agenda'} 
                </button> 
            </div>
        </div> 

        {/* INFO */} 
        <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-8"> 
            <div className="md:col-span-2 bg-white p-8 rounded-xl shadow-sm border border-gray-100"> 
                <h2 className="text-2xl font-bold mb-4 border-b pb-2 text-gray-800">{UI.welcome}</h2> 
                <div className="whitespace-pre-wrap text-gray-600 leading-relaxed">{view.description}</div> 
                {view.president && <div className="mt-8 text-right font-bold text-gray-800">{view.societyName} 회장 {view.president}</div>} 
            </div> 
            
            <div className="space-y-6"> 
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"> 
                    <h3 className="font-bold mb-4 text-gray-800">{UI.overview}</h3> 
                    <ul className="space-y-4 text-sm"> 
                        <li><span className="text-gray-400 block text-xs uppercase mb-1">{UI.date}</span> <span className="font-medium">{view.dates}</span></li> 
                        <li><span className="text-gray-400 block text-xs uppercase mb-1">{UI.venue}</span> <span className="font-medium">{view.location}</span></li> 
                        <li><span className="text-gray-400 block text-xs uppercase mb-1">{UI.contact}</span> <span className="font-medium">{view.contact}</span></li> 
                    </ul> 
                </div> 
            </div> 
        </div> 

        {/* FOOTER */} 
        <footer className="bg-gray-900 text-gray-400 py-12 text-sm"> 
             <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-center md:text-left"> 
                 <div> 
                    <strong className="block text-white text-lg mb-4">{view.societyName}</strong> 
                    <div className="space-y-1"> 
                        {view.president && <p>{UI.footer.prez}: {view.president}</p>} 
                        {view.bizNum && <p>{UI.footer.biz}: {view.bizNum}</p>} 
                    </div> 
                 </div> 
                 <div className="md:text-right space-y-1"> 
                    {view.address && <p>{UI.footer.addr}: {view.address}</p>} 
                    {view.email && <p>Email: {view.email}</p>} 
                 </div> 
             </div> 
             <div className="text-center mt-10 pt-6 border-t border-gray-800 opacity-50"> 
                &copy; 2026 {view.societyName}. All rights reserved. 
             </div> 
        </footer> 

        {/* MODAL */} 
        {showModal && ( 
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"> 
               <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center"> 
                  <h3 className="text-2xl font-bold mb-6 text-gray-900">등록 유형 선택</h3> 
                  <div className="space-y-3"> 
                     <button onClick={() => navigate(`/${slug}/auth?mode=login`)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition"> 
                        로그인 / 회원가입 후 등록 
                        <span className="block text-xs font-normal opacity-80">이수 내역 관리 및 명찰 발급 가능</span> 
                     </button> 
                     <button onClick={() => navigate(`/${slug}/register?mode=guest`)} className="w-full bg-gray-100 text-gray-800 py-4 rounded-xl font-bold hover:bg-gray-200 transition"> 
                        비회원(Guest) 등록 
                        <span className="block text-xs font-normal opacity-60">일회성 등록</span> 
                     </button> 
                  </div> 
                  <button onClick={() => setShowModal(false)} className="mt-8 text-gray-400 text-sm hover:text-gray-600 font-medium">닫기</button> 
               </div> 
            </div> 
        )} 
    </div> 
  ); 
}; 
export default FinalConferenceHome;
