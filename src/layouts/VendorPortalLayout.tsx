import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useNavigate, NavLink, useLocation, useParams } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { LogOut, Building2, PanelLeftClose, PanelLeft, LayoutDashboard, QrCode, Settings, Users, Bell } from 'lucide-react';

export default function VendorPortalLayout() {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [vendors, setVendors] = useState<any[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();
    const { vendorId: urlVendorId } = useParams<{ vendorId: string }>();

    const isCameraMode = location.pathname.includes('/scanner/camera');

    // URL에서 추출한 vendorId 또는 첫 번째 벤더 ID
    const activeVendorId = urlVendorId || (vendors.length > 0 ? vendors[0].id : null);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setLoading(false);
                setAuthorized(false);
                return;
            }

            try {
                // Find vendors where the user is admin, owner, or staff
                const vQuery1 = query(collection(db, 'vendors'), where('adminEmail', '==', user.email));
                const vQuery2 = query(collection(db, 'vendors'), where('ownerUid', '==', user.uid));
                const vQuery3 = query(collection(db, 'vendors'), where('staffEmails', 'array-contains', user.email));

                const [snap1, snap2, snap3] = await Promise.all([getDocs(vQuery1), getDocs(vQuery2), getDocs(vQuery3)]);

                const combined = [...snap1.docs, ...snap2.docs, ...snap3.docs];
                // Deduplicate by ID
                const uniqueVendors = Array.from(
                    new Map(combined.map(doc => [doc.id, { id: doc.id, ...doc.data() }])).values()
                );

                if (uniqueVendors.length === 0) {
                    setAuthorized(false);
                } else {
                    setVendors(uniqueVendors as any[]);
                    setAuthorized(true);
                }
            } catch (err) {
                console.error('Vendor auth error:', err);
                setAuthorized(false);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // URL에 vendorId가 없거나 권한 없는 vendorId인 경우 첫 번째 벤더로 리다이렉트
    useEffect(() => {
        if (!loading && authorized && vendors.length > 0) {
            const validVendorIds = vendors.map(v => v.id);
            
            // URL이 /partner로 끝나면 첫 번째 벤더로 리다이렉트
            if (location.pathname === '/partner') {
                navigate(`/partner/${vendors[0].id}`, { replace: true });
                return;
            }
            
            // URL에 vendorId가 있지만 권한이 없는 경우
            if (urlVendorId && !validVendorIds.includes(urlVendorId)) {
                navigate(`/partner/${vendors[0].id}`, { replace: true });
            }
        }
    }, [loading, authorized, vendors, urlVendorId, location.pathname, navigate]);

    const handleLogout = async () => {
        const auth = getAuth();
        await auth.signOut();
        navigate('/partner/login');
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><LoadingSpinner /></div>;
    }

    if (!authorized) {
        return <Navigate to="/partner/login" replace />;
    }

    const activeVendor = vendors.find(v => v.id === activeVendorId);

    // NavLink 경로 생성 (vendorId 포함)
    const getNavPath = (path: string) => {
        if (!activeVendorId) return '/partner';
        return `/partner/${activeVendorId}${path ? `/${path}` : ''}`;
    };

    return (
        <div className="flex h-[100dvh] bg-gray-100 font-sans">
            {/* Sidebar */}
            {!isCameraMode && (
                <aside className={`bg-indigo-900 text-white transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-64' : 'w-20'}`}>
                    <div className="p-4 flex items-center justify-between border-b border-indigo-800">
                        {sidebarOpen && <span className="font-bold text-xl tracking-wide flex items-center gap-2"><Building2 className="w-5 h-5" /> eRegi B2B</span>}
                        <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-indigo-800 rounded">
                            {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5 mx-auto" />}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto py-4">
                        {sidebarOpen && (
                            <div className="px-4 mb-6">
                                <label htmlFor="vendor-select" className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2 block">Active Partner</label>
                                <select
                                    id="vendor-select"
                                    value={activeVendorId || ''}
                                    onChange={(e) => navigate(`/partner/${e.target.value}`)}
                                    className="w-full bg-indigo-800 border-none rounded text-sm py-2 px-3 text-white focus:ring-0"
                                >
                                    {vendors.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <nav className="space-y-1 px-2">
                            <NavLink
                                to={getNavPath('')}
                                end
                                className={({ isActive }) => `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-indigo-800 text-white' : 'text-indigo-300 hover:bg-indigo-800 hover:text-white'}`}
                            >
                                <LayoutDashboard className={`flex-shrink-0 w-5 h-5 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                                {sidebarOpen && 'Overview'}
                            </NavLink>

                            <NavLink
                                to={getNavPath('scanner')}
                                className={({ isActive }) => `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-indigo-800 text-white' : 'text-indigo-300 hover:bg-indigo-800 hover:text-white'}`}
                            >
                                <QrCode className={`flex-shrink-0 w-5 h-5 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                                {sidebarOpen && 'Scanner'}
                            </NavLink>

                            <NavLink
                                to={getNavPath('profile')}
                                className={({ isActive }) => `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-indigo-800 text-white' : 'text-indigo-300 hover:bg-indigo-800 hover:text-white'}`}
                            >
                                <Settings className={`flex-shrink-0 w-5 h-5 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                                {sidebarOpen && 'Profile Settings'}
                            </NavLink>

                            <NavLink
                                to={getNavPath('staff')}
                                className={({ isActive }) => `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-indigo-800 text-white' : 'text-indigo-300 hover:bg-indigo-800 hover:text-white'}`}
                            >
                                <Users className={`flex-shrink-0 w-5 h-5 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                                {sidebarOpen && 'Staff Management'}
                            </NavLink>

                            <NavLink
                                to={getNavPath('notification')}
                                className={({ isActive }) => `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-indigo-800 text-white' : 'text-indigo-300 hover:bg-indigo-800 hover:text-white'}`}
                            >
                                <Bell className={`flex-shrink-0 w-5 h-5 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                                {sidebarOpen && 'Notification'}
                            </NavLink>
                        </nav>
                    </div>

                    <div className="p-4 border-t border-indigo-800">
                        <button type="button" onClick={handleLogout} className={`flex items-center text-sm font-medium text-indigo-300 hover:text-white w-full ${!sidebarOpen && 'justify-center'}`}>
                            <LogOut className={`flex-shrink-0 w-5 h-5 ${sidebarOpen ? 'mr-3' : ''}`} />
                            {sidebarOpen && 'Sign out'}
                        </button>
                    </div>
                </aside>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {!isCameraMode && (
                    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6 justify-between shadow-sm z-10 shrink-0">
                        <h1 className="text-xl font-semibold text-gray-800">
                            {activeVendor?.name || 'Loading...'}
                        </h1>
                    </header>
                )}
                <div className={`flex-1 overflow-auto ${isCameraMode ? 'p-0 w-full h-full bg-black' : 'p-6'}`}>
                    {/* We pass activeVendorId to children via Outlet context so they know which vendor to load data for */}
                    <Outlet context={{ activeVendorId }} />
                </div>
            </main>
        </div>
    );
}
