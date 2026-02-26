import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // RAW SDK
import { getFirestore, collection, query, where, onSnapshot, orderBy, type Query, getDocs } from 'firebase/firestore'; // RAW SDK
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { SESSION_KEYS } from '../utils/cookie';
import { RefreshCw, CheckCircle, Loader2, Clock, FileText, Calendar, Languages, Download, User, MapPin, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const StandAloneBadgePage: React.FC = () => {
    // BUGFIX-20250124: Fixed React error #130 by moving unsubscribeDB to outer scope
    const { slug } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState("INIT"); // INIT, LOADING, READY, NO_AUTH, NO_DATA, REDIRECTING
    const [ui, setUi] = useState<{ name: string, aff: string, id: string, issued: boolean, zone: string, time: string, license: string, status: string, badgeQr: string | null, receiptNumber?: string, sessionsCompleted?: number, sessionsTotal?: number, lastCheckIn?: any, baseMinutes?: number } | null>(null);
    const [zones, setZones] = useState<any[]>([]);
    const [liveMinutes, setLiveMinutes] = useState<number>(0);
    const [badgeConfig, setBadgeConfig] = useState<any>(null);
    const [msg, setMsg] = useState("초기화 중...");
    const [refreshing, setRefreshing] = useState(false);
    const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastQueryRef = useRef<Query | null>(null);

    // Helper to determine correct confId
    const getConfIdToUse = (slugVal: string | undefined): string => {
        if (!slugVal) return 'kadd_2026spring';

        if (slugVal.includes('_')) {
            return slugVal;
        } else {
            const hostname = window.location.hostname;
            const parts = hostname.split('.');
            let societyIdToUse = 'kadd';

            if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
                societyIdToUse = parts[0].toLowerCase();
            }

            return `${societyIdToUse}_${slugVal}`;
        }
    };

    useEffect(() => {
        const auth = getAuth();
        const db = getFirestore();

        let unsubscribeDB: (() => void) | null = null; // Track DB subscription in outer scope

        // 1. Listen for Firebase Auth FIRST (for regular members)
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            // Clean up previous DB listener if user changes
            if (unsubscribeDB) {
                unsubscribeDB();
                unsubscribeDB = null;
            }

            if (user) {
                // Firebase user authenticated - proceed to show badge
                setStatus("LOADING");
                setMsg("데이터 로드 중...");

                const confIdToUse = getConfIdToUse(slug);

                console.log('[StandAloneBadgePage] Firebase user authenticated, fetching badge:', { userId: user.uid, confId: confIdToUse });

                // STRATEGY: Try Regular Registrations FIRST, then External Attendees

                // 1. Define Queries
                const qReg = query(
                    collection(db, 'conferences', confIdToUse, 'registrations'),
                    where('userId', '==', user.uid),
                    where('paymentStatus', '==', 'PAID'),
                    orderBy('createdAt', 'desc')
                );

                const qExt = query(
                    collection(db, 'conferences', confIdToUse, 'external_attendees'),
                    where('userId', '==', user.uid),
                    where('paymentStatus', '==', 'PAID') // Admin created ones are PAID
                );

                // Fetch Zones for real-time break exclusion logic and Badge Config
                import('firebase/firestore').then(async ({ doc, getDoc }) => {
                    try {
                        const rulesRef = doc(db, `conferences/${confIdToUse}/settings/attendance`);
                        const configRef = doc(db, `conferences/${confIdToUse}/settings/badge_config`);

                        const [rulesSnap, configSnap] = await Promise.all([
                            getDoc(rulesRef),
                            getDoc(configRef)
                        ]);

                        if (rulesSnap.exists()) {
                            const allRules = rulesSnap.data().rules || {};
                            let allZones: any[] = [];
                            Object.entries(allRules).forEach(([dateStr, rule]: [string, any]) => {
                                if (rule && rule.zones) {
                                    rule.zones.forEach((z: any) => {
                                        allZones.push({ ...z, ruleDate: dateStr });
                                    });
                                }
                            });
                            setZones(allZones);
                        }

                        if (configSnap.exists()) {
                            setBadgeConfig(configSnap.data());
                        }
                    } catch (e) {
                        console.error('Failed to load rules and badge config', e);
                    }
                });

                // 2. Helper to process snapshot data
                const processSnapshot = (snap: import('firebase/firestore').QuerySnapshot, source: 'REGULAR' | 'EXTERNAL') => {
                    if (snap.empty) {
                        // This should only happen if the document was deleted after we found it
                        console.log(`[StandAloneBadgePage] ${source} registration disappeared`);
                        setStatus("NO_DATA");
                        setMsg("등록 정보가 없습니다.");
                        return;
                    }

                    const d = snap.docs[0].data();
                    console.log(`[StandAloneBadgePage] ${source} Registration found:`, d);

                    // Common Field Mapping
                    const uiName = String(d.userName || d.userInfo?.name || d.name || 'No Name'); // d.name for External
                    const uiAff = String(d.affiliation || d.userAffiliation || d.userInfo?.affiliation || d.organization || '-'); // d.organization for External
                    const uiId = String(snap.docs[0].id);
                    // CRITICAL LOGIC CHANGE: 
                    // For EXTERNAL attendees, badgeQr is pre-generated, so we MUST check badgeIssued flag.
                    // For REGULAR attendees, we maintain legacy check (badgeQr existence) but prioritize badgeIssued if available.
                    let uiIssued = false;
                    if (source === 'EXTERNAL') {
                        uiIssued = !!d.badgeIssued;
                    } else {
                        // Legacy support for regular registrations
                        uiIssued = !!d.badgeIssued || !!d.badgeQr;
                    }

                    // External might not have attendanceStatus, default to OUTSIDE
                    const uiZone = String(d.attendanceStatus === 'INSIDE' ? (d.currentZone || 'Inside') : 'OUTSIDE');
                    const uiTime = String(d.totalMinutes || '0');
                    const uiLicense = String(d.licenseNumber || d.userInfo?.licenseNumber || '-');
                    const uiStatus = String(d.attendanceStatus || 'OUTSIDE');
                    const uiBadgeQr = d.badgeQr || null;
                    const uiReceiptNumber = String(d.receiptNumber || '');
                    const uiSessionsCompleted = d.sessionsCompleted ? Number(d.sessionsCompleted) : undefined;
                    const uiSessionsTotal = d.sessionsTotal ? Number(d.sessionsTotal) : undefined;
                    const lastCheckIn = d.lastCheckIn;
                    const baseMinutes = Number(d.totalMinutes || 0);

                    setUi({
                        name: uiName,
                        aff: uiAff,
                        id: uiId,
                        issued: uiIssued,
                        zone: uiZone,
                        time: uiTime,
                        license: uiLicense,
                        status: uiStatus,
                        badgeQr: uiBadgeQr,
                        receiptNumber: uiReceiptNumber,
                        sessionsCompleted: uiSessionsCompleted,
                        sessionsTotal: uiSessionsTotal,
                        lastCheckIn,
                        baseMinutes
                    });
                    setLiveMinutes(baseMinutes); // Will be recalculated by the interval if inside
                    setStatus("READY");
                    setMsg("");
                };

                // 3. Execution
                try {
                    // Check Regular first
                    const snapReg = await getDocs(qReg);
                    if (!snapReg.empty) {
                        console.log('[StandAloneBadgePage] Found in REGISTRATIONS');
                        if (lastQueryRef) lastQueryRef.current = qReg;
                        unsubscribeDB = onSnapshot(qReg, (snap) => processSnapshot(snap, 'REGULAR'));
                    } else {
                        // Check External
                        const snapExt = await getDocs(qExt);
                        if (!snapExt.empty) {
                            console.log('[StandAloneBadgePage] Found in EXTERNAL_ATTENDEES');
                            if (lastQueryRef) lastQueryRef.current = qExt;
                            unsubscribeDB = onSnapshot(qExt, (snap) => processSnapshot(snap, 'EXTERNAL'));
                        } else {
                            // No data in either
                            console.log('[StandAloneBadgePage] No PAID registration found in either collection');
                            setStatus("NO_DATA");
                            setMsg("등록 정보가 없습니다.");
                        }
                    }
                } catch (err) {
                    console.error('[StandAloneBadgePage] Error fetching badge data:', err);
                    setStatus("NO_DATA");
                    setMsg("데이터 로드 중 오류가 발생했습니다.");
                }

            } else {
                // No Firebase user - check for non-member session
                const nonMemberSession = sessionStorage.getItem(SESSION_KEYS.NON_MEMBER);
                if (nonMemberSession) {
                    try {
                        const session = JSON.parse(nonMemberSession);
                        const currentConfId = session.cid;

                        // Verify session is for current conference
                        if (!slug) return;

                        const confIdToUse = getConfIdToUse(slug);

                        // Check if session is for different conference
                        if (currentConfId !== confIdToUse) {
                            console.log('[StandAloneBadgePage] Session for different conference, redirecting to check-status');
                            navigate(`/${slug}/check-status?lang=ko`, { replace: true });
                            return;
                        }

                        // For non-members, redirect to NonMemberHubPage which has QR code
                        console.log('[StandAloneBadgePage] Non-member detected, redirecting to hub', { registrationId: session.registrationId });
                        navigate(`/${slug}/non-member/hub`, { replace: true });
                        return;
                    } catch (err) {
                        console.error('[StandAloneBadgePage] Failed to parse non-member session:', err);
                    }
                } else {
                    setStatus("NO_AUTH");
                    setMsg("로그인이 필요합니다.");
                }
            }
        });

        return () => {
            if (unsubscribeDB) unsubscribeDB(); // Clean up DB subscription first
            if (unsubscribeAuth) unsubscribeAuth(); // Then clean up auth subscription
        };
    }, [slug, navigate]);

    // Auto-refresh when badge is NOT issued (voucher state)
    useEffect(() => {
        if (status === "READY" && ui && !ui.issued && lastQueryRef?.current) {
            // Poll every 2 seconds to check if badge has been issued
            // Faster polling for immediate switch after InfoDesk scan
            refreshIntervalRef.current = setInterval(() => {
                setRefreshing(true);
                // Re-query to get latest data
                onSnapshot(lastQueryRef.current!, (snap) => {
                    if (!snap.empty) {
                        const d = snap.docs[0].data();

                        // Apply same logic for refresh
                        let uiIssued = false;
                        // We need to know if it's EXTERNAL or REGULAR here too.
                        // However, we don't have 'source' variable in this effect.
                        // But we can infer it from the collection path in lastQueryRef, or check data structure.
                        // External attendees usually have 'organization' field, Regular have 'affiliation'.
                        // Or better, check if 'badgeIssued' is explicitly false but 'badgeQr' exists.

                        if (d.registrationType?.startsWith('MANUAL') || d.organization) {
                            uiIssued = !!d.badgeIssued;
                        } else {
                            uiIssued = !!d.badgeIssued || !!d.badgeQr;
                        }

                        if (uiIssued) {
                            // Badge has been issued - update UI
                            setUi((prev) => ({
                                ...prev!,
                                issued: true,
                                badgeQr: d.badgeQr || null,
                                status: String(d.attendanceStatus || 'OUTSIDE'),
                                zone: String(d.attendanceStatus === 'INSIDE' ? (d.currentZone || 'Inside') : 'OUTSIDE'),
                                time: String(d.totalMinutes || '0')
                            }));
                            setRefreshing(false);
                        }
                    }
                    setRefreshing(false);
                });
            }, 2000);

            return () => {
                if (refreshIntervalRef.current) {
                    clearInterval(refreshIntervalRef.current);
                    refreshIntervalRef.current = null;
                }
            };
        } else if (refreshIntervalRef.current) {
            // Clear interval if badge is issued
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
        }

        // ui object excluded to prevent excessive re-runs - only ui?.issued is needed
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, ui?.issued]);

    // Live Duration Ticker calculation
    useEffect(() => {
        if (!ui || status !== 'READY') return;

        const updateLiveMinutes = () => {
            if (ui.status !== 'INSIDE' || !ui.lastCheckIn) {
                setLiveMinutes(ui.baseMinutes || 0);
                return;
            }

            const now = new Date();
            const start = ui.lastCheckIn.toDate ? ui.lastCheckIn.toDate() : new Date();
            let durationMinutes = 0;
            const currentZoneId = ui.zone;
            const zoneRule = zones.find(z => z.id === currentZoneId);
            let deduction = 0;

            let boundedStart = start;
            let boundedEnd = now;

            if (zoneRule && zoneRule.start && zoneRule.end) {
                const localDateStr = zoneRule.ruleDate || start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, '0') + "-" + String(start.getDate()).padStart(2, '0');
                const sessionStart = new Date(`${localDateStr}T${zoneRule.start}:00`);
                const sessionEnd = new Date(`${localDateStr}T${zoneRule.end}:00`);

                boundedStart = new Date(Math.max(start.getTime(), sessionStart.getTime()));
                boundedEnd = new Date(Math.min(now.getTime(), sessionEnd.getTime()));
            }

            if (boundedEnd > boundedStart) {
                durationMinutes = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);

                if (zoneRule && zoneRule.breaks && Array.isArray(zoneRule.breaks)) {
                    zoneRule.breaks.forEach((brk: any) => {
                        const localDateStr = zoneRule.ruleDate || start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, '0') + "-" + String(start.getDate()).padStart(2, '0');
                        const breakStart = new Date(`${localDateStr}T${brk.start}:00`);
                        const breakEnd = new Date(`${localDateStr}T${brk.end}:00`);
                        const overlapStart = Math.max(boundedStart.getTime(), breakStart.getTime());
                        const overlapEnd = Math.min(boundedEnd.getTime(), breakEnd.getTime());
                        if (overlapEnd > overlapStart) {
                            const overlapMins = Math.floor((overlapEnd - overlapStart) / 60000);
                            deduction += overlapMins;
                        }
                    });
                }
            }

            const activeMinutes = Math.max(0, durationMinutes - deduction);
            setLiveMinutes((ui.baseMinutes || 0) + activeMinutes);
        };

        // Run immediately
        updateLiveMinutes();

        // Then run every 30 seconds
        const timer = setInterval(updateLiveMinutes, 30000);
        return () => clearInterval(timer);
    }, [ui, status, zones]);

    if (msg && status !== "READY") return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center font-sans">
            <div className="text-center">
                <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-4" />
                <p className="text-xl font-medium text-gray-600">{msg}</p>
            </div>
        </div>
    );
    if (!ui) return <div className="p-10 text-center flex items-center justify-center min-h-screen">데이터 로드 실패</div>;

    // Determine which QR to show
    const showBadgeQr = ui.issued; // Always show if issued
    // Fallback to generated ID if badgeQr is missing in DB but issued flag is true
    const qrValue = showBadgeQr ? (ui.badgeQr || `BADGE-${ui.id}`) : ui.id;
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

    console.log('[StandAloneBadgePage] QR Display Debug:', {
        issued: ui.issued,
        badgeQr: ui.badgeQr,
        showBadgeQr,
        qrValue,
        registrationId: ui.id
    });

    // VOUCHER STATE (not issued yet)
    if (!ui.issued) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex flex-col items-center justify-center p-4 font-sans">
                <div className="w-full max-w-sm">
                    {/* Temporary Voucher Card - Visually Distinct from Issued Badge */}
                    <div className="bg-white border-4 border-amber-300 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
                        {refreshing && (
                            <div className="absolute top-3 right-3 z-10">
                                <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
                            </div>
                        )}

                        {/* Pending Badge Indicator - Top Banner */}
                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-400 to-orange-400 py-2 px-4">
                            <div className="flex items-center justify-center gap-2 text-white">
                                <Clock className="w-4 h-4 animate-pulse" />
                                <span className="text-xs font-bold tracking-wide">BADGE PENDING</span>
                            </div>
                        </div>

                        {/* Watermark Background */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none mt-8">
                            <div className="text-8xl font-black text-gray-900 transform -rotate-12">TEMPORARY</div>
                        </div>

                        {/* Content Container - Relative to sit above watermark */}
                        <div className="relative z-10 mt-8">
                            {/* Header with Icon */}
                            <div className="mb-4">
                                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <FileText className="w-8 h-8 text-amber-600" />
                                </div>
                                <h1 className="text-xl font-black mb-1 tracking-wide text-amber-700">
                                    등록 확인 바우처
                                </h1>
                                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Registration Voucher</p>
                            </div>

                            {/* Warning Notice */}
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl py-2 px-3 mb-4">
                                <p className="text-xs font-bold text-amber-800">
                                    ⚠️ 현장 인포데스크에서 QR을 스캔하여<br />디지털 명찰을 발급받아야 합니다
                                </p>
                            </div>

                            {/* Organization */}
                            <p className="text-sm text-gray-600 font-medium mb-1">{ui.aff}</p>

                            {/* Name */}
                            <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">{ui.name}</h2>

                            {/* Receipt Number - Prominent */}
                            {ui.receiptNumber && (
                                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl py-3 px-4 mb-4 border border-amber-200">
                                    <p className="text-xs font-bold text-amber-600 uppercase mb-1">Receipt Number</p>
                                    <p className="text-xl font-black text-amber-700 tracking-wider">{ui.receiptNumber}</p>
                                </div>
                            )}

                            {/* License Number */}
                            {ui.license && ui.license !== '-' && (
                                <div className="bg-gray-50 rounded-lg py-2 px-3 mb-4">
                                    <p className="text-xs font-semibold text-gray-600">면허번호</p>
                                    <p className="text-sm font-bold text-gray-800">{ui.license}</p>
                                </div>
                            )}

                            {/* QR Code - The Main Element */}
                            <div className="bg-white p-3 inline-block rounded-2xl shadow-lg border-2 border-amber-200 mb-4">
                                <div className="text-xs font-semibold text-gray-500 mb-2">인포데스크 제시용 QR</div>
                                <QRCodeSVG
                                    key={qrValue}
                                    value={qrValue}
                                    size={160}
                                    level="M"
                                    includeMargin={false}
                                />
                            </div>

                            {/* Instruction */}
                            <div className="bg-amber-100 border border-amber-300 rounded-xl py-3 px-4">
                                <p className="text-sm font-bold text-amber-900 flex items-center justify-center gap-2">
                                    <User className="w-4 h-4" />
                                    현장 인포데스크에 QR 제시
                                </p>
                                <p className="text-xs text-amber-700 mt-1">디지털 명찰을 발급받으세요</p>
                            </div>
                        </div>
                    </div>

                    {/* Refresh Indicator */}
                    {refreshing && (
                        <div className="mt-4 text-center text-sm text-amber-700 font-medium flex items-center justify-center gap-2 bg-white/80 rounded-lg py-2 px-4">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            명찰 발급 상태 확인 중...
                        </div>
                    )}

                    {/* Home Button */}
                    <a
                        href={`https://${hostname}/${slug && slug.includes('_') ? slug.split('_')[1] : slug || ''}`}
                        className="block w-full mt-4 py-3 px-6 bg-white text-amber-700 font-bold rounded-xl hover:bg-amber-50 transition-colors text-center border-2 border-amber-200 shadow-md"
                    >
                        학술대회 홈페이지
                    </a>
                </div>
            </div>
        );
    }

    // ISSUED BADGE STATE
    return (
        <div className="min-h-[100dvh] bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 flex flex-col p-4 font-sans">
            <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center py-6">
                {/* Digital Badge Card - Professional Name Tag */}
                <div className="bg-white border-0 md:border-4 border-emerald-500 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col relative z-10 ring-1 ring-black/5">

                    {/* Issued Badge Header - Always Visible */}
                    <div className="bg-gradient-to-r from-emerald-600 to-green-500 py-3 px-4 shadow-sm">
                        <div className="flex items-center justify-center gap-2 text-white">
                            <CheckCircle className="w-5 h-5 drop-shadow-sm" />
                            <span className="text-sm font-bold tracking-wider drop-shadow-sm">DIGITAL BADGE ISSUED</span>
                        </div>
                    </div>

                    {/* Badge Info - Main Content */}
                    <div className="p-6 flex flex-col items-center text-center">
                        {/* Affiliation */}
                        <p className="text-sm text-gray-500 font-bold mb-2 break-keep leading-tight px-4 max-w-xs">{ui.aff || '-'}</p>

                        {/* Name */}
                        <h2 className="text-3xl font-black text-gray-900 mb-5 tracking-tight cursor-default">{ui.name}</h2>

                        {/* License Number Chip */}
                        {ui.license && ui.license !== '-' && (
                            <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full py-1.5 px-4 mb-6 inline-flex items-center shadow-sm">
                                <span className="text-xs font-bold tracking-wide">면허번호 : {ui.license}</span>
                            </div>
                        )}

                        {/* QR Code Container - Enhanced Visibility */}
                        <div className="bg-white p-4 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 mb-3 flex flex-col items-center justify-center">
                            {showBadgeQr && (
                                <QRCodeSVG
                                    key={qrValue}
                                    value={qrValue}
                                    size={180}
                                    level="H"
                                    includeMargin={true}
                                    className="rounded-lg"
                                />
                            )}
                            <div className="h-px w-full bg-gray-100 my-3"></div>
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Access Code</p>
                        </div>
                        <p className="text-xs font-medium text-emerald-600 animate-pulse">
                            입장/퇴장 시 위 QR코드를 스캔하세요
                        </p>
                    </div>

                    {/* Tabbed Interface - Compact & Clean */}
                    <div className="bg-gray-50/80 border-t border-gray-100 p-2">
                        <Tabs defaultValue="status" className="w-full">
                            <TabsList className="grid grid-cols-5 w-full h-auto p-1 bg-white border border-gray-200 shadow-sm rounded-xl">
                                <TabsTrigger value="status" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                                    <User className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">상태</span>
                                </TabsTrigger>
                                <TabsTrigger value="sessions" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                                    <TrendingUp className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">수강</span>
                                </TabsTrigger>
                                <TabsTrigger value="materials" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                                    <FileText className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">자료</span>
                                </TabsTrigger>
                                <TabsTrigger value="program" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                                    <Calendar className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">일정</span>
                                </TabsTrigger>
                                <TabsTrigger value="translation" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                                    <Languages className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">번역</span>
                                </TabsTrigger>
                            </TabsList>

                            {/* Status Tab */}
                            <TabsContent value="status" className="mt-2 p-1 space-y-2">
                                <div className={`py-4 px-4 rounded-2xl font-bold text-center border shadow-sm transition-all ${ui.status === 'INSIDE'
                                    ? 'bg-green-100 text-green-700 border-green-200 ring-4 ring-green-50'
                                    : 'bg-white text-gray-500 border-gray-200'
                                    }`}>
                                    <div className="flex items-center justify-center gap-2">
                                        {ui.status === 'INSIDE'
                                            ? <><span className="w-3 h-3 bg-green-500 rounded-full animate-ping" /><span>입장 완료 (INSIDE)</span></>
                                            : <><span className="w-3 h-3 bg-gray-300 rounded-full" /><span>퇴장 상태 (OUTSIDE)</span></>
                                        }
                                    </div>
                                </div>

                                {ui.zone && ui.zone !== 'OUTSIDE' && (
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl py-3 px-4 flex justify-between items-center">
                                        <p className="text-xs text-blue-600 font-bold">현재 위치</p>
                                        <p className="text-sm font-black text-blue-800 flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-blue-500" />
                                            {ui.zone}
                                        </p>
                                    </div>
                                )}

                                {liveMinutes > 0 && (
                                    <div className="bg-purple-50/50 border border-purple-100 rounded-xl py-3 px-4 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <p className="text-xs text-purple-600 font-bold">인정 수강 시간 (실시간)</p>
                                            {ui.status === 'INSIDE' && <p className="text-[10px] text-purple-400">현재 수강 시간 포함</p>}
                                        </div>
                                        <p className="text-sm font-black text-purple-800 flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-purple-500" />
                                            {Math.floor(liveMinutes / 60)}시간 {liveMinutes % 60}분
                                        </p>
                                    </div>
                                )}
                            </TabsContent>

                            {/* Sessions Tab */}
                            <TabsContent value="sessions" className="mt-2 p-1">
                                <div className="bg-white rounded-2xl py-6 px-4 border border-gray-100 shadow-sm text-center">
                                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <TrendingUp className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <p className="text-xs text-emerald-600 font-bold mb-1 uppercase tracking-wider">Session Progress</p>
                                    <p className="text-sm text-gray-500 font-medium mb-4">평점 이수 현황</p>

                                    <div className="flex items-baseline justify-center gap-1 mb-4">
                                        <span className="text-4xl font-black text-gray-900 tracking-tight">
                                            {ui.sessionsCompleted || 0}
                                        </span>
                                        <span className="text-xl text-gray-400 font-medium">/</span>
                                        <span className="text-xl font-bold text-gray-400">
                                            {ui.sessionsTotal || '-'}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (Number(ui.sessionsCompleted || 0) / Number(ui.sessionsTotal || 1)) * 100)}%` }}></div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Materials Tab */}
                            <TabsContent value="materials" className="mt-2 p-1 space-y-2">
                                {badgeConfig?.materialsUrls && badgeConfig.materialsUrls.length > 0 ? (
                                    badgeConfig.materialsUrls.map((mat: any, idx: number) => (
                                        <a
                                            key={idx}
                                            href={mat.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center p-4 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group"
                                        >
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                                                <Download className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-gray-900">{mat.name}</p>
                                                <p className="text-xs text-gray-500">자료실 이동</p>
                                            </div>
                                        </a>
                                    ))
                                ) : (
                                    <>
                                        <a
                                            href={`https://${hostname}/${slug}/materials`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center p-4 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group"
                                        >
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                                                <Download className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-gray-900">강의 자료실</p>
                                                <p className="text-xs text-gray-500">발표자료 다운로드</p>
                                            </div>
                                        </a>
                                        <a
                                            href={`https://${hostname}/${slug}/abstracts`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center p-4 bg-white hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-xl transition-all group"
                                        >
                                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-purple-200 transition-colors">
                                                <FileText className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-gray-900">초록집 (Abstract)</p>
                                                <p className="text-xs text-gray-500">학술대회 초록 모음</p>
                                            </div>
                                        </a>
                                    </>
                                )}
                            </TabsContent>

                            {/* Program Tab */}
                            <TabsContent value="program" className="mt-2 p-1">
                                <a
                                    href={`https://${hostname}/${slug}/program`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-2xl hover:border-amber-300 hover:bg-amber-50 transition-all text-center gap-3"
                                >
                                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                                        <Calendar className="w-8 h-8 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-gray-900">전체 프로그램 보기</p>
                                        <p className="text-sm text-gray-500">Google Calendar / App</p>
                                    </div>
                                </a>
                            </TabsContent>

                            {/* Translation Tab */}
                            <TabsContent value="translation" className="mt-2 p-1">
                                {badgeConfig?.translationUrl ? (
                                    <a href={badgeConfig.translationUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                                        <div className="bg-blue-50 rounded-2xl py-12 px-4 border border-blue-200 text-center hover:bg-blue-100 transition-colors cursor-pointer shadow-sm">
                                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
                                                <Languages className="w-8 h-8 relative z-10" />
                                                <span className="absolute inset-0 bg-blue-400 opacity-20 animate-ping rounded-full" />
                                            </div>
                                            <p className="text-sm text-blue-900 font-bold mb-1">실시간 번역 서비스 연결</p>
                                            <p className="text-xs text-blue-600">클릭하면 번역 서비스로 이동합니다</p>
                                        </div>
                                    </a>
                                ) : (
                                    <div className="bg-gray-50 rounded-2xl py-12 px-4 border border-dashed border-gray-300 text-center">
                                        <Languages className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                                        <p className="text-sm text-gray-900 font-bold mb-1">실시간 번역 서비스</p>
                                        <p className="text-xs text-gray-500">현재 준비 중입니다</p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                {/* Home Button - Floating Bottom aesthetics */}
                <div className="mt-6 text-center">
                    <a
                        href={`https://${hostname}/${slug && slug.includes('_') ? slug.split('_')[1] : slug || ''}`}
                        className="inline-flex items-center justify-center py-3 px-8 bg-white/80 backdrop-blur-sm text-emerald-800 font-bold rounded-full hover:bg-white transition-colors border border-emerald-100 shadow-sm text-sm"
                    >
                        학술대회 홈페이지로 이동
                    </a>
                </div>
            </div>
        </div>
    );
};

export default StandAloneBadgePage;
