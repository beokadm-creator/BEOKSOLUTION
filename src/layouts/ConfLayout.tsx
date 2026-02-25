
import React, { useEffect, useState } from 'react';
import { Outlet, useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import { ConfProvider } from '../contexts/ConfContext';
import { useSubdomain } from '../hooks/useSubdomain';
import { doc, getDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Conference } from '../types/schema';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { LayoutDashboard, Globe, FileText, Users, Settings, QrCode, Monitor, CreditCard, LogOut, ArrowLeft, Printer, BarChart, UserPlus, Building2, Bell, IdCard } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';

export default function ConfLayout() {
    const { cid } = useParams<{ cid: string }>();
    const { subdomain } = useSubdomain();

    // DEV 환경에서 ?society 파라미터도 society ID로 인식
    const societyFromParam = new URLSearchParams(window.location.search).get('society');
    
    // [Fix] In Dev/Hosting environment without subdomain, try to infer societyId from cid (slug)
    // cid format: societyId_conferenceId (e.g., kadd_2026spring)
    let inferredSocietyId: string | null = null;
    if (!subdomain && !societyFromParam && cid && cid.includes('_')) {
        inferredSocietyId = cid.split('_')[0];
    }

    const effectiveSubdomain = subdomain || societyFromParam || inferredSocietyId;

    const [conference, setConference] = useState<Conference | null>(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const isKioskMode = searchParams.get('mode') === 'kiosk';
    const isDev = window.location.hostname.includes('dev') || window.location.hostname.includes('localhost');

    useEffect(() => {
        if (!cid) return;
        
        let isMounted = true;

        const fetchConf = async () => {
            try {
                // Determine paths to try based on cid structure
                // Case 1: cid is kadd_2026spring -> try conferences/kadd_2026spring (Root)
                // Case 2: cid is kadd_2026spring -> try societies/kadd/conferences/2026spring (Nested)
                // Case 3: cid is 2026spring -> try conferences/2026spring (Legacy Root)
                // Case 4: cid is 2026spring -> try query slug=2026spring (Fallback)

                let confData: Conference | null = null;
                let found = false;

                const pathsToTry = [];
                
                // Add Root Path (conferences/{cid})
                pathsToTry.push({ path: `conferences/${cid}`, type: 'root' });

                // Add Nested Path if cid contains '_' (societyId_slug)
                if (cid && cid.includes('_')) {
                    const [sid, slug] = cid.split('_');
                    if (sid && slug) {
                        pathsToTry.push({ path: `societies/${sid}/conferences/${slug}`, type: 'nested' });
                    }
                }

                // Try direct paths
                for (const candidate of pathsToTry) {
                    try {
                        const docRef = doc(db, candidate.path);
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                            console.log(`[ConfLayout] Found conference at ${candidate.path}`);
                            confData = { id: docSnap.id, ...docSnap.data() } as Conference;
                            found = true;
                            break;
                        }
                    } catch (e) {
                        console.warn(`[ConfLayout] Error checking path ${candidate.path}`, e);
                    }
                }

                // Fallback: Query by slug
                if (!found) {
                    const q = query(collection(db, 'conferences'), where('slug', '==', cid), limit(1));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        const docData = querySnapshot.docs[0];
                        confData = { id: docData.id, ...docData.data() } as Conference;
                        found = true;
                        console.log(`[ConfLayout] Found conference by slug query: ${cid}`);
                    }
                }

                if (found && confData) {
                    // Security Check: Society ID Mismatch
                    const confSocietyId = confData.societyId || confData.id.split('_')[0];
                    
                    // Allow access if no effectiveSubdomain (e.g. dev environment or direct access)
                    if (effectiveSubdomain && confSocietyId !== effectiveSubdomain) {
                        console.error('Society Mismatch', { confSocietyId, effectiveSubdomain });
                        // Don't block access in dev mode if mismatch occurs
                        if (isDev) {
                            console.warn('Allowing access despite mismatch in DEV mode');
                            setConference(confData);
                        } else {
                            setConference(null);
                        }
                    } else {
                        setConference(confData);
                    }
                } else {
                    console.error('Conference not found');
                    setConference(null);
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchConf();

        return () => {
            isMounted = false;
        };
    }, [cid, effectiveSubdomain, isDev]);

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
        { href: `/admin/conf/${cid}/badge-management`, label: '명찰 관리', icon: IdCard },
        { href: `/admin/conf/${cid}/options`, label: '옵션 관리', icon: Settings },
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
                            {isDev && (
                                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] px-1 font-bold rounded-bl">
                                    DEV
                                </div>
                            )}
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
