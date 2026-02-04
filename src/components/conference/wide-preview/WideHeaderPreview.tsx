import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ui/button';
import { Globe } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useNonMemberAuth } from '../../../hooks/useNonMemberAuth';

interface WideHeaderPreviewProps {
  lang: string;
  setLang: (lang: string) => void;
  societyName: string;
  logoUrl?: string;
  slug: string;
  confId?: string;
}

export const WideHeaderPreview: React.FC<WideHeaderPreviewProps> = ({
  lang,
  setLang,
  societyName,
  logoUrl,
  slug,
  confId,
}) => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  
  // Auth hooks
  const { auth } = useAuth();
  
  // Determine effective ConfId for non-member auth if not provided
  let effectiveConfId = confId;
  if (!effectiveConfId) {
    if (slug && slug.includes('_')) {
      effectiveConfId = slug;
    } else if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      let societyIdToUse = 'kadd';

      if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
        societyIdToUse = parts[0].toLowerCase();
      }

      effectiveConfId = `${societyIdToUse}_${slug}`;
    }
  }

  const { nonMember } = useNonMemberAuth(effectiveConfId);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const headerClass = isScrolled
    ? 'bg-white/95 backdrop-blur-md shadow-lg py-3 border-b border-slate-100'
    : 'bg-gradient-to-b from-slate-900/80 to-transparent py-6 border-b border-white/10';

  const textClass = isScrolled ? 'text-slate-800' : 'text-white shadow-sm';
  const buttonGhostClass = isScrolled
    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    : 'text-white/90 hover:bg-white/20 hover:text-white';

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleRegisterClick = () => {
    if (auth.user) {
      handleNavigation(`/${slug}/mypage`);
    } else if (nonMember) {
      handleNavigation(`/${slug}/non-member/hub`);
    } else {
      handleNavigation(`/auth?tab=signup&returnTo=${slug}`);
    }
  };

  return (
    <header className={`fixed top-0 w-full z-50 transition-all duration-300 ease-in-out ${headerClass}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center">
          {/* Logo + Society Name */}
          <div
            className={`font-bold text-xl md:text-2xl cursor-pointer tracking-tight transition-colors ${textClass} flex items-center gap-3`}
            onClick={() => handleNavigation(`/${slug}`)}
          >
            {logoUrl && (
              <img
                src={logoUrl}
                alt={`${societyName} Logo`}
                className="h-10 w-auto object-contain"
              />
            )}
            <span>{societyName}</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
              className={`rounded-full px-3 font-medium transition-colors ${buttonGhostClass}`}
            >
              <Globe className="w-4 h-4 mr-1.5" />
              {lang === 'ko' ? 'English' : '한국어'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegisterClick}
              className={`rounded-full px-5 font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 ${isScrolled ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-blue-900 hover:bg-blue-50'}`}
            >
              {auth.user || nonMember 
                ? (lang === 'ko' ? '마이페이지' : 'My Page') 
                : (lang === 'ko' ? '등록(조회)하기' : 'Register')}
            </Button>
          </div>

          {/* Mobile Header Actions */}
          <div className="flex md:hidden items-center gap-2">
            {/* Language Toggle (Always Visible) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
              className={`rounded-full transition-colors ${buttonGhostClass} px-3`}
            >
              <Globe className="w-4 h-4" />
              <span className="font-medium text-xs ml-1">{lang === 'ko' ? 'EN' : 'KR'}</span>
            </Button>
          </div>
        </div>

        {/* Mobile Menu Removed as per request */}
      </div>
    </header>
  );
};
