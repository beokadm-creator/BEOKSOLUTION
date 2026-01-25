import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useConferenceData } from '../../hooks/useConferenceData';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';

const LandingPage = () => {
  const params = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showRegisterModal, setShowRegisterModal] = useState(false); // [Fix-Step 328] Registration Choice Logic
  
  // [Auth State]
  const [currentUser, setCurrentUser] = useState<any>(null);
  const auth = getAuth();

  useEffect(() => {
      const unsub = onAuthStateChanged(auth, (user) => {
          setCurrentUser(user);
      });
      return () => unsub();
  }, [auth]);

  // [Language State]
  const lang = searchParams.get('lang') === 'en' ? 'en' : 'ko';

  const setLang = (newLang: 'ko' | 'en') => {
      setSearchParams({ lang: newLang });
  };

  // [Helper] Multi-language Text Extractor
  const t = (field: any) => {
      // 1. If string, return as is (already transformed or raw string)
      if (typeof field === 'string') return field;
      
      // 2. If object, find value for current lang
      const val = lang === 'en' ? field?.en : field?.ko;
      
      // 3. Fallback: If EN mode but no EN data, try KO, else empty
      return val || field?.ko || "";
  };

  const currentSlug = params.slug || window.location.pathname.split('/')[1] || '2026spring';

  // [Fix-Step 318] Destructure separate states
  const { conference, society, speakers, loading, error } = useConferenceData(currentSlug);

  // 1. Loading (Clean UI)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 2. Error (Clean UI)
  if (error || !conference) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
         <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Conference Not Found</h2>
            <p className="text-slate-500">{error || "The requested conference data could not be loaded."}</p>
         </div>
      </div>
    );
  }

  // 4. Data Loaded
  // [Fix-Step 325] Direct access to conference fields (no basic wrapper)
  const { fees, programs, periods, refundPolicy } = conference;
  console.log("DEBUG ASSETS:", conference.visualAssets); // [Fix-Step 327] Debug Assets
  
  // Banner Selection
  const bannerData = conference.visualAssets?.banner;
  const bannerUrl = (lang === 'en' && bannerData?.en) ? bannerData.en : (bannerData?.ko || bannerData?.en);

  // Labels
  const labels = {
      login: lang === 'ko' ? '로그인' : 'Login',
      logout: lang === 'ko' ? '로그아웃' : 'Logout',
      signup: lang === 'ko' ? '회원가입' : 'Sign Up',
      register: lang === 'ko' ? '사전등록하기' : 'Registration',
      checkStatus: lang === 'ko' ? '비회원 등록 조회' : 'Check Status',
      abstracts: lang === 'ko' ? '초록 접수하기' : 'Abstract Submission',
      fees: lang === 'ko' ? '등록비 안내' : 'Registration Fees',
      program: lang === 'ko' ? '프로그램 일정' : 'Program Agenda',
      speakers: lang === 'ko' ? '초청 연자' : 'Invited Speakers',
      date: lang === 'ko' ? '일시' : 'Date',
      venue: lang === 'ko' ? '장소' : 'Venue',
      category: lang === 'ko' ? '구분' : 'Category',
      amount: lang === 'ko' ? '금액' : 'Amount',
      speaker: lang === 'ko' ? '연자' : 'Speaker',
  };

  const handleLogout = async () => {
      await signOut(auth);
      window.location.reload();
  };

  const handleRegisterClick = () => {
      if (currentUser) {
          // If logged in, go straight to register
          navigate(`/${currentSlug}/register?lang=${lang}`);
      } else {
          // If not logged in, show choice modal
          setShowRegisterModal(true);
      }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 font-sans">
      
      {/* [Top Navigation] */}
      <nav className="flex items-center justify-between py-4 border-b mb-6">
        <div className="flex items-center gap-2 font-bold text-xl">
            {/* Show Society Logo if available */}
            {society?.logoUrl ? (
                <img src={society.logoUrl} alt="Logo" className="h-10" />
            ) : society?.branding?.logo?.url ? (
                <img src={society.branding.logo.url} alt="Logo" className="h-10" />
            ) : (
                <span className="text-blue-600">eRegi</span>
            )}
            <span className="text-gray-800 text-lg ml-2 hidden md:inline-block">{t(society.name) || t(conference.title)}</span>
        </div>
        
        {/* Right Control Panel */}
        <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex border rounded overflow-hidden mr-2">
                <button 
                    onClick={() => setLang('ko')} 
                    className={`px-3 py-1 text-xs font-bold ${lang === 'ko' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                >
                    KR
                </button>
                <button 
                    onClick={() => setLang('en')} 
                    className={`px-3 py-1 text-xs font-bold ${lang === 'en' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                >
                    EN
                </button>
            </div>

            {/* Auth Buttons */}
            {currentUser ? (
                <button 
                    onClick={handleLogout} 
                    className="px-4 py-2 text-sm font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                >
                    {labels.logout}
                </button>
            ) : (
                <>
                    <button 
                        onClick={() => navigate(`/${currentSlug}/auth?mode=login&lang=${lang}`)} 
                        className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-blue-600"
                    >
                        {labels.login}
                    </button>
                    <button 
                        onClick={() => navigate(`/${currentSlug}/auth?mode=signup&lang=${lang}`)} 
                        className="px-4 py-2 text-sm font-bold bg-slate-900 text-white rounded-lg hover:bg-black"
                    >
                        {labels.signup}
                    </button>
                </>
            )}
        </div>
      </nav>

      {/* [A] 기본 정보 */}
      <header className="border-b pb-6">
        {/* Banner Image */}
        {bannerUrl && (
            <div className="mb-6 rounded-xl overflow-hidden shadow-lg">
                <img src={bannerUrl} alt="Conference Banner" className="w-full h-auto object-cover" />
            </div>
        )}

        <h1 className="text-3xl font-bold mb-2">{t(conference.title) || 'Untitled'}</h1>
        {conference.subtitle && <p className="text-xl text-gray-600 mt-2 font-medium mb-6">{conference.subtitle}</p>}
        
        <div className="space-y-2 text-gray-700">
          {conference.dates && <p><strong>{labels.date}:</strong> {conference.dates.start ? new Date(conference.dates.start.seconds * 1000).toLocaleDateString() : ""} ~ {conference.dates.end ? new Date(conference.dates.end.seconds * 1000).toLocaleDateString() : ""}</p>}
          {conference.venue && <p><strong>{labels.venue}:</strong> {t(conference.venue.name)} {conference.venue.address && `(${t(conference.venue.address)})`}</p>}
        </div>
      </header>

      {/* [B] 기능 버튼 (With Lang Param) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          onClick={handleRegisterClick}
          className="p-4 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition"
        >
          {labels.register}
        </button>
        <button 
          onClick={() => navigate(`/${currentSlug}/check-status?lang=${lang}`)}
          className="p-4 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition"
        >
          {labels.checkStatus}
        </button>
        <button 
          onClick={() => navigate(`/${currentSlug}/abstracts?lang=${lang}`)}
          className="p-4 bg-orange-500 text-white rounded font-bold hover:bg-orange-600 transition"
        >
          {labels.abstracts}
        </button>
      </section>

      {/* [C] 등록비 (Periods Priority) */}
      {(periods && periods.length > 0) ? (
        <section className="border rounded p-6 bg-white shadow-sm">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              {labels.fees}
          </h2>
          
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                  <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                          <th className="p-4 font-bold text-slate-700 min-w-[120px]">{labels.category}</th>
                          {periods.map((p: any, idx: number) => (
                              <th key={idx} className="p-4 font-bold text-slate-700 min-w-[150px]">
                                  <div className="text-base text-blue-900">{t(p.name)}</div>
                                  <div className="text-xs text-slate-500 font-normal mt-1">
                                      {p.startDate ? new Date(p.startDate.seconds * 1000).toLocaleDateString() : ''} ~ 
                                      {p.endDate ? new Date(p.endDate.seconds * 1000).toLocaleDateString() : ''}
                                  </div>
                              </th>
                          ))}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {/* We need to get a unique list of all price categories across all periods */}
                      {(() => {
                          const allCategories = new Set<string>();
                          periods.forEach((p: any) => {
                              if (p.prices) Object.keys(p.prices).forEach(k => allCategories.add(k));
                          });
                          // Sort categories? Optional. For now alphabetical or insertion order.
                          return Array.from(allCategories).map(cat => (
                              <tr key={cat} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4 font-medium text-slate-900 border-r border-slate-100">{cat.replace(/_/g, ' ')}</td>
                                  {periods.map((p: any, idx: number) => (
                                      <td key={idx} className="p-4 text-slate-600 font-mono">
                                          {p.prices && p.prices[cat] 
                                              ? `${Number(p.prices[cat]).toLocaleString()} KRW` 
                                              : '-'}
                                      </td>
                                  ))}
                              </tr>
                          ));
                      })()}
                  </tbody>
              </table>
          </div>

          {refundPolicy && (
              <div className="mt-6 p-4 bg-slate-50 rounded-lg text-sm text-slate-600 border border-slate-100">
                  <strong className="block text-slate-800 mb-2 font-bold">Refund Policy</strong>
                  <p className="whitespace-pre-wrap">{refundPolicy}</p>
              </div>
          )}
        </section>
      ) : (
        fees && fees.length > 0 && (
            <section className="border rounded p-6">
            <h2 className="text-xl font-bold mb-4">{labels.fees}</h2>
            <table className="w-full text-left">
                <thead>
                <tr className="border-b">
                    <th className="py-2">{labels.category}</th>
                    <th className="py-2">{labels.amount}</th>
                </tr>
                </thead>
                <tbody>
                {fees.map((fee: any, idx: number) => (
                    <tr key={idx} className="border-b last:border-0">
                    <td className="py-2">{t(fee.name)}</td>
                    <td className="py-2 font-mono">{Number(fee.amount).toLocaleString()} {fee.currency}</td>
                    </tr>
                ))}
                </tbody>
            </table>
            </section>
        )
      )}

      {/* [D] 프로그램 */}
      {programs && programs.length > 0 && (
        <section className="border rounded p-6">
          <h2 className="text-xl font-bold mb-4">{labels.program}</h2>
          <div className="space-y-4">
            {programs.map((prog: any, idx: number) => (
              <div key={idx} className="flex gap-4 border-b last:border-0 pb-4 last:pb-0">
                <div className="w-24 font-bold text-gray-600">{prog.startTime}</div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{t(prog.title)}</h3>
                  {prog.speakers && <p className="text-sm text-gray-500">{labels.speaker}: {t(prog.speakers)}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* [E] 초청 연자 (Speakers) */}
      {speakers && speakers.length > 0 && (
        <section className="border rounded p-6">
          <h2 className="text-xl font-bold mb-4">{labels.speakers}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {speakers.map((sp: any, idx: number) => (
              <div key={idx} className="text-center">
                <div className="w-24 h-24 mx-auto bg-slate-100 rounded-full mb-3 overflow-hidden">
                    {sp.image ? (
                        <img src={sp.image} alt={sp.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 text-2xl">?</div>
                    )}
                </div>
                <h4 className="font-bold text-slate-900">{t(sp.name)}</h4>
                <p className="text-xs text-slate-500 mt-1">{t(sp.affiliation)}</p>
                <p className="text-[10px] text-blue-500 uppercase font-bold mt-1">{sp.role}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* [Footer] Society Info */}
      <footer className="border-t pt-10 mt-10 text-center text-slate-500 text-sm">
        {society && (
            <div className="mb-6 space-y-1">
                <h3 className="font-bold text-slate-900 mb-2">{t(society.name)}</h3>
                <p>사업자등록번호: {society.footerInfo?.bizRegNumber || society.bizInfo?.registrationNumber || '-'}</p>
                <p>주소: {t(society.footerInfo?.address) || t(society.bizInfo?.address) || '-'}</p>
                <p>대표자: {t(society.footerInfo?.representativeName) || t(society.bizInfo?.president) || '-'}</p>
                <p>Tel: {society.footerInfo?.contactPhone || society.contact?.phone || '-'} | Email: {society.footerInfo?.contactEmail || society.contact?.email || '-'}</p>
            </div>
        )}
        <div className="text-xs text-slate-400">
            Powered by eRegi Platform | Connected to conferences/{currentSlug}
        </div>
      </footer>

      {/* [Fix-Step 328] Registration Choice Modal */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>{lang === 'ko' ? '로그인 후 등록하시겠습니까?' : 'Do you want to login?'}</DialogTitle>
                  <DialogDescription>
                      {lang === 'ko' 
                          ? '회원가입/로그인을 하시면 등록 내역을 관리하기 편리합니다.' 
                          : 'Logging in allows you to manage your registration easily.'}
                  </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 py-4">
                  <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => navigate(`/${currentSlug}/auth?mode=login&returnUrl=/${currentSlug}/register&lang=${lang}`)}
                  >
                      {lang === 'ko' ? '로그인 하고 등록하기 (회원)' : 'Login & Register (Member)'}
                  </Button>
                  <Button 
                      variant="outline"
                      className="w-full border-slate-300"
                      onClick={() => navigate(`/${currentSlug}/register?lang=${lang}`)}
                  >
                      {lang === 'ko' ? '비회원으로 바로 등록하기' : 'Guest Registration (Non-Member)'}
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPage;