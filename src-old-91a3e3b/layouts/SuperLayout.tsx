
import React, { useEffect, useMemo, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { GlobalProvider } from '../contexts/GlobalContext';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck, LayoutDashboard } from 'lucide-react';
import { Button } from '../components/ui/button';
import { auth } from '../firebase';

import { SUPER_ADMINS } from '../constants/defaults';

export default function SuperLayout() {
  const { auth: { user, loading } } = useAuth();
  const navigate = useNavigate();

  // Memoize the super admin check to prevent infinite renders
  const isSuper = useMemo(
    () => !!(user && SUPER_ADMINS.includes(user.email || '')),
    [user?.email]
  );

  // 🔧 [FIX] Guard logic - moved to useEffect with proper dependency check
  useEffect(() => {
    if (loading) return; // Wait for auth to load
    
    if (!isSuper && !window.location.pathname.includes('/admin/login')) {
      console.log('[SuperLayout] Not super admin, redirecting to login');
      navigate('/admin/login', { replace: true });
    }
  }, [isSuper, loading]); // Only depend on actual data, not navigate function

  if (loading) return <div>Loading Auth...</div>;

  // Theme enforcement (Removed useEffect to prevent loops)
  // document.documentElement.classList.add('dark');
  // document.body.style.backgroundColor = '#1a1a1a';
  // document.body.style.color = '#e5e7eb';

  return (
    <GlobalProvider value={{ isSuperAdmin: true, user }}>
      <div className="flex h-screen bg-[#1a1a1a] text-gray-200">
        <aside className="w-64 border-r border-[#333] flex flex-col">
            <div className="h-16 flex items-center justify-center border-b border-[#333] text-[#fbbf24] font-bold tracking-widest">
                ROOT CONTROL
            </div>
            <nav className="flex-1 p-4 space-y-2">
                <Button variant="ghost" className="w-full justify-start gap-2 text-[#fbbf24] hover:bg-[#333]" onClick={() => navigate('/super')}>
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2 text-gray-400 hover:text-white hover:bg-[#333]" onClick={() => navigate('/super/security')}>
                    <ShieldCheck className="w-4 h-4" /> Security
                </Button>
            </nav>
            <div className="p-4 border-t border-[#333]">
                <Button variant="ghost" className="w-full justify-start text-red-400" onClick={() => auth.signOut()}>
                    Sign Out
                </Button>
            </div>
        </aside>
        <main className="flex-1 overflow-auto p-6">
            <Outlet />
        </main>
      </div>
    </GlobalProvider>
  );
}
