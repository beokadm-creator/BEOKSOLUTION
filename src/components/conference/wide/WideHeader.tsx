import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ui/button';
import { User, Globe, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

interface WideHeaderProps {
    lang: string;
    setLang: (lang: string) => void;
    societyName: string;
}

export const WideHeader: React.FC<WideHeaderProps> = ({ lang, setLang, societyName }) => {
    const navigate = useNavigate();
    const { auth, logout } = useAuth('');
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const headerClass = isScrolled
        ? 'bg-white/90 backdrop-blur-md shadow-lg py-3 border-b border-slate-100'
        : 'bg-gradient-to-b from-black/50 to-transparent py-6 border-b border-white/10';

    const textClass = isScrolled ? 'text-slate-800' : 'text-white shadow-sm';
    const buttonGhostClass = isScrolled
        ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        : 'text-white/90 hover:bg-white/20 hover:text-white';

    return (
        <header className={`fixed top-0 w-full z-50 transition-all duration-300 ease-in-out ${headerClass}`}>
            <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                {/* Logo / Society Name */}
                <div
                    className={`font-bold text-xl md:text-2xl cursor-pointer tracking-tight transition-colors ${textClass}`}
                    onClick={() => navigate('/')}
                >
                    {societyName}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
                        className={`rounded-full transition-colors ${buttonGhostClass}`}
                    >
                        <Globe className="w-4 h-4 mr-1.5" />
                        <span className="font-medium text-xs md:text-sm">{lang === 'ko' ? 'EN' : 'KR'}</span>
                    </Button>

                    <div className={`h-4 w-px mx-1 ${isScrolled ? 'bg-slate-300' : 'bg-white/40'}`}></div>

                    {auth.user ? (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/mypage')}
                                className={`rounded-full transition-colors ${buttonGhostClass}`}
                            >
                                <User className="w-4 h-4 mr-1.5" />
                                <span className="font-medium">My Page</span>
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={logout}
                                className={`rounded-full transition-colors ${buttonGhostClass}`}
                            >
                                <span className="font-medium">Logout</span>
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/auth?returnUrl=${encodeURIComponent(window.location.pathname)}`)}
                                className={`rounded-full hidden md:flex ${buttonGhostClass}`}
                            >
                                Log In
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => navigate('/auth?tab=signup')}
                                className={`rounded-full px-5 font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 ${isScrolled ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-blue-900 hover:bg-blue-50'}`}
                            >
                                Sign Up
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};
