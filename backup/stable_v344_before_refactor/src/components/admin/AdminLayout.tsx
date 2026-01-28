import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useSocietyAdmin } from '../../hooks/useSocietyAdmin';
import { useSociety } from '../../hooks/useSociety';
import { useAuth } from '../../hooks/useAuth';
import { useAdminStore } from '../../store/adminStore';
import {
  LayoutDashboard,
  Settings,
  Users,
  FileText,
  CreditCard,
  QrCode,
  Monitor,
  LogOut,
  Menu,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import ConferenceSelector from './ConferenceSelector';
import GlobalSearch from './GlobalSearch';
import SuperAdminWidgets from './SuperAdminWidgets';
import { SuperAdminErrorBoundary } from './SuperAdminErrorBoundary';

export default function AdminLayout() {
  const { society } = useSociety();
  const { auth: { user, loading: authLoading, syncError } } = useAuth(society?.id);
  const { isSocietyAdmin: isAuthorized, loading: adminLoading } = useSocietyAdmin(society?.id, user?.email);
  const [isReady, setIsReady] = useState(false);
  const location = useLocation();
  const { pathname } = useLocation(); 
  const isSuperPath = pathname.startsWith('/super'); // 최상단 선언 

  // [Super Pass] 슈퍼관리자 경로는 레이아웃 가드를 완전히 무시함
  if (isSuperPath) {
    console.log('SUPER PASS ACTIVE');
    return <Outlet />;
  }

  const navigate = useNavigate();
  const { inConferenceMode, selectedConferenceId, selectedSocietyId, exitConferenceMode, enterConferenceMode } = useAdminStore();

  // Firebase Auth State Management - Unified to useAuth
  // Old listener removed to prevent duplicates

  useEffect(() => {
    // Wait until everything is loaded
    // [Kill Switch] If super path, ignore adminLoading (since we skipped it)
    // [Silent Patch] If syncError is true, ignore authLoading (force render)
    if (!isReady && (!authLoading || syncError) && (isSuperPath || !adminLoading)) { 
        setIsReady(true); 
    } 
  }, [authLoading, adminLoading, isSuperPath, isReady, syncError]);

  // [Visual Fix] Force Charcoal & Gold Theme for Super Admin Routes
  useEffect(() => {
    const html = document.documentElement;

    // Check if the class is already applied to avoid infinite re-renders
    const hasDarkClass = html.classList.contains('dark');

    if (isSuperPath && !hasDarkClass) {
      html.classList.add('dark');
      // Force background color to avoid white flashes
      document.body.style.backgroundColor = '#1a1a1a';
      document.body.style.color = '#e5e7eb'; // tailwind gray-200
    } else if (!isSuperPath && hasDarkClass) {
      html.classList.remove('dark');
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
    }
  }, [location.pathname]);

  // SUPER ADMIN HARDCODED KEYS (TEMPORARY FOR TESTING)
  const SUPER_ADMINS = ['aaron@beoksolution.com', 'test@eregi.co.kr', 'any@eregi.co.kr']; // Emergency bypass



  // 1. SHOW SPINNER WHILE LOADING
  if (!isReady) {
    return (
      <div className="flex h-screen bg-[#1a1a1a]">
        {/* Charcoal Sidebar Mockup */}
        <div className="hidden md:flex w-64 flex-col bg-[#111] border-r border-[#333] p-4 space-y-4">
          <div className="h-8 bg-[#333] rounded animate-pulse w-3/4 mx-auto mb-4"></div>
          {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-[#222] rounded animate-pulse"></div>)}
        </div>
        {/* Main Content Mockup */}
        <div className="flex-1 p-8 space-y-6">
          <div className="h-32 bg-[#222] rounded-2xl animate-pulse border border-[#333]"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-[#222] rounded-xl animate-pulse border border-[#333]"></div>)}
          </div>
          <div className="flex justify-center mt-20">
            <div className="text-amber-500 font-mono text-sm animate-bounce tracking-widest">GUARD CHECKING...</div>
          </div>
        </div>
      </div>
    );
  }

  // 2. NO USER -> LOGIN
  useEffect(() => {
    if (isReady && !user) {
      console.log('[AdminLayout] No user found, redirecting to login...');
      if (location.pathname !== '/admin/login') {
        navigate('/admin/login');
      }
    }
  }, [isReady, user, location.pathname, navigate]);

  if (!user) {
    return null;
  }

  // 3. SUPER ADMIN BYPASS (THE GOLDEN TICKET)
  // If email matches, render layout IMMEDIATELY. Ignore isAuthorized.
  if (SUPER_ADMINS.includes(user.email || '')) {
    console.log('[AdminLayout] Super Admin access granted for:', user.email);
    return (
      <SuperAdminErrorBoundary>
        <div className="flex h-screen bg-gray-100 dark:bg-[#1a1a1a]">
          <SidebarContent location={location} confId={society?.id} settings={society?.settings} theme="charcoal" />
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header Placeholder if needed */}
            <div className="md:hidden fixed top-0 w-full bg-white border-b z-50 p-4 flex items-center justify-between">
              <span className="font-bold">{society?.id} Admin</span>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </div>

            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6 pt-20 md:pt-6">
              {/* [Step 301-D] Root Guard Banner */}
              <div className="bg-gradient-to-r from-amber-700 via-yellow-600 to-amber-700 text-white text-xs font-black tracking-[0.2em] text-center py-1.5 shadow-md border-b border-amber-800 mb-6 rounded-lg uppercase">
                ★ Platform Master Control ★
              </div>

              <div className="bg-[#1a1a1a] p-6 text-[#fbbf24] mb-8 rounded-2xl border border-[#333] shadow-2xl relative overflow-hidden">
                {/* Background Texture */}
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fbbf24 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="bg-[#333] p-3 rounded-xl border border-[#444] shadow-inner"><ShieldCheck aria-hidden="true" className="w-8 h-8 animate-pulse text-amber-500" /></div>
                    <div>
                      <h2 className="font-black text-2xl leading-none tracking-tight text-white mb-1">SUPER ADMIN CONSOLE</h2>
                      <p className="text-sm text-gray-400 font-mono flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        {user.email} triggers root access
                      </p>
                    </div>
                  </div>
                  <div className="w-full md:w-5/12">
                    <GlobalSearch />
                  </div>
                </div>

                {/* [Step 301-D] Neon Style Counter Widgets */}
                <SuperAdminWidgets />
              </div>

              {inConferenceMode ? (
                // Conference Mode UI
                <>
                  <div className="bg-blue-50 border border-blue-200 p-4 mb-4 rounded">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-blue-800">
                        컨퍼런스 관리 모드 ({selectedConferenceId})
                      </h3>
                      <Button
                        onClick={exitConferenceMode}
                        variant="outline"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        학회 관리로 돌아가기
                      </Button>
                    </div>
                  </div>
                  <ConferenceSelector />
                  <Outlet />
                </>
              ) : (
                // Society Mode UI
                <>
                  <ConferenceSelector />
                  <Outlet />
                </>
              )}
            </main>
          </div>
        </div>
      </SuperAdminErrorBoundary>
    );
  }

  // 4. NORMAL ADMIN CHECK
  if (!isAuthorized) {
    // Show Access Denied Screen instead of Loop (Safety Net)
    console.log('[AdminLayout] Access denied for:', user.email, 'Society:', society?.id, 'Authorized:', isAuthorized);
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-red-50 text-red-800">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p>You are logged in as: {user.email}</p>
        <p>But you are not an admin of: {society?.id}</p>
        <p>Society admins: {JSON.stringify(society?.adminEmails || [])}</p>
        <Button variant="destructive" className="mt-4" onClick={() => window.location.href = `/admin/login`}>
          Go to Login
        </Button>
      </div>
    );
  }

  // 5. NORMAL ADMIN RENDER (AUTHORIZED)
  console.log('[AdminLayout] Normal admin access granted for:', user.email);

  // 5. NORMAL ADMIN RENDER
  // Determine Theme for Normal Admin
  const currentTheme = inConferenceMode ? 'academic' : 'navy';

  return (
    <div className="flex h-screen bg-gray-100">
      <SidebarContent location={location} confId={society?.id} theme={currentTheme} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden fixed top-0 w-full bg-white border-b z-50 p-4 flex items-center justify-between">
          <span className="font-bold">{society?.id} Admin</span>
          <Button variant="ghost" size="icon">
            <Menu className="w-5 h-5" />
          </Button>
        </div>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6 pt-20 md:pt-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Extracted Sidebar for reuse
interface SidebarProps {
  location: any;
  confId: string | undefined;
  settings?: any;
  theme?: 'charcoal' | 'navy' | 'academic';
}

function SidebarContent({ location, confId, settings, theme = 'navy' }: SidebarProps) {
  const isActive = (href: string) => {
    // Precise check for Registration Settings
    if (href === '/admin/settings/registration') return location.pathname.includes('/settings/registration');
    // Precise check for Event Info (exclude registration)
    if (href === '/admin/config') return location.pathname.includes('/config') && !location.pathname.includes('/settings/registration');

    // Default fallback
    return location.pathname === href;
  };

  // Theme Styles
  const themeStyles = {
    charcoal: {
      aside: 'bg-[#1a1a1a] border-r border-[#333]',
      header: 'text-[#fbbf24] border-b border-[#333]',
      itemActive: 'bg-[#333] text-[#fbbf24] border-[#fbbf24]',
      itemInactive: 'text-gray-400 hover:bg-[#252525] hover:text-gray-200',
      logout: 'text-gray-500 hover:text-[#fbbf24]'
    },
    navy: {
      aside: 'bg-[#001f3f] border-r border-[#003366]',
      header: 'text-blue-100 border-b border-[#003366]',
      itemActive: 'bg-[#003366] text-white border-blue-400',
      itemInactive: 'text-blue-200/70 hover:bg-[#003366]/50 hover:text-white',
      logout: 'text-blue-300 hover:text-white'
    },
    academic: {
      aside: 'bg-white border-r border-gray-200',
      header: 'text-[#003366] border-b border-gray-100',
      itemActive: 'bg-[#003366] text-white shadow-md shadow-blue-900/20',
      itemInactive: 'text-gray-500 hover:bg-gray-50 hover:text-[#003366]',
      logout: 'text-gray-400 hover:text-red-500'
    }
  };

  const s = themeStyles[theme];

  let navItems = [
    { href: '/admin', label: '대시보드', icon: LayoutDashboard },
    { href: '/admin/config', label: '행사 정보 설정', icon: Settings },
    { href: '/admin/settings/registration', label: '등록 관리', icon: Settings },
    { href: '/admin/agenda', label: '프로그램 관리', icon: FileText },
    { href: '/admin/registrations', label: '등록자 목록', icon: Users },
    { href: '/admin/abstracts', label: '초록 관리', icon: FileText },
    { href: '/admin/badge-editor', label: '배지 편집', icon: QrCode },
    { href: '/admin/refunds', label: '환불 관리', icon: CreditCard },
    { href: '/admin/templates', label: '알림톡 템플릿', icon: FileText },
  ];

  // [Feature] Abstract Menu Visibility Fallback
  // Default to true if settings or abstractEnabled is undefined
  const abstractEnabled = settings?.abstractEnabled !== undefined ? settings.abstractEnabled : true;

  if (!abstractEnabled) {
    navItems = navItems.filter(item => item.href !== '/admin/abstracts');
  }

  if (theme === 'charcoal') {
    navItems = [
      { href: '/super', label: 'Super Dashboard', icon: LayoutDashboard },
      { href: '/super/security', label: 'Security Engine', icon: ShieldCheck },
    ];
  }

  const opsItems = [
    { href: '/ops/info-desk', label: '안내 데스크', icon: Monitor },
    { href: '/ops/access', label: '출입 통제', icon: QrCode },
  ];

  return (
    <aside className={cn("hidden md:flex w-64 flex-col transition-colors duration-300", s.aside)}>
      <div className={cn("h-16 flex items-center justify-center", s.header)}>
        <h1 className="text-xl font-bold tracking-tight">
          {theme === 'charcoal' ? 'ROOT CONTROL' : `${confId?.toUpperCase()} ADMIN`}
        </h1>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive(item.href)
                ? s.itemActive
                : s.itemInactive
            )}
          >
            <item.icon className={cn("w-4 h-4", isActive(item.href) ? "text-blue-100/90" : "opacity-70")} />
            {item.label}
          </Link>
        ))}

        <div className={cn("my-4 border-t", theme === 'charcoal' ? 'border-[#333]' : theme === 'navy' ? 'border-[#003366]' : 'border-gray-100')} />
        <p className={cn("px-3 text-xs font-semibold mb-2", theme === 'academic' ? "text-gray-400" : "text-gray-500")}>운영 관리</p>

        {opsItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              s.itemInactive
            )}
          >
            <item.icon className="w-4 h-4 opacity-70" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className={cn("p-4 border-t", theme === 'charcoal' ? 'border-[#333]' : theme === 'navy' ? 'border-[#003366]' : 'border-gray-200')}>
        <Button
          variant="ghost"
          className={cn("w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10", s.logout)}
          onClick={async (e) => {
            e.preventDefault();
            await auth.signOut();
            window.location.href = '/admin/login';
          }}
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </Button>
      </div>
      <div className="p-4 bg-slate-950 text-xs text-slate-500 border-t border-slate-800">
        <p>e-Regi Console</p>
        <p className="text-green-500 font-bold">v3.1 (NicePay Active) ✅</p>
      </div>
    </aside>
  );
}
