
import React, { useEffect, useState } from 'react';
import { Outlet, useParams, Link, useLocation } from 'react-router-dom';
import { SocietyProvider } from '../contexts/SocietyContext';
import { useAuth } from '../hooks/useAuth';
import { useSubdomain } from '../hooks/useSubdomain';
import { getSocietyAdminPath } from '../utils/pathHelper';
import { DEFAULT_SOCIETY_FEATURES, APP_VERSION } from '../constants/defaults';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Button } from '../components/ui/button';
import { LayoutDashboard, Settings, Users, Mail, ShieldCheck, LogOut, Building2, Cog } from 'lucide-react';
import { cn } from '../lib/utils';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function SocietyLayout() {
  const { sid: paramSid } = useParams<{ sid: string }>();
  const { subdomain } = useSubdomain();
  const sid = subdomain || paramSid;

  const [society, setSociety] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  
  // Fetch Society Data
  useEffect(() => {
    if (!sid) {
        setLoading(false);
        return;
    }
    const fetchSociety = async () => {
        try {
            const docRef = doc(db, 'societies', sid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setSociety({ id: docSnap.id, ...docSnap.data() });
            } else {
                console.error('Society not found');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    fetchSociety();
  }, [sid]);

  // Merge Features (Deep Merge Simulation)
  const features = { ...DEFAULT_SOCIETY_FEATURES, ...(society?.features || {}) };

  // Theme
  useEffect(() => {
      // Navy Theme
      document.body.style.backgroundColor = '#f3f4f6'; // gray-100
      return () => { document.body.style.backgroundColor = ''; };
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!society) return <div>Society Not Found</div>;

  const navItems = [
    { href: getSocietyAdminPath(sid!, '', subdomain), label: '대시보드', icon: LayoutDashboard, key: 'dashboard' },
    { href: getSocietyAdminPath(sid!, 'infra', subdomain), label: '인프라 설정', icon: Settings, key: 'infra' },
    { href: getSocietyAdminPath(sid!, 'identity', subdomain), label: '아이덴티티', icon: Building2, key: 'identity' },
    { href: getSocietyAdminPath(sid!, 'members', subdomain), label: '회원 명단', icon: ShieldCheck, key: 'members' },
    { href: getSocietyAdminPath(sid!, 'templates', subdomain), label: '알림톡 템플릿', icon: Mail, key: 'templates' },
    { href: getSocietyAdminPath(sid!, 'users', subdomain), label: '관리자 계정', icon: Users, key: 'users' },
  ];

  return (
    <SocietyProvider value={{ societyId: sid!, society, features }}>
      <div className="flex h-screen bg-gray-100">
        <aside className="w-64 bg-[#001f3f] text-white flex flex-col border-r border-[#003366]">
            <div className="h-16 flex items-center justify-center border-b border-[#003366] font-bold text-xl">
                {society.name?.ko || society.name?.en || sid?.toUpperCase()} HQ
            </div>
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map(item => {
                    const isActive = location.pathname === item.href;
                    const isFeatureActive = features[item.key] ?? true;
                    
                    return (
                        <Link 
                            key={item.href} 
                            to={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                                isActive 
                                    ? "bg-[#003366] text-white border border-blue-400" 
                                    : isFeatureActive 
                                        ? "text-blue-200 hover:bg-[#003366]/50 hover:text-white"
                                        : "text-blue-300/50 hover:bg-[#003366]/30 hover:text-blue-300/70"
                            )}
                        >
                            <item.icon className={cn(
                                "w-4 h-4",
                                !isFeatureActive && "opacity-50"
                            )} />
                            <span className={cn(
                                "flex-1",
                                !isFeatureActive && "opacity-60"
                            )}>
                                {item.label}
                            </span>
                            {!isFeatureActive && (
                                <span className="ml-auto px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
                                    준비 중
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-[#003366]">
                 <Button variant="ghost" className="w-full justify-start gap-2 text-blue-300 hover:text-white" onClick={() => auth.signOut()}>
                    <LogOut className="w-4 h-4" /> 로그아웃
                 </Button>
            </div>
            <div className="p-2 bg-[#00152b] text-[10px] text-blue-400 text-center">
                v{APP_VERSION}
            </div>
        </aside>
        <main className="flex-1 overflow-auto p-6">
            <Outlet />
        </main>
      </div>
    </SocietyProvider>
  );
}
