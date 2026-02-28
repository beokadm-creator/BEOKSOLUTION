import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Button } from '../components/ui/button';
import { LogOut, Building2, PanelLeftClose, PanelLeft, LayoutDashboard, QrCode, FileSpreadsheet, Settings } from 'lucide-react';

export default function VendorPortalLayout() {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [vendors, setVendors] = useState<any[]>([]);
    const [activeVendorId, setActiveVendorId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuth = async () => {
            const auth = getAuth();
            if (!auth.currentUser) {
                setLoading(false);
                return;
            }

            try {
                // Find vendors where the user is admin or owner
                const vQuery1 = query(collection(db, 'vendors'), where('adminEmail', '==', auth.currentUser.email));
                const vQuery2 = query(collection(db, 'vendors'), where('ownerUid', '==', auth.currentUser.uid));

                const [snap1, snap2] = await Promise.all([getDocs(vQuery1), getDocs(vQuery2)]);

                const combined = [...snap1.docs, ...snap2.docs];
                const uniqueVendors = Array.from(new Map(combined.map(d => [d.id, { id: d.id, ...d.data() }])).values());

                if (uniqueVendors.length > 0) {
                    setVendors(uniqueVendors);
                    setActiveVendorId(uniqueVendors[0].id); // Default to first
                    setAuthorized(true);
                } else {
                    setAuthorized(false);
                }
            } catch (error) {
                console.error("Failed to fetch vendors", error);
                setAuthorized(false);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

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

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            {/* Sidebar */}
            <aside className={`bg-indigo-900 text-white transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-64' : 'w-20'}`}>
                <div className="p-4 flex items-center justify-between border-b border-indigo-800">
                    {sidebarOpen && <span className="font-bold text-xl tracking-wide flex items-center gap-2"><Building2 className="w-5 h-5" /> eRegi B2B</span>}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-indigo-800 rounded">
                        {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5 mx-auto" />}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-4">
                    {sidebarOpen && (
                        <div className="px-4 mb-6">
                            <label className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2 block">Active Partner</label>
                            <select
                                value={activeVendorId || ''}
                                onChange={(e) => setActiveVendorId(e.target.value)}
                                className="w-full bg-indigo-800 border-none rounded text-sm py-2 px-3 text-white focus:ring-0"
                            >
                                {vendors.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <nav className="space-y-1 px-2">
                        {/* More navigation items can be added here */}
                        <a href="#" className="bg-indigo-800 text-white group flex items-center px-2 py-2 text-sm font-medium rounded-md">
                            <LayoutDashboard className={`flex-shrink-0 w-5 h-5 text-indigo-300 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                            {sidebarOpen && 'Dashboard Overview'}
                        </a>
                    </nav>
                </div>

                <div className="p-4 border-t border-indigo-800">
                    <button onClick={handleLogout} className={`flex items-center text-sm font-medium text-indigo-300 hover:text-white w-full ${!sidebarOpen && 'justify-center'}`}>
                        <LogOut className={`flex-shrink-0 w-5 h-5 ${sidebarOpen ? 'mr-3' : ''}`} />
                        {sidebarOpen && 'Sign out'}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6 justify-between shadow-sm z-10">
                    <h1 className="text-xl font-semibold text-gray-800">
                        {activeVendor?.name || 'Loading...'}
                    </h1>
                </header>
                <div className="flex-1 overflow-auto p-6">
                    {/* We pass activeVendorId to children via Outlet context so they know which vendor to load data for */}
                    <Outlet context={{ activeVendorId }} />
                </div>
            </main>
        </div>
    );
}
