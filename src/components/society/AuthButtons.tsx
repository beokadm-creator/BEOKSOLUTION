import React from 'react';
import { LogIn, UserPlus, Globe } from 'lucide-react';
import type { Language } from '../../../hooks/useLanguage';

interface AuthButtonsProps {
  hasUser?: boolean;
  isLoading?: boolean;
  onLoginClick?: () => void;
  onSignupClick?: () => void;
  language?: Language;
  showLanguageToggle?: boolean;
  onToggleLanguage?: () => void;
}

const AuthButtons: React.FC<AuthButtonsProps> = ({
  hasUser = false,
  isLoading = false,
  onLoginClick,
  onSignupClick,
  language = 'ko',
  showLanguageToggle = true,
  onToggleLanguage,
}) => {
  if (isLoading) {
    return (
      <div className="w-32 h-10 animate-pulse bg-slate-200 rounded-xl" />
    );
  }

  if (hasUser) {
    return null; // UserMenuDropdown will be used instead
  }

  return (
    <div className="flex items-center gap-3">
      {/* Language Toggle */}
      {showLanguageToggle && onToggleLanguage && (
        <button
          type="button"
          onClick={onToggleLanguage}
          className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition-colors border border-slate-200 hover:border-blue-200"
        >
          <Globe size={16} />
          {language === 'ko' ? 'EN' : 'KO'}
        </button>
      )}

      {/* Login Button */}
      <button
        type="button"
        onClick={onLoginClick}
        className="text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-1.5 px-4 py-2.5 rounded-xl hover:bg-slate-50"
      >
        <LogIn size={16} />
        <span className="hidden sm:inline">{language === 'ko' ? '로그인' : 'LOGIN'}</span>
      </button>

      {/* Signup Button */}
      <button
        type="button"
        onClick={onSignupClick}
        className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-black transition shadow-lg hover:shadow-xl"
      >
        <UserPlus size={16} />
        <span className="hidden sm:inline">{language === 'ko' ? '회원가입' : 'SIGNUP'}</span>
      </button>
    </div>
  );
};

export default AuthButtons;
