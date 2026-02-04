import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getAuth } from 'firebase/auth';

interface EregiNavigationProps {
    transparent?: boolean;
    societyLogo?: string;
    societyName?: string;
    showLangSwitch?: boolean;
    currentLang?: string;
    onLangChange?: (lang: string) => void;

    // Custom User Support (for Non-Member Auth)
    customUser?: {
        name: string;
        email?: string;
        label?: string;
    } | null;
    onLogout?: () => void;
}

const EregiNavigation: React.FC<EregiNavigationProps> = ({
    transparent = false,
    societyLogo,
    societyName,
    showLangSwitch = false,
    currentLang = 'ko',
    onLangChange,
    customUser,
    onLogout
}) => {
    const navigate = useNavigate();
    const { auth: { user: authUser } } = useAuth('');

    // Determine effective user
    const displayUser = customUser || (authUser ? {
        name: authUser.name || authUser.email?.split('@')[0] || 'User',
        email: authUser.email || '',
        label: 'Verified User'
    } : null);

    const handleLogout = () => {
        if (onLogout) {
            onLogout();
        } else {
            getAuth().signOut();
        }
    };

    // Debug logging
    React.useEffect(() => {
        console.log('[EregiNavigation] displayUser:', displayUser);
        console.log('[EregiNavigation] authUser:', {
            name: authUser?.name,
            email: authUser?.email,
            displayName: (authUser as any)?.displayName
        });
    }, [displayUser, authUser]);

    const handleMyPage = () => {
        if (customUser) {
            // For non-member, maybe reload or stay? Or assume the parent handles routing.
            // Usually non-member hub is the current page or specific route.
            // If we are in non-member hub, clicking mypage might just reload.
            // But let's just do nothing or navigate to current location if customUser is set.
            // Or better, let parent handle it? 
            // For now, if customUser is set, we might not need a separate mypage link action 
            // or it should go to the hub. But the hub URL is dynamic.
            // We'll leave it as is, or maybe disable mypage button for customUser if not needed?
            // Requirement says: "비회원 전용 허브... 상단 네비게이션... 사용자 이름을 '비회원: [성함]님'으로 표시"
            // It doesn't specify MyPage button behavior.
            // I'll keep it simple.
            return;
        }
        navigate('/mypage');
    };

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${transparent ? 'bg-white/80 backdrop-blur-md border-b border-transparent' : 'bg-white border-b border-slate-100 shadow-sm'}`}>
            <div className="max-w-[1400px] mx-auto px-6 h-20 flex justify-between items-center">

                {/* BRANDING: Society/Conference Identity Only */}
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
                    {societyLogo ? (
                        <img src={societyLogo} alt="Society Logo" className="h-10 w-auto object-contain" />
                    ) : (
                        <div className="flex flex-col justify-center">
                            <span className="text-xl font-bold text-slate-900 leading-tight">
                                {societyName || 'Conference'}
                            </span>
                        </div>
                    )}
                    {societyLogo && societyName && (
                        <span className="text-lg font-bold text-slate-800 hidden md:block border-l border-slate-300 pl-4 ml-2">
                            {societyName}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-6">
                    {/* LANGUAGE SWITCHER: Globe Icon */}
                    {showLangSwitch && onLangChange && (
                        <button
                            onClick={() => onLangChange(currentLang === 'ko' ? 'en' : 'ko')}
                            className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600 font-medium group"
                        >
                            <svg className="w-5 h-5 text-slate-500 group-hover:text-eregi-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="uppercase text-sm">{currentLang}</span>
                        </button>
                    )}

                    {/* USER ACTION */}
                    <div className="flex items-center gap-3">
                        {displayUser ? (
                            <>
                                <div className="hidden sm:flex flex-col items-end mr-2">
                                    <span className="text-xs font-bold text-slate-700">
                                        {displayUser?.name}{displayUser?.email ? ` (${displayUser.email})` : ''}
                                    </span>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{displayUser?.label}</span>
                                </div>
                                <button
                                    onClick={handleMyPage}
                                    className={`w-9 h-9 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-200 transition ${customUser ? 'cursor-default hover:bg-slate-100' : ''}`}
                                    title="My Page"
                                >
                                    <UserIcon size={18} />
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-9 h-9 bg-slate-100 text-red-500 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition"
                                    title="Logout"
                                >
                                    <LogOut size={16} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => navigate('/auth?mode=login')}
                                    className="text-slate-600 font-bold hover:text-[#24669e] text-sm px-4 hidden sm:block"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => navigate('/auth?mode=signup')}
                                    className="eregi-btn-primary py-2 px-5 text-sm"
                                >
                                    Sign Up
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default EregiNavigation;
