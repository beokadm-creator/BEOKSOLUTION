import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, serverTimestamp, getDoc, collectionGroup, orderBy, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { useMemberVerification } from '../hooks/useMemberVerification';
import { useAuth } from '../hooks/useAuth'; // Use global Auth
import { functions } from '../firebase';
import { getRootCookie } from '../utils/cookie';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { Calendar, FileText, QrCode, Award, Download, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { ABSTRACT_STATUS, getAbstractStatusLabel } from '@/constants/abstract';

// HELPER: Force String (Prevent Object Crash)
const forceString = (val: any): string => {
    try {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'object') {
            if (val.ko) return forceString(val.ko);
            if (val.en) return forceString(val.en);
            if (val.name) return forceString(val.name);
            return '';
        }
        return String(val);
    } catch { return ''; }
};

interface UserReg {
    id: string;
    conferenceName: string;
    societyName: string;
    earnedPoints?: number;
    slug: string;
    societyId: string;
    location: string;
    dates: string;
}

// [Step 512-Des] Visual Gratification: CountUp Animation
const AnimatedCounter = ({ value }: { value: number }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        const duration = 800; // 0.8s smooth transition
        const startValue = 0; // Animate from 0 for impact

        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            // Ease-out cubic function for premium feel
            const easeOut = 1 - Math.pow(1 - progress, 3);

            setCount(Math.floor(easeOut * (value - startValue) + startValue));

            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        window.requestAnimationFrame(step);
    }, [value]);

    return <span>{count.toLocaleString()}</span>;
};

const UserHubPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // [Fix-Step 350] Use Global Auth Context for Real-time Updates
    const { auth } = useAuth('');
    const { user, loading: authLoading } = auth;

    const [loading, setLoading] = useState(true);
    // [Step 512-Des] Data Highway Feedback
    const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'disconnected'>('syncing');
    const [activeTab, setActiveTab] = useState<'EVENTS' | 'CERTS' | 'PROFILE' | 'ABSTRACTS'>('EVENTS');

    // Data
    const [regs, setRegs] = useState<UserReg[]>([]);
    const [abstracts, setAbstracts] = useState<any[]>([]);
    const [indexingError, setIndexingError] = useState(false);
    const retryCount = useRef(0);
    const healingAttempted = useRef<{ [key: string]: boolean }>({});

    useEffect(() => {
        if (indexingError && retryCount.current < 3) {
            const timer = setTimeout(() => {
                retryCount.current++;
                console.log(`[Retry] Indexing error detected. Retrying... (${retryCount.current}/3)`);
                fetchUserData(user); // 데이터 다시 불러오기 함수
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [indexingError, user]);

    const [totalPoints, setTotalPoints] = useState(0);
    const [societies, setSocieties] = useState<any[]>([]);

    // Profile (Locked by default)
    const [profile, setProfile] = useState({ displayName: '', phoneNumber: '', affiliation: '', licenseNumber: '', email: '' });

    // Modal State
    const [showCertModal, setShowCertModal] = useState(false);
    const [verifyForm, setVerifyForm] = useState({ societyId: "", name: "", code: "" });
    const [isSocLocked, setIsSocLocked] = useState(false);
    // [Fix-Step 263] Use Hook
    const { verifyMember, loading: verifyLoading } = useMemberVerification();

    // ZOMBIE KILLER: Force refresh when navigating back from history
    useEffect(() => {
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                window.location.reload();
            }
        };
        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, []);

    // [Fix-Step 350] Auth Sync
    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                // FORCE CLEAN REDIRECT IF NO SESSION
                window.location.href = `/auth?mode=login&returnUrl=${encodeURIComponent(window.location.pathname)}`;
                return;
            }
            // User exists
            setVerifyForm(prev => ({ ...prev, name: forceString(user.name || (user as any).displayName) }));
            fetchUserData(user);

            // [Self-Healing] Check if expiry is missing for verified affiliations
            if (user.affiliations) {
                Object.entries(user.affiliations).forEach(async ([socId, aff]: [string, any]) => {
                    // [Step 393-D] Zero Tolerance Check: expiry OR expiryDate MUST exist
                    const hasExpiry = aff.expiry !== undefined || aff.expiryDate !== undefined;

                    if (aff.verified && !hasExpiry) {
                        // [Fix-Step 395-D] Prevent Infinite Loop (Max 1 attempt per session per society)
                        if (healingAttempted.current[socId]) {
                            // console.warn(`[Self-Healing] Skipping ${socId} - Already attempted in this session.`);
                            return;
                        }
                        healingAttempted.current[socId] = true;

                        // console.log(`[Self-Healing] Missing expiry/expiryDate for ${socId}. Triggering repairData...`);

                        // Repair Logic
                        try {
                            if (aff.licenseNumber) {
                                // verifyMember will now save BOTH fields due to previous hook update
                                const res = await verifyMember(
                                    socId,
                                    user.name || (user as any).displayName,
                                    aff.licenseNumber,
                                    true,
                                    "",
                                    undefined,
                                    undefined,
                                    undefined,
                                    true // lockNow
                                );

                                if (res.success) {
                                    console.log(`[Self-Healing] REPAIRED ${socId}. Expiry synced.`);
                                } else {
                                    console.warn(`[Self-Healing] Repair Failed for ${socId}: ${res.message}`);
                                }
                            }
                        } catch (e) {
                            console.error(`[Self-Healing] Error for ${socId}:`, e);
                        }
                    }
                });
            }
        }
    }, [user, authLoading]);

    // [Step 402] Real-time validation trigger
    useEffect(() => {
        if (user && !authLoading) {
            validateCurrentAffiliation(user);
        }
    }, [user, authLoading]);

    const validateCurrentAffiliation = async (u: any) => {
        if (!u.affiliations) return;
        const db = getFirestore();

        for (const [socId, aff] of Object.entries(u.affiliations)) {
            const castAff = aff as any;
            if (castAff.verified) {
                try {
                    const codeToUse = castAff.licenseNumber || castAff.code || castAff.memberId;
                    if (!codeToUse) continue;

                    const verifyFn = httpsCallable(functions, 'verifyMemberIdentity');
                    // We use the cloud function to check if the member still exists and is valid
                    const { data }: any = await verifyFn({
                        societyId: socId,
                        name: u.name || u.displayName || u.userName,
                        code: codeToUse,
                        lockNow: false
                    });

                    if (!data.success) {
                        console.warn(`[Validation] Affiliation ${socId} invalid: ${data.message}. Revoking...`);
                        await updateDoc(doc(db, 'users', u.uid), {
                            [`affiliations.${socId}.verified`]: false,
                            [`affiliations.${socId}.revokedAt`]: serverTimestamp(),
                            [`affiliations.${socId}.revokedReason`]: data.message
                        });
                        toast.error(`[${socId}] Member verification revoked: ${data.message}`);
                    }
                } catch (e) {
                    console.error(`[Validation] Error checking ${socId}:`, e);
                }
            }
        }
    };

    // [Step 401-D] Activate Real-time Affiliation Validation
    useEffect(() => {
        if (user && !authLoading) {
            validateCurrentAffiliation(user);
        }
    }, [user, authLoading]);

    // [Step 512-D] Real-time Data Highway (Self-Healing)
    useEffect(() => {
        if (!user) return;

        let unsubscribe: (() => void) | undefined;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;

        const setupRealtimeListener = () => {
            const db = getFirestore();
            const qReg = query(collection(db, 'registrations'), where('userId', '==', user.uid));
            
            setSyncStatus('syncing');

            unsubscribe = onSnapshot(qReg, async (snapshot: any) => {
                // Success Handler
                try {
                    let fallbackAff = '';
                    const regPromises = snapshot.docs.map(async (docSnap: any) => {
                        const data = docSnap.data();
                        if (data.userAffiliation) fallbackAff = data.userAffiliation;

                        let realTitle = forceString(data.conferenceName || data.slug);
                        let socName = forceString(data.societyName);
                        let loc = "장소 정보 없음";
                        let dates = "";

                        // JOIN 1: Conference Details
                        try {
                            const confQ = query(collection(db, 'conferences'), where('slug', '==', data.slug));
                            const confSnap = await getDocs(confQ);
                            if (!confSnap.empty) {
                                const cData = confSnap.docs[0].data();
                                realTitle = forceString(cData.title);
                                loc = forceString(cData.location || cData.venue);
                                const s = forceString(cData.startDate);
                                const e = forceString(cData.endDate);
                                dates = s === e ? s : `${s} ~ ${e}`;
                            }
                        } catch { }

                        // JOIN 2: Society Name (If missing)
                        if (!socName || socName === 'Unknown') {
                            try {
                                const socDoc = await getDoc(doc(db, 'societies', data.societyId));
                                if (socDoc.exists()) socName = forceString(socDoc.data().name);
                            } catch { }
                        }

                        return {
                            id: docSnap.id,
                            conferenceName: realTitle,
                            societyName: socName,
                            earnedPoints: Number(data.earnedPoints || 0),
                            slug: forceString(data.slug),
                            societyId: forceString(data.societyId || 'kadd'),
                            location: loc,
                            dates: dates
                        };
                    });
                    
                    const loadedRegs = await Promise.all(regPromises);
                    setRegs(loadedRegs);
                    setTotalPoints(loadedRegs.reduce((acc, r) => acc + r.earnedPoints!, 0));
                    
                    setSyncStatus('connected');
                } catch (processError) {
                    console.error("Data Processing Error:", processError);
                    setSyncStatus('disconnected');
                }
            }, (error: any) => {
                // Error Handler (Self-Healing)
                console.error("Snapshot Listener Error:", error);
                setSyncStatus('disconnected');
                toast.error("실시간 연결이 끊어졌습니다. 3초 후 재연결을 시도합니다.");

                // Auto-Retry after 3s
                if (retryTimer) clearTimeout(retryTimer);
                retryTimer = setTimeout(() => {
                    console.log("[Self-Healing] Attempting to reconnect...");
                    setupRealtimeListener();
                }, 3000);
            });
        };

        setupRealtimeListener();

        return () => {
            if (unsubscribe) unsubscribe();
            if (retryTimer) clearTimeout(retryTimer);
        };
    }, [user]);

    const fetchUserData = async (u: any) => {
        console.log("fetchUserData called with:", u);
        const db = getFirestore();
        setLoading(true);
        // setSyncStatus('syncing'); // Handled by realtime listener now

        // 1. Profile (Safe Fallback)
        const d = u;

        // 2. Registrations (Isolated Try-Catch)
        // [Step 512-D] Moved to Real-time Listener above
        /* 
        let loadedRegs: UserReg[] = [];
        try {
            const qReg = query(collection(db, 'registrations'), where('userId', '==', u.uid));
            const snapReg = await getDocs(qReg);
            ...
        } catch (regErr) {
            console.error("Registrations Fetch Error:", regErr);
        }
        */

        // Set Profile with Fallback (relies on data from regs sometimes - simplified here)
        // Since regs are now async, we might not have fallbackAff immediately. 
        // We'll trust user object or just use empty string for now.
        setProfile({
            displayName: forceString(d.userName || d.name || u.displayName),
            phoneNumber: forceString(d.phoneNumber || d.phone),
            affiliation: forceString(d.affiliation || d.org), 
            licenseNumber: forceString(d.licenseNumber || d.licenseId),
            email: forceString(u.email)
        });

        // 3. Socs (for Modal) - Independent
        try {
            const snapSoc = await getDocs(collection(db, 'societies'));
            setSocieties(snapSoc.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (socErr) {
            console.error("Societies Fetch Error:", socErr);
        }

        // 4. Abstracts (Collection Group Query) - Independent
        try {
            // [Fix-Step 377] Fetch Abstracts across all conferences
            const qAbs = query(
                collectionGroup(db, 'submissions'),
                where('userId', '==', u.uid),
                orderBy('submittedAt', 'desc')
            );
            const snapAbs = await getDocs(qAbs);
            const absList = snapAbs.docs.map(d => {
                // Extract Conference ID from path: conferences/{confId}/submissions/{docId}
                const pathSegments = d.ref.path.split('/');
                const confId = pathSegments[1];
                return {
                    id: d.id,
                    confId,
                    ...d.data()
                };
            });
            console.log("Abstracts Data:", absList);
            setAbstracts(absList);
        } catch (absErr: any) {
            console.error("Abstracts Fetch Error:", absErr);
            // 인덱스 에러 대응
            if (absErr.code === 'failed-precondition') {
                setIndexingError(true);
                console.error("🔥 [INDEX REQUIRED] You must create an index for this query in Firebase Console.");
                console.error(`🔗 Link: ${absErr.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0] || 'Check console logs'}`);
            }
        }

        setLoading(false);
        // setSyncStatus('connected'); // Handled by realtime listener
    };

    const handleEventClick = (r: UserReg) => {
        const currentHost = window.location.hostname;
        const targetHost = `${r.societyId}.eregi.co.kr`;
        // [Step 403-D] Redirect to main mypage (not conference-specific mypage)
        const cleanPath = `/mypage`;

        if (currentHost === targetHost || currentHost.includes('localhost')) {
            navigate(cleanPath);
        } else {
            // CLEAN AUTH URL - NO SLUG
            // [Step 403-D] Pass token via URL for bulletproof session bridge
            const token = getRootCookie('eregi_session');
            const authUrl = `https://${targetHost}/auth?mode=login&returnUrl=${encodeURIComponent(cleanPath)}${token ? `&token=${token}` : ''}`;
            window.location.href = authUrl;
        }
    };

    // [Step 403-D] Dashboard Quick Action: QR Badge
    const handleQrClick = (e: React.MouseEvent, r: UserReg) => {
        e.stopPropagation(); // Prevent card click
        const currentHost = window.location.hostname;
        const targetHost = `${r.societyId}.eregi.co.kr`;
        const cleanPath = `/${r.slug}/badge`;

        if (currentHost === targetHost || currentHost.includes('localhost')) {
            navigate(cleanPath);
        } else {
            const token = getRootCookie('eregi_session');
            const authUrl = `https://${targetHost}/auth?mode=login&returnUrl=${encodeURIComponent(cleanPath)}${token ? `&token=${token}` : ''}`;
            window.location.href = authUrl;
        }
    };

    const handleLogout = async () => {
        await signOut(getAuth());
        window.location.href = '/'; // Force refresh
    };

    const handleOpenModal = () => {
        const hostname = window.location.hostname;
        const isMain = hostname === 'eregi.co.kr' || hostname.startsWith('www') || hostname.includes('firebaseapp') || hostname.includes('localhost');
        if (isMain) {
            setIsSocLocked(false);
            setVerifyForm(prev => ({ ...prev, societyId: "" }));
        } else {
            const sub = hostname.split('.')[0];
            setIsSocLocked(true);
            setVerifyForm(prev => ({ ...prev, societyId: sub }));
        }
        setShowCertModal(true);
    };

    // [Fix-Step 256] Force Atomic Locking & Admin Sync
    const handleVerify = async () => {
        // [Fix-Step 263] Unified Verification Hook
        const { societyId, name, code } = verifyForm;

        // Pass empty string for targetGradeId as we are just verifying membership here
        // [Fix-Step 357] Request Immediate Lock (lockNow: true)
        const res = await verifyMember(societyId, name, code, true, "", undefined, undefined, undefined, true);

        if (res.success) {
            // [Fix-Step 350] Removed Legacy Cert Doc Creation. 
            // AuthContext onSnapshot will auto-update the UI via affiliations.
            alert("인증되었습니다.");
            setShowCertModal(false);
            // No need to call fetchUserData explicitly as onSnapshot handles it.
        } else {
            alert(res.message);
        }
    };

    // [Step 404] Seamless Loading: Removed blocking loader for Skeleton UI
    // if (loading) return <LoadingSpinner />;

    const hostname = window.location.hostname;
    const isMain = hostname === 'eregi.co.kr' || hostname.startsWith('www') || hostname.includes('firebaseapp') || hostname.includes('localhost');
    const pageTitle = isMain ? "통합 마이페이지" : `[${hostname.split('.')[0]}] 마이페이지`;

    // [Fix-Step 357] Date Helper
    const formatDate = (date: any) => {
        if (!date) return '-';
        if (date.toDate) return date.toDate().toLocaleDateString(); // Firestore Timestamp 
        if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString(); // JSON 
        return date; // String 
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="max-w-4xl mx-auto">
                {/* HEADER */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold">{pageTitle}</h1>
                    <div className="flex items-center gap-4">
                        {/* [Step 512-Des] Sync Status Indicator */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-gray-100 shadow-sm">
                            <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${syncStatus === 'connected' ? 'bg-green-500' :
                                    syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' :
                                        'bg-orange-500'
                                }`} />
                            <span className="text-[10px] font-mono font-medium text-gray-400 uppercase tracking-wider">
                                {syncStatus === 'connected' ? 'Data Live' :
                                    syncStatus === 'syncing' ? 'Syncing...' : 'Offline'}
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <p className="text-sm text-gray-500 hidden sm:block">{user?.email || 'Guest User'}</p>
                            <button onClick={handleLogout} className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">로그아웃</button>
                        </div>
                    </div>
                </div>

                {/* [Fix-Step 343] Guest Warning Banner */}
                {(user as any)?.isAnonymous && (
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r">
                        <div className="flex">
                            <div className="ml-3">
                                <p className="text-sm text-amber-700 font-bold">
                                    ⚠️ 현재 비회원(Guest) 상태입니다.
                                </p>
                                <p className="text-xs text-amber-600 mt-1">
                                    이 브라우저에서만 접수 내역을 확인할 수 있습니다. 안전한 관리를 위해 정회원 전환을 권장합니다.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* INFO WIDGET GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {/* 1. Conferences Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-3 translate-y-3 group-hover:scale-110 transition-transform">
                            <Calendar className="w-24 h-24" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-sm font-semibold text-gray-500">My Conferences</p>
                            {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <h3 className="text-3xl font-black text-gray-900 mt-1">{regs.length}</h3>}
                        </div>
                        <div className="w-12 h-12 bg-blue-50 text-[#003366] rounded-full flex items-center justify-center relative z-10">
                            <Calendar className="w-6 h-6" />
                        </div>
                    </div>

                    {/* 2. Abstract Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-3 translate-y-3 group-hover:scale-110 transition-transform">
                            <FileText className="w-24 h-24" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-sm font-semibold text-gray-500">Submitted Abstracts</p>
                            {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <h3 className="text-3xl font-black text-gray-900 mt-1">{abstracts.length}</h3>}
                        </div>
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center relative z-10">
                            <FileText className="w-6 h-6" />
                        </div>
                    </div>

                    {/* 3. Points Card */}
                    <div className="bg-[#003366] p-6 rounded-xl shadow-lg border border-blue-900 flex items-center justify-between text-white relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full group-hover:scale-110 transition-transform"></div>
                        <div className="relative z-10">
                            <p className="text-sm font-medium text-blue-200">Total Points</p>
                            {loading ? <Skeleton className="h-8 w-24 mt-1 bg-white/20" /> : <h3 className="text-3xl font-black text-white mt-1"><AnimatedCounter value={totalPoints} /> <span className="text-lg font-normal text-blue-200">pts</span></h3>}
                        </div>
                        <div className="w-12 h-12 bg-white/20 text-white rounded-full flex items-center justify-center relative z-10 backdrop-blur-sm">
                            <Award className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex gap-4 border-b mb-6 overflow-x-auto no-scrollbar flex-nowrap min-w-0">
                    <button onClick={() => setActiveTab('EVENTS')} className={`pb-2 px-2 whitespace-nowrap transition-colors ${activeTab === 'EVENTS' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>등록학회</button>
                    <button onClick={() => setActiveTab('ABSTRACTS')} className={`pb-2 px-2 whitespace-nowrap transition-colors ${activeTab === 'ABSTRACTS' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>초록 내역</button>
                    {!(user as any)?.isAnonymous && (
                        <>
                            <button onClick={() => setActiveTab('CERTS')} className={`pb-2 px-2 whitespace-nowrap transition-colors ${activeTab === 'CERTS' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>학회 인증</button>
                            <button onClick={() => setActiveTab('PROFILE')} className={`pb-2 px-2 whitespace-nowrap transition-colors ${activeTab === 'PROFILE' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>내 정보</button>
                        </>
                    )}
                </div>

                {/* 1. EVENTS (FIXED LINKS & TITLES) */}
                {activeTab === 'EVENTS' && (
                    <div className="space-y-4">
                        {loading && (
                            <>
                                {[1, 2].map((i) => (
                                    <div key={i} className="bg-white p-5 rounded-xl shadow-sm border flex flex-col gap-3">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-6 w-3/4" />
                                        <div className="flex gap-2">
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-4 w-32" />
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                        {!loading && regs.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-xl border-2 border-dashed border-gray-200 text-center">
                                <div className="w-20 h-20 bg-blue-50 text-blue-200 rounded-full flex items-center justify-center mb-6">
                                    <Calendar className="w-10 h-10 text-blue-400" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">등록된 학회가 없습니다</h3>
                                <p className="text-gray-500 max-w-sm mb-8">
                                    현재 참여 중인 학술대회 내역이 없습니다.<br />
                                    진행 중인 학술대회를 찾아 등록해보세요.
                                </p>
                                <Button
                                    onClick={() => window.location.href = '/'}
                                    className="px-8 py-6 text-base font-bold bg-[#003366] hover:bg-[#002244] text-white shadow-lg shadow-blue-900/10"
                                >
                                    지금 학회 등록하기
                                </Button>
                            </div>
                        )}
                        {regs.map(r => (
                            <div key={r.id} onClick={() => handleEventClick(r)} className="bg-white p-5 rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex flex-col">
                                    <div className="flex items-center text-sm text-blue-600 font-bold mb-1">
                                        <span>[{r.societyName}]</span>
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-lg mb-2">{r.conferenceName}</h3>
                                    <div className="text-sm text-gray-500 flex flex-wrap gap-2">
                                        <span>📅 {r.dates}</span>
                                        <span>📍 {r.location}</span>
                                    </div>
                                </div>
                                <div className="mt-4 border-t pt-4 flex items-center justify-between">
                                    <span className={r.earnedPoints ? "bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold" : "bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs"}>
                                        {r.earnedPoints ? `+${r.earnedPoints} pts` : '진행중'}
                                    </span>
                                    <Button
                                        size="sm"
                                        onClick={(e) => handleQrClick(e, r)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                                    >
                                        <QrCode size={14} /> 등록 확인증 (QR)
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 2. CERTS (Affiliations) */}
                {activeTab === 'CERTS' && (
                    <div className="space-y-4">
                        {loading && (
                            <>
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100 flex justify-between items-center">
                                    <div className="flex items-center gap-4 w-full">
                                        <Skeleton className="w-10 h-10 rounded-full" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-5 w-1/3" />
                                            <Skeleton className="h-4 w-1/2" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        {/* Render from Affiliations */}
                        {!loading && user?.affiliations && Object.entries(user.affiliations).map(([socId, aff]: [string, any]) => {
                            if (!aff.verified) return null;
                            const soc = societies.find(s => s.id === socId);

                            return (
                                <div key={socId} className="bg-white p-5 rounded-xl shadow-sm border border-blue-100 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">✓</div>
                                        <div>
                                            <h4 className="font-bold text-gray-900">{forceString(soc?.name || socId)}</h4>
                                            <p className="text-sm text-gray-500">
                                                {forceString(user.name)} | {forceString(aff.licenseNumber || aff.memberId)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded text-xs font-bold block mb-1">
                                            {forceString(aff.grade || '정회원')}
                                        </span>
                                        {/* Expiry First & Highlighted */}
                                        <span className="text-red-600 font-bold text-xs block mb-1">
                                            {(() => {
                                                const rawExpiry = aff.expiryDate || aff.expiry;
                                                return `유효기간: ${rawExpiry ? formatDate(rawExpiry) : '무기한/정보없음'}`;
                                            })()}
                                        </span>
                                        <span className="text-gray-400 text-xs block">
                                            인증일: {aff.verifiedAt ? formatDate(aff.verifiedAt) : <span className="text-gray-400">이전 데이터(확인 필요)</span>}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        <button onClick={handleOpenModal} className="w-full py-4 bg-white border-2 border-dashed border-blue-300 text-blue-600 rounded-xl font-bold hover:bg-blue-50">
                            + 학회 정회원 인증 추가하기
                        </button>
                    </div>
                )}

                {/* 3. ABSTRACTS */}
                {activeTab === 'ABSTRACTS' && (
                    <div className="space-y-4">
                        {loading && (
                            <>
                                {[1, 2].map((i) => (
                                    <div key={i} className="bg-white p-5 rounded-xl shadow-sm border flex flex-col gap-3">
                                        <div className="flex justify-between">
                                            <Skeleton className="h-4 w-20" />
                                            <Skeleton className="h-5 w-16 rounded-full" />
                                        </div>
                                        <Skeleton className="h-6 w-3/4" />
                                        <Skeleton className="h-4 w-1/2" />
                                    </div>
                                ))}
                            </>
                        )}
                        {indexingError && (
                            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-xl">
                                <div className="flex">
                                    <div className="ml-3">
                                        <p className="text-sm font-bold text-amber-800">⚠️ 초록 데이터 인덱싱 중</p>
                                        <p className="text-xs text-amber-700 mt-1">
                                            Firestore 인덱스가 아직 준비되지 않았습니다. 5초 간격으로 자동 재시도합니다.
                                        </p>
                                        <a
                                            href="https://console.firebase.google.com/project/eregi-8fc1e/database/firestore/indexes"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-blue-600 underline mt-2 block font-medium"
                                        >
                                            관리자: Firebase Console에서 인덱스 상태 확인하기 →
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                        {!loading && abstracts.length === 0 && !indexingError && (
                            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-xl border-2 border-dashed border-gray-200 text-center">
                                <div className="w-20 h-20 bg-blue-50 text-blue-200 rounded-full flex items-center justify-center mb-6">
                                    <FileText className="w-10 h-10 text-blue-400" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">제출된 초록이 없습니다</h3>
                                <p className="text-gray-500 max-w-sm mb-8">
                                    아직 제출된 초록이 없습니다.<br />
                                    현재 접수 중인 학술대회를 확인해보세요.
                                </p>
                                <Button
                                    onClick={() => setActiveTab('EVENTS')}
                                    variant="outline"
                                    className="px-8 py-6 text-base font-bold border-2 border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200"
                                >
                                    등록된 학회 보기
                                </Button>
                            </div>
                        )}
                        {abstracts.map(abs => (
                            <div key={abs.id} className="bg-white p-5 rounded-xl shadow-sm border hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col">
                                        <div className="text-xs font-bold text-blue-600 mb-1">
                                            [{abs.confId?.toUpperCase() || 'UNKNOWN'}]
                                        </div>
                                        <h3 className="font-bold text-gray-900 text-lg">
                                            {abs.title?.ko || abs.title?.en || 'Untitled'}
                                        </h3>
                                    </div>
                                    <span className={`px-3 py-1 rounded-md text-xs font-bold shadow-sm border ${abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_ORAL
                                        ? 'bg-green-100 text-green-800 border-green-200'
                                        : abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_POSTER
                                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                                            : abs.reviewStatus === ABSTRACT_STATUS.REJECTED
                                                ? 'bg-red-50 text-red-600 border-red-200'
                                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                        }`}>
                                        {abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_ORAL ? 'Oral Accepted' :
                                            abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_POSTER ? 'Poster Accepted' :
                                                abs.reviewStatus === ABSTRACT_STATUS.REJECTED ? 'Rejected' : 'Under Review'}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-500 flex flex-col gap-1 mt-2">
                                    <p>제출일: {formatDate(abs.submittedAt || abs.createdAt)}</p>
                                    <p>저자: {abs.authors?.map((a: any) => a.name).join(', ') || '-'}</p>

                                    {/* [Step 405-D] Edit/Withdraw Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-2 mt-4 w-full sm:w-auto">
                                        {/* Edit Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // [Fix-Step 410-D] Correct Edit URL with proper query string
                                                const currentHost = window.location.hostname;
                                                const targetHost = `${abs.confId}.eregi.co.kr`;
                                                const token = getRootCookie('eregi_session');

                                                // If we are on the same domain or localhost, use React Router if possible, 
                                                // but since we need to switch subdomains potentially, full redirect is safer for multi-tenant.
                                                // However, user specifically asked for `/${slug}/abstracts?mode=edit&id=${abs.id}` format.
                                                // Let's assume we stay on the current domain if it matches, or redirect if not.

                                                if (currentHost === targetHost || currentHost.includes('localhost') || currentHost === 'eregi.co.kr') {
                                                    // Use the slug-based route we just confirmed in App.tsx: /:slug/abstracts
                                                    navigate(`/${abs.confId}/abstracts?mode=edit&id=${abs.id}`);
                                                } else {
                                                    // Cross-domain redirect
                                                    const authUrl = `https://${targetHost}/${abs.confId}/abstracts?mode=edit&id=${abs.id}${token ? `&token=${token}` : ''}`;
                                                    window.location.href = authUrl;
                                                }
                                            }}
                                            className="w-full sm:w-auto text-xs bg-blue-50 text-blue-600 px-3 py-2 sm:py-1.5 rounded hover:bg-blue-100 font-bold border border-blue-200"
                                        >
                                            수정하기
                                        </button>

                                        {/* Withdraw Button */}
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (!confirm("정말 철회하시겠습니까? 철회 후에는 복구할 수 없습니다.")) return;

                                                try {
                                                    const db = getFirestore();
                                                    // 1. Delete Firestore Doc
                                                    await deleteDoc(doc(db, `conferences/${abs.confId}/submissions/${abs.id}`));

                                                    // 2. Update Local State
                                                    setAbstracts(prev => prev.filter(p => p.id !== abs.id));
                                                    toast.success("초록이 철회되었습니다.");
                                                } catch (err) {
                                                    console.error("Withdraw failed:", err);
                                                    toast.error("철회 실패: 관리자에게 문의하세요.");
                                                }
                                            }}
                                            className="w-full sm:w-auto text-xs bg-red-50 text-red-600 px-3 py-2 sm:py-1.5 rounded hover:bg-red-100 font-bold border border-red-200"
                                        >
                                            제출 철회
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 4. PROFILE (LOCKED READ-ONLY) */}
                {activeTab === 'PROFILE' && (
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-lg mb-6">내 정보 확인</h3>
                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i}>
                                        <Skeleton className="h-4 w-20 mb-1" />
                                        <Skeleton className="h-12 w-full rounded-lg" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-red-500 mb-4 bg-red-50 p-2 rounded">※ 정보 수정은 인증 후 가능합니다 (현재 읽기 전용)</p>
                                <div className="space-y-4 opacity-70">
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">이름</label><input type="text" className="w-full border p-3 rounded-lg bg-gray-100" value={profile.displayName} disabled /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label><input type="text" className="w-full border p-3 rounded-lg bg-gray-100" value={profile.phoneNumber} disabled /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">소속</label><input type="text" className="w-full border p-3 rounded-lg bg-gray-100" value={profile.affiliation} disabled /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">면허번호</label><input type="text" className="w-full border p-3 rounded-lg bg-gray-100" value={profile.licenseNumber} disabled /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">이메일</label><input type="text" className="w-full border p-3 rounded-lg bg-gray-100" value={profile.email} disabled /></div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL (Force Render Logic) */}
            {showCertModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full relative">
                        <h3 className="text-xl font-bold mb-2 text-gray-900">학회 정회원 인증</h3>
                        <p className="text-xs text-center text-blue-500 mb-6 font-bold bg-blue-50 p-1 rounded">{isSocLocked ? `[${verifyForm.societyId}] 학회 전용 모드` : '통합 모드 (학회 선택 가능)'}</p>
                        {/* Form Fields */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">학회 선택</label>
                                <select className={`w-full border p-3 rounded-lg ${isSocLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}`} value={verifyForm.societyId} onChange={(e) => setVerifyForm({ ...verifyForm, societyId: e.target.value })} disabled={isSocLocked}>
                                    <option value="">선택해주세요</option>
                                    {societies.map(s => <option key={s.id} value={s.id}>{forceString(s.name) || s.id}</option>)}
                                </select>
                            </div>
                            <div><label className="block text-sm font-medium mb-1">이름</label><input type="text" className="w-full border p-3 rounded-lg" value={verifyForm.name} onChange={(e) => setVerifyForm({ ...verifyForm, name: e.target.value })} /></div>
                            <div><label className="block text-sm font-medium mb-1">인증 코드</label><input type="text" className="w-full border p-3 rounded-lg" value={verifyForm.code} onChange={(e) => setVerifyForm({ ...verifyForm, code: e.target.value })} /></div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowCertModal(false)} className="px-5 py-3 text-gray-500 hover:bg-gray-100 rounded-lg font-bold">취소</button>
                            <button
                                onClick={handleVerify}
                                className="px-5 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center min-w-[100px]"
                                disabled={verifyLoading}
                            >
                                {verifyLoading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : '인증 받기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default UserHubPage;
