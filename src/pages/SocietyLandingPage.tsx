import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { Society, Conference } from '../types/schema';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
    Globe,
    UserPlus,
    LogIn,
    Menu
} from 'lucide-react';
import { FOOTER_INFO } from '../constants/defaults';
import { RegistrationModal } from '../components/conference/RegistrationModal';
import SocietySidebar from '../components/society/SocietySidebar';
import UserMenuDropdown from '../components/society/UserMenuDropdown';
import AuthButtons from '../components/society/AuthButtons';
import SocietyHomeSection from '../components/society/sections/SocietyHomeSection';
import SocietyIntroSection from '../components/society/sections/SocietyIntroSection';
import PresidentGreetingSection from '../components/society/sections/PresidentGreetingSection';
import ConferenceListSection from '../components/society/sections/ConferenceListSection';
import NoticesSection from '../components/society/sections/NoticesSection';
import MyPageSection from '../components/society/sections/MyPageSection';

const SocietyLandingPage: React.FC = () => {
    const authHook = useAuth('');
    const { language, toggleLanguage } = useLanguage();
    const [, setAuthRefresh] = useState(0);

    useEffect(() => {
        setAuthRefresh(prev => prev + 1);
    }, [authHook.auth.user?.uid, authHook.auth.loading]);

    const { societyId: paramId } = useParams<{ societyId: string }>();
    const [societyId] = useState<string | null>(() => {
        if (paramId) return paramId;
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'admin' && parts[0] !== 'eregi') {
            return parts[0].toLowerCase();
        }
        return null;
    });
    const navigate = useNavigate();

    useEffect(() => {
        if (window.location.pathname.endsWith('/mypage')) {
            window.location.href = 'https://kadd.eregi.co.kr/mypage';
        }
    }, []);

    const [society, setSociety] = useState<Society | null>(null);
    const [conferences, setConferences] = useState<Conference[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);
    const [selectedConf, setSelectedConf] = useState<Conference | null>(null);

    // Sidebar state
    const [activeMenu, setActiveMenu] = useState<string>('home');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Scroll state for navbar
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (!societyId) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const socRef = doc(db, 'societies', societyId);
                const socSnap = await getDoc(socRef);

                if (!socSnap.exists()) {
                    const fallbackSociety: Society = {
                        id: societyId,
                        name: { ko: `${societyId.toUpperCase()} 학회`, en: `${societyId.toUpperCase()} Society` },
                        adminEmails: [],
                        createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
                    };
                    setSociety(fallbackSociety);
                } else {
                    const socData = { id: socSnap.id, ...socSnap.data() } as Society;
                    setSociety(socData);
                }

                const confRef = collection(db, 'conferences');
                const variations = [societyId, societyId.toLowerCase(), societyId.toUpperCase()];
                const q = query(confRef, where('societyId', 'in', [...new Set(variations)]));
                const confSnaps = await getDocs(q);

                let confList = confSnaps.docs.map(d => ({ id: d.id, ...d.data() } as Conference));

                if (confList.length === 0) {
                    const q2 = query(confRef, where('hostId', 'in', [...new Set(variations)]));
                    const snap2 = await getDocs(q2);
                    confList = snap2.docs.map(d => ({ id: d.id, ...d.data() } as Conference));
                }

                setConferences(confList);

            } catch (err) {
                console.error("Fetch Error:", err);
                toast.error("Failed to load society data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [societyId, navigate, paramId]);

    if (loading) return <LoadingSpinner />;
    if (!society) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Society Not Found</div>;

    const getConferenceUrl = (conf: Conference, path: string = '') => {
        const host = window.location.hostname;
        const base = (host === 'localhost' || host === '127.0.0.1' || host.startsWith(society.id))
            ? `/${conf.slug}`
            : `${window.location.protocol}//${society.id}.eregi.co.kr/${conf.slug}`;
        return path ? `${base}/${path}` : base;
    };

    const handleRegisterClick = (conf: Conference) => {
        setSelectedConf(conf);
        setShowRegistrationModal(true);
    };

    const activeConfs = conferences.filter(c => c.status === 'OPEN').sort((a, b) => (b.dates?.start?.seconds || 0) - (a.dates?.start?.seconds || 0));
    const upcomingConfs = conferences.filter(c => c.status === 'PLANNING').sort((a, b) => (a.dates?.start?.seconds || 0) - (b.dates?.start?.seconds || 0));
    const pastConfs = conferences.filter(c => ['CLOSED', 'ARCHIVED'].includes(c.status)).sort((a, b) => (b.dates?.start?.seconds || 0) - (a.dates?.start?.seconds || 0));

    const hasUser = !!authHook.auth.user;


    // Determine header style based on menu and scroll
    // Only use transparent header on Home tab when not scrolled
    const useTransparentHeader = activeMenu === 'home' && !isScrolled;

    const headerClass = useTransparentHeader
        ? 'bg-gradient-to-b from-black/50 to-transparent border-b border-white/10'
        : 'bg-white/95 backdrop-blur-md shadow-lg border-b border-slate-100';

    const buttonGhostClass = useTransparentHeader
        ? 'text-white hover:bg-white/20'
        : 'text-slate-800 hover:bg-slate-100';

    const logoContainerClass = useTransparentHeader
        ? 'brightness-0 invert drop-shadow-sm'
        : '';

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-900">
            {/* Mobile Navbar */}
            <nav className={`lg:hidden fixed top-0 left-0 right-0 z-[100] h-16 transition-all duration-300 ease-in-out ${headerClass}`}>
                <div className="px-4 h-full flex justify-between items-center gap-3">
                    {/* Left: Hamburger Menu */}
                    <button
                        type="button"
                        onClick={() => {
                            console.log('Hamburger clicked!');
                            setSidebarOpen(true);
                        }}
                        className={`p-3 rounded-xl transition-colors relative z-50 ${buttonGhostClass}`}
                        aria-label="메뉴 열기"
                        style={{ minWidth: '48px', minHeight: '48px' }}
                    >
                        <Menu size={24} strokeWidth={2} />
                    </button>

                    {/* Center: Logo Only - Larger and Prominent */}
                    <div className="flex items-center justify-center flex-1 -mx-16">
                        {society.logoUrl ? (
                            <img src={society.logoUrl} alt="Logo" className={`h-9 object-contain max-w-full transition-all duration-300 ${logoContainerClass}`} />
                        ) : (
                            <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black uppercase text-sm font-black shadow-lg shadow-blue-600/20">
                                {society.id.substring(0, 2)}
                            </div>
                        )}
                    </div>

                    {/* Right: Auth or Quick Actions */}
                    <div className="flex items-center gap-2">
                        {hasUser ? (
                            <button
                                type="button"
                                onClick={() => navigate('/mypage')}
                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-black transition-all shadow-lg active:scale-95 min-w-0"
                            >
                                <UserPlus size={18} strokeWidth={2.5} />
                                <span className="hidden sm:inline max-w-[80px] truncate font-bold text-sm">
                                    {authHook.auth.user?.name || authHook.auth.user?.email?.split('@')[0]}
                                </span>
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={toggleLanguage}
                                    className={`p-3 rounded-xl transition-colors ${buttonGhostClass}`}
                                    aria-label={language === 'ko' ? 'English' : '한국어'}
                                >
                                    <Globe size={20} strokeWidth={2.5} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/auth')}
                                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 ${!useTransparentHeader ? 'bg-slate-900 text-white hover:bg-black' : 'bg-white text-slate-900 hover:bg-slate-100'}`}
                                >
                                    <LogIn size={18} strokeWidth={2.5} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Desktop Navbar */}
            <nav className="hidden lg:flex fixed top-0 left-64 right-0 z-50 bg-white border-b border-slate-100 h-20 items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    {/* Language Toggle on Left */}
                    <button
                        type="button"
                        onClick={toggleLanguage}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-sm text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors"
                    >
                        <Globe size={16} />
                        {language === 'ko' ? 'KO' : 'EN'}
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    {hasUser ? (
                        <UserMenuDropdown
                            userName={authHook.auth.user?.name}
                            userEmail={authHook.auth.user?.email}
                            onLogout={() => authHook.logout()}
                            onNavigateToMypage={() => navigate('/mypage')}
                            language={language}
                            onToggleLanguage={toggleLanguage}
                        />
                    ) : (
                        <AuthButtons
                            hasUser={hasUser}
                            isLoading={authHook.auth.loading}
                            onLoginClick={() => navigate('/auth')}
                            onSignupClick={() => navigate('/auth?mode=signup')}
                            language={language}
                            showLanguageToggle={false}
                        />
                    )}
                </div>
            </nav>

            {/* Sidebar */}
            <SocietySidebar
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                societyName={society.name.ko}
                hasUser={hasUser}
                language={language}
                onToggleLanguage={toggleLanguage}
            />

            {/* Main Content */}
            <div className="lg:ml-64 pt-16 lg:pt-20">
                <main className={['intro', 'greeting'].includes(activeMenu) ? 'w-full' : 'max-w-7xl mx-auto px-4 sm:px-6 py-8'}>
                    {/* Content Sections */}
                    {activeMenu === 'home' && (
                        <div className="space-y-8">
                            <SocietyHomeSection society={society} language={language} />
                            <ConferenceListSection
                                activeConferences={activeConfs}
                                upcomingConferences={upcomingConfs}
                                pastConferences={pastConfs}
                                onRegisterClick={handleRegisterClick}
                                getConferenceUrl={getConferenceUrl}
                                language={language}
                            />
                        </div>
                    )}

                    {activeMenu === 'intro' && <SocietyIntroSection society={society} language={language} />}

                    {activeMenu === 'greeting' && <PresidentGreetingSection society={society} language={language} />}

                    {activeMenu === 'conferences' && (
                        <ConferenceListSection
                            activeConferences={activeConfs}
                            upcomingConferences={upcomingConfs}
                            pastConferences={pastConfs}
                            onRegisterClick={handleRegisterClick}
                            getConferenceUrl={getConferenceUrl}
                            language={language}
                        />
                    )}

                    {activeMenu === 'notices' && <NoticesSection society={society} language={language} />}

                    {activeMenu === 'mypage' && hasUser && (
                        <MyPageSection
                            onNavigateToMypage={() => navigate('/mypage')}
                            onLogout={() => authHook.logout()}
                            userName={authHook.auth.user?.name || authHook.auth.user?.email?.split('@')[0]}
                        />
                    )}
                </main>

                {/* Footer */}
                <footer className="bg-white py-12 px-6 border-t border-slate-100 mt-16">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 justify-center md:justify-start grayscale opacity-50">
                                {society.logoUrl && <img src={society.logoUrl} alt="Logo" className="h-5" />}
                                <span className="text-sm font-black text-slate-900 tracking-tighter uppercase">{society.id} PORTAL</span>
                            </div>
                            <p className="max-w-xs text-[10px] font-bold text-slate-300 leading-relaxed uppercase tracking-widest">
                                본 학술 플랫폼은 이레지(eRegi)의 솔루션을 통해 운영되고 있습니다. {FOOTER_INFO.companyKr}.
                            </p>
                        </div>

                        <div className="flex flex-col md:items-end gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <p>&copy; {FOOTER_INFO.year} {society.name.en}. All rights reserved.</p>
                            <p className="text-slate-300">Technology Support by {FOOTER_INFO.support}</p>
                        </div>
                    </div>
                </footer>
            </div>

            {/* Registration Modal */}
            {selectedConf && (
                <RegistrationModal
                    isOpen={showRegistrationModal}
                    onClose={() => {
                        setShowRegistrationModal(false);
                        setSelectedConf(null);
                    }}
                    conference={selectedConf}
                />
            )}
        </div>
    );
};

export default SocietyLandingPage;
