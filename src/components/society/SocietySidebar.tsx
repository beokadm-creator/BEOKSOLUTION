import React from 'react';
import { Home, Building2, User, Calendar, Bell, UserCircle, X, Languages } from 'lucide-react';

interface SocietySidebarProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  isOpen: boolean;
  onClose: () => void;
  societyName?: string;
  hasUser?: boolean;
  language?: 'ko' | 'en';
  onToggleLanguage?: () => void;
}

const menuItems = [
  { id: 'home', label: { ko: '홈', en: 'Home' }, icon: Home, key: 'home' },
  { id: 'intro', label: { ko: '학회소개', en: 'Society Intro' }, icon: Building2, key: 'intro' },
  { id: 'greeting', label: { ko: '학회장 인사말', en: 'President Greeting' }, icon: User, key: 'greeting' },
  { id: 'conferences', label: { ko: '학술대회', en: 'Conferences' }, icon: Calendar, key: 'conferences' },
  { id: 'notices', label: { ko: '공지사항', en: 'Notices' }, icon: Bell, key: 'notices' },
];

const SocietySidebar: React.FC<SocietySidebarProps> = ({
  activeMenu,
  setActiveMenu,
  isOpen,
  onClose,
  societyName,
  hasUser,
  language = 'ko',
  onToggleLanguage,
}) => {
  const filteredMenuItems = hasUser
    ? [...menuItems, { id: 'mypage', label: { ko: '마이페이지', en: 'My Page' }, icon: UserCircle, key: 'mypage' }]
    : menuItems;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-full w-64 bg-[#001f3f] text-white z-50 flex flex-col border-r border-[#003366]
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-[#003366]">
          <div>
            <h1 className="text-lg font-black leading-none">{societyName || 'SOCIETY'}</h1>
            <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mt-1">Portal</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-[#003366] transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveMenu(item.id);
                  onClose();
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all relative
                  ${isActive
                    ? 'bg-[#003366] text-white border border-blue-400 shadow-lg shadow-blue-900/20'
                    : 'text-blue-200 hover:bg-[#003366]/50 hover:text-white'
                  }
                `}
              >
                <Icon size={18} strokeWidth={2.5} />
                <span className="flex-1 text-left">{item.label[language] || item.label.ko}</span>
                {isActive && (
                  <div className="absolute right-2 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#003366] space-y-3">
          {/* Language Toggle */}
          {onToggleLanguage && (
            <button
              type="button"
              onClick={onToggleLanguage}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#003366]/50 hover:bg-[#003366] text-blue-200 hover:text-white transition-all text-xs font-bold"
            >
              <Languages size={14} />
              {language === 'ko' ? 'English' : '한국어'}
            </button>
          )}
          <div className="text-[10px] text-blue-400 text-center font-bold uppercase tracking-widest">
            Society Hub
          </div>
        </div>
      </aside>
    </>
  );
};

export default SocietySidebar;
