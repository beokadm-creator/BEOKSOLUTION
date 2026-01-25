import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useAdminStore } from '../../store/adminStore';
import ContextSwitcher from './ContextSwitcher';
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
    ArrowLeft,
    Building2,
    Mail,
    Globe,
    ShieldCheck,
    Camera,
    Printer
} from 'lucide-react';

import { auth } from '../../firebase';

// Helper to prevent crash 
const safeRender = (val: any) => { 
  if (typeof val === 'string') return val; 
  if (typeof val === 'object' && val !== null) return val.ko || val.en || JSON.stringify(val); 
  return ''; 
}; 

// Inline Sidebar to avoid import issues
const SidebarContent = ({ location, confId }: { location: any, confId: string | undefined }) => {
    const { inConferenceMode, selectedConferenceSlug } = useAdminStore();

    // Helper to check active route
    const isActive = (path: string) => {
        // Special case for Settings (Event Info) vs Registration Settings
        if (path === '/admin/conference/settings') {
             // Only active if it is EXACTLY settings or starts with settings but NOT registration
             return location.pathname === path || (location.pathname.startsWith(path) && !location.pathname.includes('/registration'));
        }
        return location.pathname.includes(path);
    };

    // Society Mode Menu (Infrastructure & Global)
    const societyNavItems = [
        { href: '/admin/society', label: '학회 대시보드', icon: LayoutDashboard },
        { href: '/admin/infra', label: '인프라 설정 (PG/알림)', icon: Settings },
        { href: '/admin/identity', label: '학회 아이덴티티', icon: Building2 },
        { href: '/admin/members', label: '회원 명단 관리', icon: ShieldCheck },
        { href: '/admin/templates', label: '알림톡 템플릿', icon: Mail },
        { href: '/admin/users', label: '관리자 계정', icon: Users },
    ];

    // Conference Mode Menu (Event Specific)
    const conferenceNavItems = [
        { href: '/admin/conference/dashboard', label: '대시보드', icon: LayoutDashboard },
        { href: '/admin/conference/settings', label: '행사 정보 설정', icon: Globe },
        { href: '/admin/conference/agenda', label: '프로그램 관리', icon: FileText },
        { href: '/admin/conference/registrations', label: '등록자 관리', icon: Users },
        { href: '/admin/conference/pages', label: '페이지 에디터', icon: FileText },
        { href: '/admin/conference/settings/registration', label: '등록 설정', icon: Settings },
        { href: '/admin/conference/attendance/settings', label: '수강/이수 설정', icon: QrCode },
        { href: '/admin/conference/attendance/live', label: '실시간 출결 현황', icon: Monitor },
        { href: '/admin/conference/attendance/scanner', label: '키오스크 스캐너', icon: Camera },
        { href: '/admin/conference/attendance/infodesk', label: '인포데스크 (Info)', icon: Printer }, // Added
        { href: '/admin/conference/badge-editor', label: '명찰 디자인', icon: QrCode },
        { href: '/admin/conference/refunds', label: '환불 관리', icon: CreditCard },
    ];

    const opsItems = [
        { href: '/ops/info-desk', label: 'Info Desk (키오스크)', icon: Monitor },
        { href: '/ops/access', label: '출입 통제 (Scanner)', icon: QrCode },
    ];

    return (
        <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen flex-shrink-0 transition-all duration-300 hidden md:flex">
            {/* 1. THE CONTEXT SWITCHER (Must be at the top) */} 
            <div className="border-b border-slate-700 bg-slate-800 p-2"> 
                <ContextSwitcher /> 
            </div>
            
            <nav className="flex-1 overflow-y-auto py-4">
                {inConferenceMode ? (
                   // --- CONFERENCE MODE MENU --- 
                   <div className="space-y-1 px-2">
                     <div className="px-3 py-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                       Event Management
                     </div>
                     {conferenceNavItems.map((item) => (
                        <Link 
                            key={item.href} 
                            to={item.href} 
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isActive(item.href) 
                                    ? "bg-blue-600 text-white" 
                                    : "text-slate-300 hover:bg-slate-800"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </Link>
                     ))}
                   </div> 
                ) : (
                   // --- SOCIETY HQ MENU --- 
                   <div className="space-y-1 px-2">
                      <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                       Society HQ
                     </div>
                     {societyNavItems.map((item) => (
                        <Link 
                            key={item.href} 
                            to={item.href} 
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isActive(item.href) 
                                    ? "bg-slate-700 text-white" 
                                    : "text-slate-300 hover:bg-slate-800"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </Link>
                     ))}
                   </div>
                )}

                <div className="my-4 border-t border-slate-800 mx-2" />
                <p className="px-5 text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">OPERATIONS</p>
                
                {opsItems.map((item) => (
                    <Link 
                        key={item.href} 
                        to={item.href} 
                        className="flex items-center gap-3 px-5 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                    </Link>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-800">
                <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-900/20" 
                    onClick={async (e) => {
                        e.preventDefault();
                        await auth.signOut();
                        window.location.href = '/admin/login';
                    }}
                >
                    <LogOut className="w-4 h-4" />
                    로그아웃 (Exit)
                </Button>
            </div>
            
            {/* 3. Version Tag (Footer) */} 
            <div className="p-2 bg-slate-950 text-[10px] text-slate-600 border-t border-slate-900 text-center"> 
                <p>e-Regi Console v3.2</p> 
                <p>Member DB Added ✅</p> 
            </div> 
        </aside>
    );
};

export default function ManualAdminWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { inConferenceMode, selectedConferenceTitle, exitConferenceMode } = useAdminStore();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-gray-100">
      <SidebarContent location={location} confId={'MANUAL'} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Simple Header for Mobile */}
        <header className={`h-16 shadow-sm flex items-center justify-between px-6 ${inConferenceMode ? 'bg-white' : 'bg-white'}`}> 
             <h2 className="text-xl font-bold text-gray-800"> 
               {inConferenceMode ? ( 
                 <span className="text-blue-600"> 
                    Active: {safeRender(selectedConferenceTitle)} 
                 </span> 
               ) : ( 
                 <span className="text-gray-600">Society HQ</span> 
               )} 
             </h2> 
              {inConferenceMode && ( 
               <button onClick={() => { exitConferenceMode(); navigate('/admin/society'); }} className="text-sm text-gray-500 hover:text-red-500"> 
                 Exit to HQ 
               </button> 
             )} 
             <div className="md:hidden">
                <Button variant="ghost" size="icon"><Menu className="w-5 h-5" /></Button>
             </div>
        </header> 

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}