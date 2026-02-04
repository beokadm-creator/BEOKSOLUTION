import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronDown, Settings, Calendar, X } from 'lucide-react';
import type { Language } from '../../../hooks/useLanguage';

interface UserMenuDropdownProps {
  userName?: string;
  userEmail?: string;
  onLogout: () => void;
  onNavigateToMypage: () => void;
  language?: Language;
  onToggleLanguage?: () => void;
  onNavigateToSettings?: () => void;
}

const UserMenuDropdown: React.FC<UserMenuDropdownProps> = ({
  userName,
  userEmail,
  onLogout,
  onNavigateToMypage,
  language = 'ko',
  onToggleLanguage,
  onNavigateToSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    {
      icon: User,
      label: language === 'ko' ? '마이페이지' : 'My Page',
      description: language === 'ko' ? '내 정보 관리' : 'Manage my profile',
      onClick: onNavigateToMypage,
      color: 'text-blue-600',
    },
    {
      icon: Calendar,
      label: language === 'ko' ? '참여 현황' : 'My Conferences',
      description: language === 'ko' ? '학술대회 참여 내역' : 'Conference history',
      onClick: onNavigateToMypage,
      color: 'text-indigo-600',
    },
    ...(onToggleLanguage
      ? [
          {
            icon: Settings,
            label: language === 'ko' ? 'English' : '한국어',
            description: language === 'ko' ? '언어 변경 / Change Language' : '',
            onClick: onToggleLanguage,
            color: 'text-purple-600',
          },
        ]
      : []),
    ...(onNavigateToSettings
      ? [
          {
            icon: Settings,
            label: language === 'ko' ? '설정' : 'Settings',
            description: language === 'ko' ? '계정 설정' : 'Account settings',
            onClick: onNavigateToSettings,
            color: 'text-slate-600',
          },
        ]
      : []),
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl"
      >
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <User size={16} />
        </div>
        <span className="hidden sm:inline max-w-[120px] truncate">
          {userName || userEmail?.split('@')[0] || 'User'}
        </span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* User Info Header */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <User size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-base truncate">{userName || 'User'}</p>
                  <p className="text-xs text-slate-300 truncate">{userEmail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    item.onClick();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-all text-left group"
                >
                  <div className={`w-10 h-10 ${item.color.replace('text-', 'bg-').replace('-600', '/50')} rounded-lg flex items-center justify-center ${item.color}`}>
                    <item.icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm">{item.label}</p>
                    <p className="text-xs text-slate-500 truncate">{item.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Logout Button */}
            <div className="p-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 transition-all text-left group"
              >
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                  <LogOut size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-red-600 text-sm">
                    {language === 'ko' ? '로그아웃' : 'Logout'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {language === 'ko' ? '로그인 페이지로 이동' : 'Sign out'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserMenuDropdown;
