
import React, { useEffect, useState } from 'react';
import { Outlet, useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import { ConfProvider } from '../contexts/ConfContext';
import { useSubdomain } from '../hooks/useSubdomain';
import { doc, getDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { LayoutDashboard, Globe, FileText, Users, Settings, QrCode, Monitor, CreditCard, LogOut, ArrowLeft, Printer, BarChart, UserPlus, Building2, Bell } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';

export default function ConfLayout() {
    const { cid } = useParams<{ cid: string }>();
    const { subdomain } = useSubdomain();

    const [conference, setConference] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const isKioskMode = searchParams.get('mode') === 'kiosk';

    useEffect(() => {
        if (!cid) return;
        const fetchConf = async () => {
            try {
                // Step 1: Try fetching by ID first
                const docRef = doc(db, 'conferences', cid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    // Security Check: Society ID Mismatch
                    if (subdomain && data.id.split('_')[0] !== subdomain) {
                        console.error('Society Mismatch');
                        setConference(null);
                    } else {
                        setConference(data);
                    }
                } else {
                    // Step 2: Fallback to slug search
                    const q = query(collection(db, 'conferences'), where('slug', '==', cid), limit(1));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const docData = querySnapshot.docs[0];
                        const data = { id: docData.id, ...docData.data() };
                        // Security Check: Society ID Mismatch
                        if (subdomain && data.id.split('_')[0] !== subdomain) {
                            console.error('Society Mismatch');
                            setConference(null);
                        } else {
                            setConference(data);
                        }
                    } else {
                        console.error('Conference not found');
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchConf();
    }, [cid, subdomain]);

    if (loading) return <LoadingSpinner />;
    if (!conference) return <div>Conference Not Found</div>;

    const navItems = [
        { href: `/admin/conf/${cid}`, label: '대시보드', icon: LayoutDashboard },
        { href: `/admin/conf/${cid}/settings`, label: '행사 정보', icon: Globe },
        { href: `/admin/conf/${cid}/settings/registration`, label: '등록 설정', icon: CreditCard },
        { href: `/admin/conf/${cid}/sponsors`, label: '스폰서 관리', icon: Building2 },
        { href: `/admin/conf/${cid}/agenda`, label: '프로그램', icon: FileText },
        { href: `/admin/conf/${cid}/abstracts`, label: '초록 관리', icon: FileText },
        { href: `/admin/conf/${cid}/notices`, label: '공지사항 관리', icon: Bell },
        { href: `/admin/conf/${cid}/registrations`, label: '등록자 관리', icon: Users },
        { href: `/admin/conf/${cid}/external-attendees`, label: '외부 참석자', icon: UserPlus },
        { href: `/admin/conf/${cid}/infodesk`, label: '인포데스크', icon: Printer },
        { href: `/admin/conf/${cid}/gate`, label: '출입 게이트', icon: QrCode },
        { href: `/admin/conf/${cid}/attendance-settings`, label: '수강 설정', icon: Settings },
        { href: `/admin/conf/${cid}/attendance-live`, label: '실시간 출결', icon: Monitor },
        { href: `/admin/conf/${cid}/statistics`, label: '수강 현황', icon: BarChart },
    ];

    return (
        <ConfProvider value={{ confId: cid!, conference, societyId: cid!.split('_')[0] }}>
            <div className="flex h-screen bg-white">
                {!isKioskMode && (
                    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                        <div className="h-16 flex items-center px-4 border-b border-gray-100 text-[#003366] font-bold relative">
                            <a href="/admin/society" className="absolute left-4 p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" title="학회 관리로 돌아가기">
                                <ArrowLeft className="w-5 h-5" />
                            </a>
                            <div className="w-full text-center truncate px-8">
                                {conference.title?.ko || cid}
                            </div>
                        </div>
                        <nav className="flex-1 p-4 space-y-1">
                            {/* Force render for all admins: No permission filter applied */}
                            {navItems.map(item => (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                                        location.pathname === item.href
                                            ? "bg-[#f0f5fa] text-[#003366] shadow-sm border border-[#e1ecf6] font-bold"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    <item.icon className={cn("w-4 h-4", location.pathname === item.href ? "text-[#24669e]" : "text-slate-400")} />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                        <div className="p-4 border-t border-gray-100">
                            <Button variant="ghost" className="w-full justify-start text-gray-400 hover:text-red-500" onClick={() => auth.signOut()}>
                                <LogOut className="w-4 h-4 mr-2" /> Log Out
                            </Button>
                        </div>
                    </aside>
                )}
                <main className={cn("flex-1 overflow-auto", isKioskMode ? "p-0" : "p-6")}>
                    <Outlet />
                </main>
            </div>
        </ConfProvider>
    );
}
