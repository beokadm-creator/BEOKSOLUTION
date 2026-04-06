import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // RAW SDK
import { getFirestore, collection, query, where, onSnapshot, orderBy, type Query, getDocs, doc, getDoc } from 'firebase/firestore'; // RAW SDK
import { httpsCallable } from 'firebase/functions';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { SESSION_KEYS } from '../utils/cookie';
import { RefreshCw, CheckCircle, Loader2, Clock, FileText, Calendar, Languages, Download, User, MapPin, TrendingUp, Sparkles, Gift } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import LangToggle from '../components/badge/LangToggle';
import { functions } from '../firebase';
import { getStampMissionTargetCount } from '../utils/stampTour';
import {
    getBadgeDisplayAffiliation,
    getBadgeDisplayName,
    isBadgeIssued,
    type BadgeRecordSource
} from '../utils/badgeRecord';
import {
    resolveConferenceIdFromRoute,
    resolvePublicSlugFromConferenceId
} from '../utils/conferenceRoute';

type TimestampLike = {
    toDate: () => Date;
};

type ZoneBreak = {
    start: string;
    end: string;
};

type AttendanceZone = {
    id: string;
    start?: string;
    end?: string;
    breaks?: ZoneBreak[];
    ruleDate?: string;
};

type AttendanceRule = {
    zones?: Array<Omit<AttendanceZone, 'ruleDate'>>;
};

type AttendanceSettings = {
    rules?: Record<string, AttendanceRule>;
};

type BadgeConfig = {
    materialsUrls?: Array<{ name: string; url: string }>;
    translationUrl?: string;
};

type BadgeUiState = {
    name: string;
    aff: string;
    id: string;
    userId: string;
    issued: boolean;
    zone: string;
    time: string;
    license: string;
    status: string;
    badgeQr: string | null;
    receiptNumber?: string;
    isCompleted?: boolean;
    lastCheckIn?: TimestampLike;
    baseMinutes?: number;
};

type StampTourConfig = {
    enabled: boolean;
    completionRule: { type: 'COUNT' | 'ALL'; requiredCount?: number };
    boothOrderMode: 'SPONSOR_ORDER' | 'CUSTOM';
    customBoothOrder?: string[];
    rewardMode: 'RANDOM' | 'FIXED';
    drawMode?: 'PARTICIPANT' | 'ADMIN' | 'BOTH';
    rewardFulfillmentMode?: 'INSTANT' | 'LOTTERY';
    lotteryScheduledAt?: TimestampLike;
    rewards: Array<{
        id: string;
        name: string;
        imageUrl?: string;
        remainingQty?: number;
        totalQty?: number;
        weight?: number;
        order?: number;
    }>;
    soldOutMessage?: string;
    completionMessage?: string;
};

type StampProgress = {
    rewardStatus?: 'NONE' | 'REQUESTED' | 'REDEEMED';
    lotteryStatus?: 'PENDING' | 'SELECTED' | 'NOT_SELECTED';
    rewardName?: string;
    isCompleted?: boolean;
    completedAt?: TimestampLike;
};
const StandAloneBadgePage: React.FC = () => {
    // BUGFIX-20250124: Fixed React error #130 by moving unsubscribeDB to outer scope
    const { slug } = useParams();
    const navigate = useNavigate();
    const db = getFirestore();
    const [status, setStatus] = useState("INIT"); // INIT, LOADING, READY, NO_AUTH, NO_DATA, REDIRECTING
    const [ui, setUi] = useState<BadgeUiState | null>(null);
    const [zones, setZones] = useState<AttendanceZone[]>([]);
    const [liveMinutes, setLiveMinutes] = useState<number>(0);
    const [badgeConfig, setBadgeConfig] = useState<BadgeConfig | null>(null);
    const [stampConfig, setStampConfig] = useState<StampTourConfig | null>(null);
    const [stampBoothCandidates, setStampBoothCandidates] = useState<Array<{ id: string; name: string }>>([]);
    const [myStamps, setMyStamps] = useState<string[]>([]);
    const [stampProgress, setStampProgress] = useState<StampProgress>({});
    const [guestbookEntries, setGuestbookEntries] = useState<Array<{ vendorName: string; message?: string }>>([]);
    const [rewardRequesting, setRewardRequesting] = useState(false);
    const [rewardMessage, setRewardMessage] = useState('');
    const [rewardAnimationOpen, setRewardAnimationOpen] = useState(false);
    const [msg, setMsg] = useState("로딩 중...");
    const [refreshing, setRefreshing] = useState(false);
    const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastQueryRef = useRef<Query | null>(null);
    const lastSourceRef = useRef<BadgeRecordSource | null>(null);
    const [badgeLang, setBadgeLang] = useState<'ko' | 'en'>('ko');

    const t = useCallback((ko: string, en: string) => (
        badgeLang === 'ko' ? ko : en
    ), [badgeLang]);

    const formatMinutes = useCallback((minutes: number) => (
        badgeLang === 'ko'
            ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`
            : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    ), [badgeLang]);

    // Helper to determine correct confId
    const getConfIdToUse = useCallback((slugVal: string | undefined): string => (
        resolveConferenceIdFromRoute(slugVal)
    ), []);
    const publicSlug = resolvePublicSlugFromConferenceId(slug);

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
                setMsg("?곗씠?곕? 遺덈윭?ㅻ뒗 以묒엯?덈떎...");

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
                            const attendanceSettings = rulesSnap.data() as AttendanceSettings;
                            const allRules = attendanceSettings.rules || {};
                            const allZones: AttendanceZone[] = [];
                            Object.entries(allRules).forEach(([dateStr, rule]) => {
                                if (rule && rule.zones) {
                                    rule.zones.forEach((z) => {
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
                const processSnapshot = (snap: import('firebase/firestore').QuerySnapshot, source: BadgeRecordSource) => {
                    if (snap.empty) {
                        // This should only happen if the document was deleted after we found it
                        console.log(`[StandAloneBadgePage] ${source} registration disappeared`);
                        setStatus("NO_DATA");
                        setMsg("?깅줉 ?뺣낫媛 ?놁뒿?덈떎.");
                        return;
                    }

                    const d = snap.docs[0].data();
                    console.log(`[StandAloneBadgePage] ${source} Registration found:`, d);

                    // Common Field Mapping
                    const uiName = getBadgeDisplayName(d);
                    const uiAff = getBadgeDisplayAffiliation(d);
                    const uiId = String(snap.docs[0].id);
                    const uiIssued = isBadgeIssued(d, source);

                    // External might not have attendanceStatus, default to OUTSIDE
                    const uiZone = String(d.attendanceStatus === 'INSIDE' ? (d.currentZone || 'Inside') : 'OUTSIDE');
                    const uiTime = String(d.totalMinutes || '0');
                    const uiLicense = String(d.licenseNumber || d.userInfo?.licenseNumber || '-');
                    const uiStatus = String(d.attendanceStatus || 'OUTSIDE');
                    const uiBadgeQr = d.badgeQr || null;
                    const uiReceiptNumber = String(d.receiptNumber || '');
                    const uiIsCompleted = !!d.isCompleted;
                    const lastCheckIn = d.lastCheckIn;
                    const baseMinutes = Number(d.totalMinutes || 0);

                    setUi({
                        name: uiName,
                        aff: uiAff,
                        id: uiId,
                        userId: String(d.userId || uiId),
                        issued: uiIssued,
                        zone: uiZone,
                        time: uiTime,
                        license: uiLicense,
                        status: uiStatus,
                        badgeQr: uiBadgeQr,
                        receiptNumber: uiReceiptNumber,
                        isCompleted: uiIsCompleted,
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
                        lastSourceRef.current = 'REGULAR';
                        unsubscribeDB = onSnapshot(qReg, (snap) => processSnapshot(snap, 'REGULAR'));
                    } else {
                        // Check External
                        const snapExt = await getDocs(qExt);
                        if (!snapExt.empty) {
                            console.log('[StandAloneBadgePage] Found in EXTERNAL_ATTENDEES');
                            if (lastQueryRef) lastQueryRef.current = qExt;
                            lastSourceRef.current = 'EXTERNAL';
                            unsubscribeDB = onSnapshot(qExt, (snap) => processSnapshot(snap, 'EXTERNAL'));
                        } else {
                            // No data in either
                            console.log('[StandAloneBadgePage] No PAID registration found in either collection');
                            setStatus("NO_DATA");
                            setMsg("?깅줉 ?뺣낫媛 ?놁뒿?덈떎.");
                        }
                    }
                } catch (err) {
                    console.error('[StandAloneBadgePage] Error fetching badge data:', err);
                    setStatus("NO_DATA");
                    setMsg("?곗씠?곕? 遺덈윭?ㅻ뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
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
                            navigate(`/${publicSlug}/check-status?lang=ko`, { replace: true });
                            return;
                        }

                        // For non-members, redirect to NonMemberHubPage which has QR code
                        console.log('[StandAloneBadgePage] Non-member detected, redirecting to hub', { registrationId: session.registrationId });
                        navigate(`/${publicSlug}/non-member/hub`, { replace: true });
                        return;
                    } catch (err) {
                        console.error('[StandAloneBadgePage] Failed to parse non-member session:', err);
                    }
                } else {
                    setStatus("NO_AUTH");
                    setMsg("濡쒓렇?몄씠 ?꾩슂?⑸땲??");
                }
            }
        });

        return () => {
            if (unsubscribeDB) unsubscribeDB(); // Clean up DB subscription first
            if (unsubscribeAuth) unsubscribeAuth(); // Then clean up auth subscription
        };
    }, [getConfIdToUse, navigate, publicSlug, slug]);

    // Auto-refresh when badge is NOT issued (voucher state)
    useEffect(() => {
        if (status === "READY" && ui && !ui.issued && lastQueryRef?.current) {
            // Poll every 2 seconds to check if badge has been issued
            // Faster polling for immediate switch after InfoDesk scan
            refreshIntervalRef.current = setInterval(() => {
                setRefreshing(true);
                getDocs(lastQueryRef.current!)
                    .then((snap) => {
                        if (snap.empty || !lastSourceRef.current) return;

                        const d = snap.docs[0].data();
                        const uiIssued = isBadgeIssued(d, lastSourceRef.current);
                        if (!uiIssued) return;

                        setUi((prev) => ({
                            ...prev!,
                            issued: true,
                            badgeQr: d.badgeQr || null,
                            status: String(d.attendanceStatus || 'OUTSIDE'),
                            zone: String(d.attendanceStatus === 'INSIDE' ? (d.currentZone || 'Inside') : 'OUTSIDE'),
                            time: String(d.totalMinutes || '0')
                        }));
                    })
                    .finally(() => {
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
                    zoneRule.breaks.forEach((brk) => {
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

    useEffect(() => {
        const confIdToUse = getConfIdToUse(slug);
        if (!confIdToUse || !ui?.userId || !ui.issued) {
            setStampConfig(null);
            setStampBoothCandidates([]);
            setMyStamps([]);
            setStampProgress({});
            setGuestbookEntries([]);
            return;
        }

        let unsubscribeStamps: (() => void) | null = null;
        let unsubscribeProgress: (() => void) | null = null;

        const loadStampTour = async () => {
            try {
                const [configSnap, sponsorsSnap] = await Promise.all([
                    getDoc(doc(db, `conferences/${confIdToUse}/settings/stamp_tour`)),
                    getDocs(query(collection(db, `conferences/${confIdToUse}/sponsors`), where('isStampTourParticipant', '==', true)))
                ]);

                if (configSnap.exists()) {
                    const configData = configSnap.data() as Partial<StampTourConfig>;
                    setStampConfig({
                        enabled: configData.enabled === true,
                        completionRule: configData.completionRule || { type: 'COUNT', requiredCount: 5 },
                        boothOrderMode: configData.boothOrderMode || 'SPONSOR_ORDER',
                        customBoothOrder: configData.customBoothOrder || [],
                        rewardMode: configData.rewardMode || 'RANDOM',
                        drawMode: configData.drawMode || 'PARTICIPANT',
                        rewardFulfillmentMode: configData.rewardFulfillmentMode || 'INSTANT',
                        lotteryScheduledAt: configData.lotteryScheduledAt,
                        rewards: Array.isArray(configData.rewards) ? configData.rewards : [],
                        soldOutMessage: configData.soldOutMessage,
                        completionMessage: configData.completionMessage
                    });
                } else {
                    setStampConfig(null);
                }

                const booths = sponsorsSnap.docs.map((snapshot) => {
                    const sponsor = snapshot.data() as { vendorId?: string; name?: string };
                    return {
                        id: sponsor.vendorId || snapshot.id,
                        name: sponsor.name || snapshot.id
                    };
                });
                setStampBoothCandidates(booths);

                unsubscribeStamps = onSnapshot(
                    query(collection(db, `conferences/${confIdToUse}/stamps`), where('userId', '==', ui.userId)),
                    (snapshot) => {
                        const uniqueVendorIds = Array.from(new Set(
                            snapshot.docs
                                .map((stampDoc) => (stampDoc.data() as { vendorId?: string }).vendorId)
                                .filter(Boolean)
                        )) as string[];
                        setMyStamps(uniqueVendorIds);
                    }
                );

                unsubscribeProgress = onSnapshot(
                    doc(db, `conferences/${confIdToUse}/stamp_tour_progress/${ui.userId}`),
                    (snapshot) => {
                        setStampProgress(snapshot.exists() ? snapshot.data() as StampProgress : {});
                    }
                );

                const guestbookSnap = await getDocs(
                    query(collection(db, `conferences/${confIdToUse}/guestbook_entries`), where('userId', '==', ui.userId))
                );
                setGuestbookEntries(
                    guestbookSnap.docs.map((entryDoc) => {
                        const entry = entryDoc.data() as { vendorName?: string; message?: string };
                        return {
                            vendorName: entry.vendorName || 'Partner Booth',
                            message: entry.message
                        };
                    })
                );
            } catch (error) {
                console.error('[StandAloneBadgePage] Failed to load stamp tour data', error);
            }
        };

        loadStampTour();

        return () => {
            unsubscribeStamps?.();
            unsubscribeProgress?.();
        };
    }, [db, getConfIdToUse, slug, ui?.issued, ui?.userId]);

    const orderedStampBooths = useMemo(() => {
        if (!stampConfig?.enabled) return [];
        if (stampConfig.boothOrderMode === 'CUSTOM' && stampConfig.customBoothOrder?.length) {
            const priorityBooths = stampConfig.customBoothOrder
                .map((boothId) => stampBoothCandidates.find((candidate) => candidate.id === boothId))
                .filter(Boolean) as Array<{ id: string; name: string }>;
            const remainingBooths = stampBoothCandidates.filter(
                (candidate) => !stampConfig.customBoothOrder?.includes(candidate.id)
            );
            return [...priorityBooths, ...remainingBooths];
        }
        return stampBoothCandidates;
    }, [stampBoothCandidates, stampConfig]);

    const requiredStampCount = useMemo(() => {
        if (!stampConfig?.enabled) return 0;
        return getStampMissionTargetCount(stampConfig.completionRule, orderedStampBooths.length);
    }, [orderedStampBooths.length, stampConfig]);

    const isStampMissionComplete = stampConfig?.enabled
        ? requiredStampCount > 0 && myStamps.length >= requiredStampCount
        : false;
    const completedAtMs = stampProgress.completedAt?.toDate().getTime();
    const lotteryScheduledAtMs = stampConfig?.lotteryScheduledAt?.toDate().getTime();
    const completedBeforeLotteryCutoff = lotteryScheduledAtMs == null || completedAtMs == null || completedAtMs <= lotteryScheduledAtMs;
    const lotteryStatus = stampProgress.lotteryStatus || (
        stampConfig?.rewardFulfillmentMode === 'LOTTERY'
        && isStampMissionComplete
        && completedBeforeLotteryCutoff
            ? 'PENDING'
            : undefined
    );
    const isInstantReward = stampConfig?.rewardFulfillmentMode !== 'LOTTERY';
    const canParticipantDraw = isInstantReward && stampConfig?.drawMode !== 'ADMIN';
    const currentRewardStatus = stampProgress.rewardStatus || 'NONE';
    const missedLotteryCutoff = !isInstantReward
        && currentRewardStatus === 'NONE'
        && !completedBeforeLotteryCutoff;

    const stampBooths = useMemo(() => {
        const stampedSet = new Set(myStamps);
        return orderedStampBooths.map((booth) => ({
            ...booth,
            isStamped: stampedSet.has(booth.id)
        }));
    }, [myStamps, orderedStampBooths]);

    const handleRewardRequest = async () => {
        const confIdToUse = getConfIdToUse(slug);
        if (!confIdToUse || !ui || !stampConfig?.enabled || !isStampMissionComplete) return;

        setRewardRequesting(true);
        setRewardMessage('');
        try {
            const requestReward = httpsCallable(functions, 'requestStampReward');
            const response = await requestReward({
                confId: confIdToUse,
                userName: ui.name,
                userOrg: ui.aff
            });
            const payload = response.data as { rewardName?: string };
            setRewardMessage(payload.rewardName
                ? t(
                    `${payload.rewardName} 상품 요청이 접수되었습니다. 현장에서 확인해 주세요.`,
                    `${payload.rewardName} request received. Please confirm on site.`
                )
                : t(
                    '상품 요청이 접수되었습니다. 현장에서 확인해 주세요.',
                    'Reward request received. Please confirm on site.'
                )
            );
            setRewardAnimationOpen(true);
        } catch (error) {
            console.error('[StandAloneBadgePage] Reward request failed', error);
            setRewardMessage(error instanceof Error ? error.message : t('상품 요청에 실패했습니다.', 'Reward request failed.'));
        } finally {
            setRewardRequesting(false);
        }
    };
    if (msg && status !== "READY") return (
        <div className="min-h-screen bg-[#f0f5fa] flex items-center justify-center font-sans">
            <div className="text-center">
                <Loader2 className="w-16 h-16 animate-spin text-[#003366] mx-auto mb-4" />
                <p className="text-xl font-medium text-gray-600">{msg}</p>
            </div>
        </div>
    );
    if (!ui) return <div className="p-10 text-center flex items-center justify-center min-h-screen">{t('명찰 정보를 찾을 수 없습니다.', 'Badge information is not available.')}</div>;

    const showBadgeQr = ui.issued;
    const qrValue = showBadgeQr ? (ui.badgeQr || `BADGE-${ui.id}`) : ui.id;

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
                    <div className="mb-3 flex justify-end gap-2">
                        <LangToggle badgeLang={badgeLang} setBadgeLang={setBadgeLang} />
                    </div>
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
                                <span className="text-xs font-bold tracking-wide">{t('명찰 발급 대기', 'BADGE PENDING')}</span>
                            </div>
                        </div>

                        {/* Watermark Background */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none mt-8">
                            <div className="text-8xl font-black text-gray-900 transform -rotate-12">{t('임시', 'TEMPORARY')}</div>
                        </div>

                        {/* Content Container - Relative to sit above watermark */}
                        <div className="relative z-10 mt-8">
                            {/* Header with Icon */}
                            <div className="mb-4">
                                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <FileText className="w-8 h-8 text-amber-600" />
                                </div>
                                <h1 className="text-xl font-black mb-1 tracking-wide text-amber-700">
                                    {t('등록 확인 바우처', 'Registration Voucher')}
                                </h1>
                                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">{t('현장 확인용', 'For On-site Check-in')}</p>
                            </div>

                            {/* Warning Notice */}
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl py-2 px-3 mb-4">
                                <p className="text-xs font-bold text-amber-800">
                                    {t(
                                        '현장 등록 데스크에서 이 QR을 보여주시면 명찰 발급을 진행할 수 있습니다.',
                                        'Show this QR at the registration desk to receive your badge.'
                                    )}
                                </p>
                            </div>

                            {/* Organization */}
                            <p className="text-sm text-gray-600 font-medium mb-1">{ui.aff}</p>

                            {/* Name */}
                            <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">{ui.name}</h2>

                            {/* Receipt Number - Prominent */}
                            {ui.receiptNumber && (
                                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl py-3 px-4 mb-4 border border-amber-200">
                                    <p className="text-xs font-bold text-amber-600 uppercase mb-1">{t('접수 번호', 'Receipt Number')}</p>
                                    <p className="text-xl font-black text-amber-700 tracking-wider">{ui.receiptNumber}</p>
                                </div>
                            )}

                            {/* License Number */}
                            {ui.license && ui.license !== '-' && (
                                <div className="bg-gray-50 rounded-lg py-2 px-3 mb-4">
                                    <p className="text-xs font-semibold text-gray-600">{t('면허번호', 'License No.')}</p>
                                    <p className="text-sm font-bold text-gray-800">{ui.license}</p>
                                </div>
                            )}

                            {/* QR Code - The Main Element */}
                            <div className="bg-white p-3 inline-block rounded-2xl shadow-lg border-2 border-amber-200 mb-4">
                                <div className="text-xs font-semibold text-gray-500 mb-2">{t('등록 확인 QR', 'Voucher QR')}</div>
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
                                    {t('등록 데스크에 QR 제시', 'Present QR at check-in')}
                                </p>
                                <p className="text-xs text-amber-700 mt-1">{t('확인 후 디지털 명찰이 발급됩니다.', 'Your digital badge will be issued after verification.')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Refresh Indicator */}
                    {refreshing && (
                        <div className="mt-4 text-center text-sm text-amber-700 font-medium flex items-center justify-center gap-2 bg-white/80 rounded-lg py-2 px-4">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            {t('명찰 발급 상태를 새로고침 중입니다...', 'Refreshing badge status...')}
                        </div>
                    )}

                    {/* Home Button */}
                    <button
                        onClick={() => navigate(`/${publicSlug}`)}
                        className="block w-full mt-4 py-3 px-6 bg-white text-amber-700 font-bold rounded-xl hover:bg-amber-50 transition-colors text-center border-2 border-amber-200 shadow-md"
                    >
                        {t('행사 홈으로', 'Back to event home')}
                    </button>
                </div>
            </div>
        );
    }

    // ISSUED BADGE STATE
    return (
        <div className="min-h-[100dvh] bg-[#f0f5fa] flex flex-col p-4 font-sans">
            <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center py-6">
                <div className="mb-3 flex justify-end gap-2">
                    <LangToggle badgeLang={badgeLang} setBadgeLang={setBadgeLang} />
                </div>
                {/* Digital Badge Card - Professional Name Tag */}
                <div className="bg-white border border-[#c3daee] rounded-2xl overflow-hidden shadow-lg flex flex-col">

                    {/* Issued Badge Header - Always Visible */}
                    <div className="bg-[#003366] py-3 px-4">
                        <div className="flex items-center justify-center gap-2 text-white">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm font-bold tracking-wider">{t('디지털 명찰 발급 완료', 'Digital Badge Issued')}</span>
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
                                <span className="text-xs font-bold tracking-wide">{t('면허번호', 'License No.')}: {ui.license}</span>
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
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">{t('출입 QR', 'Access Code')}</p>
                        </div>
                        <p className="text-xs font-medium text-emerald-600 animate-pulse">
                            {t('입장 및 출석 확인 시 이 QR을 제시해 주세요.', 'Please present this QR for entry and attendance check.')}
                        </p>
                    </div>

                    {/* Tabbed Interface - Compact & Clean */}
                    <div className="bg-gray-50/80 border-t border-gray-100 p-2">
                        <Tabs defaultValue="status" className="w-full">
                            <TabsList className="grid grid-cols-6 w-full h-auto p-1 bg-white border border-gray-200 shadow-sm rounded-xl">
                                <TabsTrigger value="status" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                                    <User className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">{t('상태', 'Status')}</span>
                                </TabsTrigger>
                                <TabsTrigger value="sessions" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                                    <TrendingUp className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">{t('세션', 'Sessions')}</span>
                                </TabsTrigger>
                                <TabsTrigger value="materials" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                                    <FileText className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">{t('자료', 'Materials')}</span>
                                </TabsTrigger>
                                <TabsTrigger value="program" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                                    <Calendar className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">{t('일정', 'Program')}</span>
                                </TabsTrigger>
                                <TabsTrigger value="translation" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                                    <Languages className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">{t('통역', 'Translation')}</span>
                                </TabsTrigger>
                                <TabsTrigger value="stamp-tour" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                                    <Gift className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">{t('스탬프', 'Stamp')}</span>
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
                                            ? <><span className="w-3 h-3 bg-green-500 rounded-full animate-ping" /><span>{t('입장 중 (INSIDE)', 'Inside (INSIDE)')}</span></>
                                            : <><span className="w-3 h-3 bg-gray-300 rounded-full" /><span>{t('퇴장 상태 (OUTSIDE)', 'Outside (OUTSIDE)')}</span></>
                                        }
                                    </div>
                                </div>

                                {ui.zone && ui.zone !== 'OUTSIDE' && (
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl py-3 px-4 flex justify-between items-center">
                                        <p className="text-xs text-blue-600 font-bold">{t('현재 구역', 'Current zone')}</p>
                                        <p className="text-sm font-black text-blue-800 flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-blue-500" />
                                            {ui.zone}
                                        </p>
                                    </div>
                                )}

                                {liveMinutes > 0 && (
                                    <div className="bg-purple-50/50 border border-purple-100 rounded-xl py-3 px-4 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <p className="text-xs text-purple-600 font-bold">{t('누적 체류 시간', 'Total attendance time')}</p>
                                            {ui.status === 'INSIDE' && <p className="text-[10px] text-purple-400">{t('현재 세션 시간이 계속 반영됩니다.', 'Current session time is updating live.')}</p>}
                                        </div>
                                        <p className="text-sm font-black text-purple-800 flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-purple-500" />
                                            {formatMinutes(liveMinutes)}
                                        </p>
                                    </div>
                                )}
                            </TabsContent>

                            {/* Sessions Tab */}
                            <TabsContent value="sessions" className="mt-2 p-1">
                                <div className="bg-white rounded-2xl py-6 px-4 border border-gray-100 shadow-sm text-center">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${ui.isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'}`}>
                                        {ui.isCompleted ? <CheckCircle className="w-6 h-6 text-emerald-600" /> : <TrendingUp className="w-6 h-6 text-gray-400" />}
                                    </div>
                                    <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wider">{t('세션 진행', 'Session Progress')}</p>
                                    <p className="text-sm text-gray-500 font-medium mb-4">{t('참가자의 출석 진행 상태입니다.', 'This shows the attendee session progress.')}</p>

                                    <div className="flex flex-col items-center gap-1 mb-4">
                                        <span className={`text-3xl font-black tracking-tight ${ui.isCompleted ? 'text-emerald-600' : 'text-gray-900'}`}>
                                            {ui.isCompleted ? t('이수 완료', 'Completed') : t('진행 중', 'In Progress')}
                                        </span>
                                        <span className="text-sm font-bold text-gray-500 mt-2 bg-gray-50 px-4 py-2 rounded-lg">
                                            {t('누적 인정 시간', 'Tracked time')}: <span className="text-purple-600">{formatMinutes(liveMinutes)}</span>
                                        </span>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Materials Tab */}
                            <TabsContent value="materials" className="mt-2 p-1 space-y-2">
                                {badgeConfig?.materialsUrls && badgeConfig.materialsUrls.length > 0 ? (
                                    badgeConfig.materialsUrls.map((mat, idx: number) => (
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
                                                <p className="text-xs text-gray-500">{t('자료를 새 창에서 엽니다.', 'Open material in a new window.')}</p>
                                            </div>
                                        </a>
                                    ))
                                ) : (
                                    <>
                                        <a
                                            href={`/${slug}/materials`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center p-4 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group"
                                        >
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                                                <Download className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-gray-900">{t('강의 자료집', 'Lecture materials')}</p>
                                                <p className="text-xs text-gray-500">{t('발표 자료를 확인할 수 있습니다.', 'Open presentation materials.')}</p>
                                            </div>
                                        </a>
                                        <a
                                            href={`/${slug}/abstracts`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center p-4 bg-white hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-xl transition-all group"
                                        >
                                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-purple-200 transition-colors">
                                                <FileText className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-gray-900">{t('초록집', 'Abstract book')}</p>
                                                <p className="text-xs text-gray-500">{t('초록 자료를 확인할 수 있습니다.', 'Open the abstract book.')}</p>
                                            </div>
                                        </a>
                                    </>
                                )}
                            </TabsContent>

                            {/* Program Tab */}
                            <TabsContent value="program" className="mt-2 p-1">
                                <a
                                    href={`/${slug}/program`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-2xl hover:border-amber-300 hover:bg-amber-50 transition-all text-center gap-3"
                                >
                                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                                        <Calendar className="w-8 h-8 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-gray-900">{t('프로그램 일정 보기', 'Open program schedule')}</p>
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
                                            <p className="text-sm text-blue-900 font-bold mb-1">{t('실시간 통역 서비스로 이동', 'Open live translation')}</p>
                                            <p className="text-xs text-blue-600">{t('터치하면 통역 서비스가 열립니다.', 'Tap to open the translation service.')}</p>
                                        </div>
                                    </a>
                                ) : (
                                    <div className="bg-gray-50 rounded-2xl py-12 px-4 border border-dashed border-gray-300 text-center">
                                        <Languages className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                                        <p className="text-sm text-gray-900 font-bold mb-1">{t('통역 서비스 준비 중', 'Translation service unavailable')}</p>
                                        <p className="text-xs text-gray-500">{t('현재 연결된 통역 링크가 없습니다.', 'No translation link is configured right now.')}</p>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="stamp-tour" className="mt-2 p-1 space-y-3">
                                {!stampConfig?.enabled ? (
                                    <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-10 px-4 text-center">
                                        <Gift className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-gray-800 mb-1">{t('스탬프 투어 미운영', 'Stamp tour unavailable')}</p>
                                        <p className="text-xs text-gray-500">{t('이 행사에서는 스탬프 투어가 열려 있지 않습니다.', 'Stamp tour is not active for this event.')}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-4 shadow-sm">
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <div>
                                                    <p className="text-sm font-black text-amber-900">{t('스탬프 투어 진행', 'Stamp tour progress')}</p>
                                                    <p className="text-xs text-amber-700">{t('참여 부스를 방문해 스탬프를 모아 주세요.', 'Visit participating booths and collect stamps.')}</p>
                                                </div>
                                                <div className="rounded-full bg-white px-3 py-1 text-sm font-black text-amber-700 shadow-sm">
                                                    {myStamps.length} / {requiredStampCount || stampBoothCandidates.length}
                                                </div>
                                            </div>

                                            <div className="h-3 overflow-hidden rounded-full bg-amber-200">
                                                <div
                                                    className="h-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-700"
                                                    style={{ width: `${Math.min(100, requiredStampCount > 0 ? (myStamps.length / requiredStampCount) * 100 : 0)}%` }}
                                                />
                                            </div>

                                            <div className="mt-4 space-y-2">
                                                <p className="text-xs font-semibold text-amber-900">
                                                    {isStampMissionComplete
                                                        ? (stampConfig.completionMessage || t('스탬프 투어를 완료했습니다.', 'Stamp tour completed.'))
                                                        : t(`${myStamps.length}개의 스탬프를 모았습니다.`, `${myStamps.length} stamps collected.`)}
                                                </p>
                                                {currentRewardStatus === 'REQUESTED' && (
                                                    <div className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">
                                                        {stampProgress.rewardName
                                                            ? t(`${stampProgress.rewardName} 상품 요청이 접수되었습니다.`, `${stampProgress.rewardName} request received.`)
                                                            : t('상품 요청이 접수되었습니다.', 'Reward request received.')}
                                                    </div>
                                                )}
                                                {currentRewardStatus === 'REDEEMED' && (
                                                    <div className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">
                                                        {t('상품 수령이 완료되었습니다.', 'Reward has been redeemed.')}
                                                    </div>
                                                )}
                                                {isStampMissionComplete && currentRewardStatus === 'NONE' && canParticipantDraw && (
                                                    <button
                                                        type="button"
                                                        onClick={handleRewardRequest}
                                                        disabled={rewardRequesting}
                                                        className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        {rewardRequesting ? t('처리 중...', 'Processing...') : t('상품 요청하기', 'Request reward')}
                                                    </button>
                                                )}
                                                {isStampMissionComplete && currentRewardStatus === 'NONE' && !canParticipantDraw && isInstantReward && (
                                                    <div className="rounded-xl bg-sky-100 px-3 py-2 text-xs font-bold text-sky-700">
                                                        {t('관리자 추첨 대기 중입니다. 운영 화면에서 당첨이 확정됩니다.', 'Waiting for admin draw. Winners will be confirmed on the admin screen.')}
                                                    </div>
                                                )}
                                                {isStampMissionComplete && !isInstantReward && lotteryStatus === 'PENDING' && (
                                                    <div className="rounded-xl bg-sky-100 px-3 py-2 text-xs font-bold text-sky-700">
                                                        {t('예약 추첨 대기 중입니다. 지정된 시각 이후 관리자 화면에서 추첨됩니다.', 'Scheduled lottery is pending and will run from the admin console after the set time.')}
                                                    </div>
                                                )}
                                                {isStampMissionComplete && !isInstantReward && lotteryStatus === 'PENDING' && stampConfig.lotteryScheduledAt && (
                                                    <div className="rounded-xl bg-white/80 px-3 py-2 text-xs text-amber-900">
                                                        {t('추첨 예정 시각', 'Scheduled draw time')}: {stampConfig.lotteryScheduledAt.toDate().toLocaleString(badgeLang === 'ko' ? 'ko-KR' : 'en-US')}
                                                    </div>
                                                )}
                                                {missedLotteryCutoff && (
                                                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                                                        {t('예약 추첨 마감 이후에 미션을 완료해 이번 추첨 대상에서는 제외되었습니다.', 'Mission completion happened after the lottery cutoff, so this entry is excluded from the current draw.')}
                                                    </div>
                                                )}
                                                {!isInstantReward && lotteryStatus === 'NOT_SELECTED' && (
                                                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                                                        {t('이번 예약 추첨에서는 미당첨입니다.', 'Not selected in this scheduled draw.')}
                                                    </div>
                                                )}
                                                {rewardMessage && (
                                                    <div className="rounded-xl bg-white/80 px-3 py-2 text-xs text-amber-900">
                                                        {rewardMessage}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                                            <p className="mb-3 text-sm font-black text-gray-900">{t('참여 부스 진행 현황', 'Participating booth status')}</p>
                                            <div className="space-y-2">
                                                {stampBooths.length === 0 ? (
                                                    <p className="text-xs text-gray-400">{t('참여 부스 정보가 없습니다.', 'No participating booths found.')}</p>
                                                ) : stampBooths.map((booth) => (
                                                    <div key={booth.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm">
                                                        <span className="font-semibold text-gray-800">{booth.name}</span>
                                                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${booth.isStamped ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                                                            {booth.isStamped ? t('스탬프 완료', 'Stamped') : t('미완료', 'Pending')}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                                            <p className="mb-3 text-sm font-black text-gray-900">{t('방명록 참여 내역', 'Guestbook activity')}</p>
                                            <div className="space-y-2">
                                                {guestbookEntries.length === 0 ? (
                                                    <p className="text-xs text-gray-400">{t('방명록 참여 내역이 없습니다.', 'No guestbook entries yet.')}</p>
                                                ) : guestbookEntries.map((entry, index) => (
                                                    <div key={`${entry.vendorName}-${index}`} className="rounded-xl bg-gray-50 px-3 py-2">
                                                        <p className="text-sm font-semibold text-gray-800">{entry.vendorName}</p>
                                                        {entry.message && <p className="mt-1 text-xs text-gray-500">{entry.message}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                {/* Home Button - Floating Bottom aesthetics */}
                <div className="mt-6 text-center">
                    <button
                        onClick={() => navigate(`/${publicSlug}`)}
                        className="inline-flex items-center justify-center py-3 px-8 bg-white/80 backdrop-blur-sm text-emerald-800 font-bold rounded-full hover:bg-white transition-colors border border-emerald-100 shadow-sm text-sm"
                    >
                        {t('행사 홈으로', 'Back to event home')}
                    </button>
                </div>
            </div>

            {rewardAnimationOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 px-6">
                    <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-white p-8 text-center shadow-2xl">
                        <button
                            type="button"
                            onClick={() => setRewardAnimationOpen(false)}
                            className="absolute right-4 top-4 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600"
                        >
                            {t('닫기', 'Close')}
                        </button>
                        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-200 via-orange-100 to-transparent" />
                        <div className="relative">
                            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
                                <Sparkles className="h-10 w-10 animate-pulse" />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-600">{t('상품 안내', 'Reward Reveal')}</p>
                            <h3 className="mt-2 text-2xl font-black text-gray-900">
                                {stampProgress.rewardName || t('상품 확정', 'Reward assigned')}
                            </h3>
                            <p className="mt-3 text-sm leading-6 text-gray-600">
                                {rewardMessage || t('상품 요청이 접수되었습니다. 현장에서 확인해 주세요.', 'Reward request received. Please confirm on site.')}
                            </p>
                            <div className="mt-6 flex justify-center gap-2">
                                <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" />
                                <span className="h-2 w-2 animate-bounce rounded-full bg-orange-400 [animation-delay:120ms]" />
                                <span className="h-2 w-2 animate-bounce rounded-full bg-yellow-400 [animation-delay:240ms]" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StandAloneBadgePage;




