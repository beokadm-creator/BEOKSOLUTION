import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ui/button';
import { Globe, Bell } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useNoticeCount } from '../../../hooks/useNotices';
import { NoticeModal } from '../NoticeModal';


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
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);

  // Auth hooks
  const { auth } = useAuth();
  const { count } = useNoticeCount();



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
    } else {
      handleNavigation(`/${slug}/auth`);
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
            {/* Notice Bell */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNoticeModalOpen(true)}
                className={`rounded-full px-3 font-medium transition-colors ${buttonGhostClass}`}
                aria-label="Notices"
              >
                <Bell className="w-4 h-4" />
              </Button>
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-sm">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
              className={`rounded-full px-3 font-medium transition-colors ${buttonGhostClass}`}
            >
              <Globe className="w-4 h-4 mr-1.5" />
              {lang === 'ko' ? 'English' : '한국어'}
            </Button>

            {auth.user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNavigation(`/${slug}/mypage`)}
                className={`rounded-full transition-colors ${buttonGhostClass}`}
                style={{ color: isScrolled ? '#334155' : '#ffffff' }}
              >
                {lang === 'ko' ? '마이페이지' : 'My Page'}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleNavigation(`/auth`)}
                className="rounded-full px-5 font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: isScrolled ? '#2563eb' : '#ffffff',
                  color: isScrolled ? '#ffffff' : '#1e3a8a',
                  border: 'none'
                }}
              >
                {lang === 'ko' ? '등록(조회)하기' : 'Register / Check'}
              </Button>
            )}
          </div>

          {/* Mobile Header Actions */}
          <div className="flex md:hidden items-center gap-2">
            {/* Notice Bell */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNoticeModalOpen(true)}
                className={`rounded-full transition-colors ${buttonGhostClass} px-3`}
                aria-label="Notices"
              >
                <Bell className="w-4 h-4" />
              </Button>
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-sm">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </div>

            {/* Language Toggle */}
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

      {/* Notice Modal */}
      <NoticeModal
        isOpen={noticeModalOpen}
        onClose={() => setNoticeModalOpen(false)}
      />
    </header>
  );
};
