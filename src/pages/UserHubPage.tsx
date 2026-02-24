/* eslint-disable */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, serverTimestamp, getDoc, collectionGroup, orderBy, updateDoc, deleteDoc, onSnapshot, limit } from 'firebase/firestore';
import { useMemberVerification } from '../hooks/useMemberVerification';
import { useAuth } from '../hooks/useAuth';
import { useSociety } from '../hooks/useSociety';
import { functions } from '../firebase';
import { getRootCookie } from '../utils/cookie';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { Calendar, FileText, QrCode, Award, Download, MessageSquare, LayoutDashboard, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { ABSTRACT_STATUS, getAbstractStatusLabel } from '@/constants/abstract';
import EregiNavigation from '../components/eregi/EregiNavigation';
import DataWidget from '../components/eregi/DataWidget';
import { EregiCard } from '@/components/eregi/EregiForm';
import ReceiptTemplate from '../components/print/ReceiptTemplate';
import PrintHandler from '../components/print/PrintHandler';
import { ReceiptConfig } from '../types/print';
import { logger } from '../utils/logger';

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
    paymentStatus?: string;
    status?: string; // CANCELED, REFUNDED, REFUND_REQUESTED 등
    amount?: number;
    receiptNumber?: string;
    paymentDate?: any; // Timestamp or string
    receiptConfig?: ReceiptConfig;
    userName?: string; // Added for receipt
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
    // Fetch society data for dynamic name display
    const { society, loading: societyLoading } = useSociety();

    const [loading, setLoading] = useState(true);
    // [Step 512-Des] Data Highway Feedback
    const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'disconnected'>('syncing');
    const [activeTab, setActiveTab] = useState<'EVENTS' | 'CERTS' | 'PROFILE' | 'ABSTRACTS'>('EVENTS');

    // Non-member detection state
    const [isNonMemberOnly, setIsNonMemberOnly] = useState<boolean>(false);
    const [nonMemberConferenceSlug, setNonMemberConferenceSlug] = useState<string>('');

    // Receipt Modal State
    const [selectedReceiptReg, setSelectedReceiptReg] = useState<UserReg | null>(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);

    // Data
    const [regs, setRegs] = useState<UserReg[]>([]);
    const [abstracts, setAbstracts] = useState<any[]>([]);
    const retryCount = useRef(0);
    const healingAttempted = useRef<{ [key: string]: boolean }>({});
    const realtimeRetryCount = useRef(0);
    const MAX_REALTIME_RETRIES = 3;

    useEffect(() => {
        if (authLoading) return;
        // Indexing error handling removed since abstracts query is disabled
    }, [authLoading]);

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
            console.log('[UserHub] User object from auth:', {
                uid: user.uid || user.id,
                name: user.name,
                email: user.email,
                displayName: (user as any).displayName,
                affiliations: user.affiliations
            });
            logger.debug('UserHub', 'User object from auth', { uid: user.uid || user.id });
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
                            // // console.warn(`[Self-Healing] Skipping ${socId} - Already attempted in this session.`);
                            return;
                        }
                        healingAttempted.current[socId] = true;

                        // // console.log(`[Self-Healing] Missing expiry/expiryDate for ${socId}. Triggering repairData...`);

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
                                    // console.log(`[Self-Healing] REPAIRED ${socId}. Expiry synced.`);
                                } else {
                                    // console.warn(`[Self-Healing] Repair Failed for ${socId}: ${res.message}`);
                                }
                            }
                        } catch (e) {
                            logger.error('UserHub', `Self-healing error for ${socId}`, e);
                        }
                    }
                });
            }
        }
    }, [user, authLoading, fetchUserData, verifyMember]);

    // [Step 402] Real-time validation trigger
    const validateCurrentAffiliationRef = useRef<any>(null);

    useEffect(() => {
        if (user && !authLoading && validateCurrentAffiliationRef.current) {
            validateCurrentAffiliationRef.current(user);
        }
    }, [user, authLoading]);

    const validateCurrentAffiliation = useCallback(async (u: any) => {
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
                        logger.warn('UserHub', `Affiliation ${socId} invalid: ${data.message}. Revoking...`);
                        await updateDoc(doc(db, 'users', u.uid), {
                            [`affiliations.${socId}.verified`]: false,
                            [`affiliations.${socId}.revokedAt`]: serverTimestamp(),
                            [`affiliations.${socId}.revokedReason`]: data.message
                        });
                        toast.error(`[${socId}] Member verification revoked: ${data.message}`);
                    }
                } catch (err) {
                    logger.error('UserHub', `Error checking ${socId}`, err);
                }
            }
        }
    }, []);

    // Update ref whenever function changes
    useEffect(() => {
        validateCurrentAffiliationRef.current = validateCurrentAffiliation;
    }, [validateCurrentAffiliation]);

    // [Step 401-D] Activate Real-time Affiliation Validation
    useEffect(() => {
        if (user && !authLoading && validateCurrentAffiliationRef.current) {
            validateCurrentAffiliationRef.current(user);
        }
    }, [user, authLoading]);

    // [Step 512-D] Real-time Data Highway (Self-Healing)
    useEffect(() => {
        if (!user) return;

        let unsubscribe: (() => void) | undefined;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;

        const setupRealtimeListener = () => {
            const db = getFirestore();
            // [Fix-Step 3-3] Use collectionGroup for 'registrations' to find user history across all conferences
            // Requires Index: registrations (Collection Group) -> userId ASC/DESC
            // [FIX-2026-01-21] Temporarily disabled real-time listener due to index build delay
            // Fall back to one-time fetch from user's participation history instead
            const USE_REALTIME = false; // Toggle to false while index is building

            if (!USE_REALTIME) {
                // Fallback: Fetch from users/{uid}/participations (no index required)
                setSyncStatus('syncing');
                (async () => {
                    try {
                        const db = getFirestore();
                        // Query user's participation history directly (no collection group index needed)
                        const participationsRef = collection(db, `users/${user.uid}/participations`);
                        const snapshot = await getDocs(participationsRef);

                        if (snapshot.empty) {
                            setRegs([]);
                            setTotalPoints(0);
                            setSyncStatus('connected');
                            setLoading(false);
                            return;
                        }

                        let fallbackAff = '';
                        const regPromises = snapshot.docs.map(async (docSnap) => {
                            const data = docSnap.data();
                            if (data.userAffiliation) fallbackAff = data.userAffiliation;

                            // [CRITICAL FIX] Safely extract slug with fallback
                            const confSlug = forceString(data.slug || data.conferenceId || data.conferenceSlug || 'kadd_2026spring');
                            let realTitle = forceString(data.conferenceName || confSlug);
                            let socName = forceString(data.societyName);
                            let loc = "장소 정보 없음";
                            let dates = "";
                            let receiptConfig: ReceiptConfig | undefined = undefined;

                            // JOIN 1: Conference Details
                            try {
                                // First get conference ID from conferences collection
                                // [Fix-2026-01-23] Use direct doc access by ID instead of query
                                // confSlug is already confId (e.g., 'kadd_2026spring')
                                console.log('[UserHub] Fetching conference:', { slug: confSlug, hasSlug: !!data.slug });
                                const confRef = doc(db, 'conferences', confSlug);
                                const confSnap = await getDoc(confRef);
                                console.log('[UserHub] Conference doc exists:', confSnap.exists());
                                if (confSnap.exists()) {
                                    const cData = confSnap.data();
                                    const confId = confSnap.id;
                                    console.log('[UserHub] Conference data:', cData);

                                    // 🔧 [FIX] Handle multilingual title
                                    realTitle = forceString(cData.title?.ko || cData.title?.en || cData.title || cData.slug);

                                    // Get venue and dates from info/general subdocument
                                    try {
                                        console.log('[UserHub] Fetching info/general from:', `conferences/${confId}/info/general`);
                                        const infoDocRef = doc(db, `conferences/${confId}/info/general`);
                                        const infoSnap = await getDoc(infoDocRef);
                                        console.log('[UserHub] Info doc exists:', infoSnap.exists());
                                        if (infoSnap.exists()) {
                                            const iData = infoSnap.data();
                                            console.log('[UserHub] Info doc data:', iData);

                                            // venue can be in multiple formats:
                                            // 1. venue.name (object: {ko: "...", en: "..."})
                                            // 2. venueName (string)
                                            // 3. venue (object with name/address)
                                            const venueNameObj = iData.venue?.name || iData.venueName;
                                            const venueName = venueNameObj
                                                ? (typeof venueNameObj === 'string' ? venueNameObj : venueNameObj.ko || venueNameObj.en || '')
                                                : '';
                                            const venueAddress = iData.venue?.address || iData.venueAddress || '';

                                            // Dates from dates field
                                            const startDate = iData.dates?.start || iData.startDate;
                                            const endDate = iData.dates?.end || iData.endDate;
                                            console.log('[UserHub] Dates:', { startDate, endDate });

                                            loc = venueName ? forceString(venueName) : (venueAddress ? forceString(venueAddress) : '장소 정보 없음');

                                            const s = startDate ? (startDate.toDate ? startDate.toDate().toLocaleDateString('ko-KR') : forceString(startDate)) : '';
                                            const e = endDate ? (endDate.toDate ? endDate.toDate().toLocaleDateString('ko-KR') : forceString(endDate)) : '';
                                            dates = s === e ? s : `${s} ~ ${e}`;
                                            receiptConfig = iData.receiptConfig;

                                            console.log('[UserHub] Venue resolved:', { venueName, venueAddress, loc, dates });
                                        } else {
                                            // Fallback to main conference document
                                            console.log('[UserHub] Info doc not found, using conference main doc');
                                            console.log('[UserHub] Conference dates data:', cData.dates);

                                            // Dates: Conference main doc has dates object
                                            const dateStart = cData.dates?.start || cData.startDate || cData.dates?.startDate;
                                            const dateEnd = cData.dates?.end || cData.endDate;

                                            console.log('[UserHub] Parsed dates:', { dateStart, dateEnd });

                                            const s = dateStart ? (dateStart.toDate ? dateStart.toDate().toLocaleDateString('ko-KR') : forceString(dateStart)) : '';
                                            const e = dateEnd ? (dateEnd.toDate ? dateEnd.toDate().toLocaleDateString('ko-KR') : forceString(dateEnd)) : '';
                                            dates = s === e ? s : `${s} ~ ${e}`;

                                            console.log('[UserHub] Formatted dates:', dates);

                                            // Venue: Try multiple fields
                                            const venueName = cData.venue?.name || cData.venueName || cData.venue?.name?.ko || cData.venue?.name?.en;
                                            const venueAddress = cData.venue?.address || cData.venueAddress;

                                            loc = venueName ? forceString(venueName) : (venueAddress ? forceString(venueAddress) : '장소 정보 없음');

                                            receiptConfig = cData.receipt;
                                            console.log('[UserHub] Fallback venue resolved:', { venueName, venueAddress, loc });
                                        }
                                    } catch (infoErr) {
                                        console.error('[UserHub] Info lookup failed:', infoErr);
                                        logger.warn('UserHub', `Info lookup failed for ${confId}, using conference data`, infoErr);
                                        // Fallback to main conference document
                                        loc = forceString(cData.location || cData.venue?.name || cData.venue?.address || '장소 정보 없음');
                                        const s = forceString(cData.dates?.start || cData.startDate);
                                        const e = forceString(cData.dates?.end || cData.endDate);
                                        dates = s === e ? s : `${s} ~ ${e}`;
                                        receiptConfig = cData.receipt;
                                    }
                                }
                            } catch (err) {
                                logger.error('UserHub', `Conference lookup failed for slug: ${confSlug}`, err);
                            }

                            // JOIN 2: Society Name (If missing)
                            if (!socName || socName === 'Unknown') {
                                try {
                                    const socDoc = await getDoc(doc(db, 'societies', data.societyId));
                                    if (socDoc.exists()) socName = forceString(socDoc.data().name);
                                } catch (err) {
                                    // Silently handle society lookup failures
                                    console.debug('[UserHub] Society lookup failed, using fallback data');
                                }
                            }

                            return {
                                id: docSnap.id,
                                conferenceName: realTitle,
                                societyName: socName,
                                earnedPoints: Number(data.earnedPoints || 0),
                                slug: forceString(data.slug),
                                societyId: forceString(data.societyId || 'kadd'),
                                location: loc,
                                dates: dates,
                                paymentStatus: data.paymentStatus,
                                status: data.status || data.paymentStatus, // CANCELED, REFUNDED 등
                                amount: data.amount,
                                receiptNumber: data.id,
                                paymentDate: data.createdAt,
                                receiptConfig: receiptConfig,
                                userName: data.userName || user.name || (user as any).displayName
                            };
                        });

                        const loadedRegs = await Promise.all(regPromises);
                        console.log('[UserHub] Loaded registrations:', loadedRegs);
                        console.log('[UserHub] Registration statuses:', loadedRegs.map(r => ({ id: r.id, name: r.conferenceName, status: r.status, paymentStatus: r.paymentStatus })));
                        setRegs(loadedRegs);
                        setRegs(loadedRegs);
                        setTotalPoints(loadedRegs.reduce((acc, r) => acc + r.earnedPoints!, 0));
                        setSyncStatus('connected');
                        setLoading(false);
                    } catch (err: any) {
                        logger.error('UserHub', 'Fallback participation fetch error', err);
                        if (err.message?.includes('insufficient permissions')) {
                            setRegs([]);
                            setSyncStatus('connected');
                        } else {
                            setSyncStatus('disconnected');
                            toast.error("마이페이지 데이터 로드 실패. 새로고침 후 다시 시도해 주세요.");
                        }
                        setLoading(false);
                    }
                })();
                return;
            }

            const qReg = query(collectionGroup(db, 'registrations'), where('userId', '==', user.uid));

            setSyncStatus('syncing');

            unsubscribe = onSnapshot(qReg, async (snapshot: any) => {
                // Success Handler
                try {
                    let fallbackAff = '';
                    const regPromises = snapshot.docs.map(async (docSnap) => {
                        const data = docSnap.data();
                        if (data.userAffiliation) fallbackAff = data.userAffiliation;

                        // [CRITICAL FIX] Safely extract slug with fallback
                        const confSlug = forceString(data.slug || data.conferenceId || data.conferenceSlug || 'kadd_2026spring');
                        let realTitle = forceString(data.conferenceName || confSlug);
                        let socName = forceString(data.societyName);
                        let loc = "장소 정보 없음";
                        let dates = "";
                        let receiptConfig: ReceiptConfig | undefined = undefined;

                        // JOIN 1: Conference Details
                        try {
                            const confQ = query(collection(db, 'conferences'), where('slug', '==', confSlug));
                            const confSnap = await getDocs(confQ);
                            if (!confSnap.empty) {
                                const cData = confSnap.docs[0].data();
                                realTitle = forceString(cData.title);
                                loc = forceString(cData.location || cData.venue);
                                const s = forceString(cData.dates?.start || cData.startDate);
                                const e = forceString(cData.dates?.end || cData.endDate);
                                dates = s === e ? s : `${s} ~ ${e}`;
                                receiptConfig = cData.receipt;
                            }
                        } catch (err) {
                            logger.error('UserHub', `Conference lookup failed for slug: ${confSlug}`, err);
                        }

                        // JOIN 2: Society Name (If missing)
                        if (!socName || socName === 'Unknown') {
                            try {
                                const socDoc = await getDoc(doc(db, 'societies', data.societyId));
                                if (socDoc.exists()) socName = forceString(socDoc.data().name);
                            } catch (err) {
                                // Silently handle society lookup failures
                                logger.debug('UserHub', 'Society lookup failed, using fallback data');
                            }
                        }

                        return {
                            id: docSnap.id,
                            conferenceName: realTitle,
                            societyName: socName,
                            earnedPoints: Number(data.earnedPoints || 0),
                            slug: confSlug,
                            societyId: forceString(data.societyId || 'kadd'),
                            location: loc,
                            dates: dates,
                            paymentStatus: data.paymentStatus,
                            status: data.status || data.paymentStatus, // CANCELED, REFUNDED 등
                            amount: data.amount,
                            receiptNumber: data.id, // Using orderId as receipt number
                            paymentDate: data.createdAt,
                            receiptConfig: receiptConfig,
                            userName: data.userName || user.name || (user as any).displayName
                        };
                    });

                    const loadedRegs = await Promise.all(regPromises);
                    setRegs(loadedRegs);
                    setTotalPoints(loadedRegs.reduce((acc, r) => acc + r.earnedPoints!, 0));

                    setSyncStatus('connected');
                } catch (processError) {
                    logger.error('UserHub', 'Data processing error', processError);
                    setSyncStatus('disconnected');
                }
            }, (error: any) => {
                logger.error('UserHub', 'Snapshot listener error', error);
                setSyncStatus('disconnected');

                // Check if this is an indexing error (permanent failure until index is created)
                const isIndexingError = error.message?.includes('COLLECTION_GROUP_ASC index required') ||
                    error.code === 'failed-precondition';

                if (isIndexingError) {
                    // For indexing errors, don't retry - indexes are being deployed
                    toast.error("인덱스 생성 중입니다. 잠시 후 새로고침 해주세요.");
                    return;
                }

                // For other errors, retry with exponential backoff
                if (realtimeRetryCount.current < MAX_REALTIME_RETRIES) {
                    const backoffMs = 3000 * Math.pow(2, realtimeRetryCount.current);
                    toast.error(`연결 실패. ${backoffMs / 1000}초 후 재연결을 시도합니다.`);

                    if (retryTimer) clearTimeout(retryTimer);
                    retryTimer = setTimeout(() => {
                        realtimeRetryCount.current++;
                        setupRealtimeListener();
                    }, backoffMs);
                } else {
                    // Max retries exceeded
                    toast.error("실시간 데이터 연결이 실패했습니다. 페이지를 새로고침해 주세요.");
                }
            });
        };

        setupRealtimeListener();

        return () => {
            if (unsubscribe) unsubscribe();
            if (retryTimer) clearTimeout(retryTimer);
        };
    }, [user]);

    const fetchUserData = useCallback(async (u: any) => {
        const db = getFirestore();
        setLoading(true);

        let profileData = {
            displayName: forceString(u.userName || u.name || u.displayName),
            phoneNumber: forceString(u.phoneNumber || u.phone),
            affiliation: forceString(u.affiliation || u.org || u.organization),
            licenseNumber: forceString(u.licenseNumber || u.licenseId),
            email: forceString(u.email)
        };

        logger.debug('UserHub', 'Starting profile load', { uid: u.uid });

        try {
            const userDocRef = doc(db, 'users', u.uid);
            const userDocSnap = await getDoc(userDocSnap);
            const hasUserDoc = userDocSnap.exists();

            if (hasUserDoc) {
                const userData = userDocSnap.data();
                logger.debug('UserHub', 'users/{uid} document found', { uid: u.uid });
                profileData = {
                    displayName: forceString(userData.userName || userData.name || profileData.displayName),
                    phoneNumber: forceString(userData.phoneNumber || userData.phone || profileData.phoneNumber),
                    affiliation: forceString(userData.affiliation || userData.org || userData.organization || profileData.affiliation),
                    licenseNumber: forceString(userData.licenseNumber || userData.licenseId || profileData.licenseNumber),
                    email: forceString(userData.email || profileData.email)
                };
            } else {
                logger.debug('UserHub', 'users/{uid} document does not exist, checking participations');
                try {
                    const participationsRef = collection(db, `users/${u.uid}/participations`);
                    const participationsSnap = await getDocs(participationsRef);

                    logger.debug('UserHub', 'Participations query returned', { count: participationsSnap.size });
                    if (!participationsSnap.empty) {
                        const nonMemberParticipation = participationsSnap.docs[0].data();
                        const confSlug = nonMemberParticipation.slug || nonMemberParticipation.conferenceId || nonMemberParticipation.conferenceSlug || 'kadd_2026spring';

                        // [Non-member detection] users/{uid} doesn't exist but participations do
                        setIsNonMemberOnly(true);
                        setNonMemberConferenceSlug(confSlug);
                        logger.debug('UserHub', 'Non-member detected', { uid: u.uid, hasParticipations: participationsSnap.size, confSlug });
                        const firstParticipation = participationsSnap.docs[0].data();

                        profileData = {
                            displayName: forceString(firstParticipation.userName || firstParticipation.name || profileData.displayName),
                            phoneNumber: forceString(firstParticipation.userPhone || firstParticipation.phone || profileData.phoneNumber),
                            affiliation: forceString(firstParticipation.userOrg || firstParticipation.organization || firstParticipation.affiliation || profileData.affiliation),
                            licenseNumber: forceString(firstParticipation.licenseNumber || profileData.licenseNumber),
                            email: forceString(firstParticipation.userEmail || firstParticipation.email || profileData.email)
                        };
                    }
                } catch (partErr) {
                    logger.warn('UserHub', 'Could not get participation data', partErr);
                }
            }
        } catch (docErr: any) {
            logger.error('UserHub', 'Error accessing users/{uid}', { code: docErr.code, message: docErr.message });
        }

        logger.debug('UserHub', 'Final profile data', profileData);
        setProfile(profileData);

        try {
            const snapSoc = await getDocs(collection(db, 'societies'));
            setSocieties(snapSoc.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (socErr) {
            logger.error('UserHub', 'Societies fetch error', socErr);
        }

        try {
            // [Fix] Re-enable abstracts fetching for mypage
            // Query submissions across ALL conferences where user is submitter
            // Use collectionGroup to search conferences/{confId}/submissions
            // [Safety] Use parameter u instead of outer scope user to avoid null reference
            if (!u.uid) {
                logger.warn('UserHub', 'User UID is null, skipping abstracts fetch');
                setAbstracts([]);
                return;
            }

            const submissionsRef = collectionGroup(db, 'submissions');
            const q = query(submissionsRef, where('userId', '==', u.uid), orderBy('submittedAt', 'desc'));
            const snap = await getDocs(q);

            const userAbstracts = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            setAbstracts(userAbstracts);
            logger.debug('UserHub', 'Abstracts fetched', { count: userAbstracts.length });
        } catch (absErr: any) {
            logger.error('UserHub', 'Abstracts fetch error', absErr);
            // 🔧 [FIX] Handle index building gracefully
            if (absErr.message?.includes('index') || absErr.message?.includes('Index')) {
                logger.warn('UserHub', 'Abstracts index is still building, showing empty state');
                setAbstracts([]); // Show empty state without error
                toast('초록 내역이 준비 중입니다. 잠시 후 새로고침해주세요.');
            } else {
                setAbstracts([]); // Failed fetch: show empty state
                toast.error('초록 내역을 불러올 수 없습니다.');
            }
        }

        setLoading(false);
        // setSyncStatus('connected'); // Handled by realtime listener
    }, []);

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
            // Navigate using effect to handle location change properly
            window.location.href = authUrl;
        }
    };

    // [Step 403-D] Dashboard Quick Action: QR Badge
    const handleQrClick = (e: React.MouseEvent, r: UserReg) => {
        e.stopPropagation(); // Prevent card click
        const currentHost = window.location.hostname;
        const targetHost = `${r.societyId}.eregi.co.kr`;

        // [CRITICAL FIX] Safely extract slug with fallback
        const badgeSlug = r.slug || 'kadd_2026spring';
        const cleanPath = `/${badgeSlug}/badge`;

        console.log('[UserHub] Badge click - Registration slug:', r.slug, 'Badge slug:', badgeSlug);

        // CRITICAL FIX: Check if user is already authenticated
        // If Firebase auth has a currentUser, redirect directly without auth page
        const authInstance = getAuth();
        if (authInstance.currentUser) {
            // User is already logged in - direct navigation
            window.location.href = `https://${targetHost}${cleanPath}`;
            return;
        }

        if (currentHost === targetHost || currentHost.includes('localhost')) {
            navigate(cleanPath);
        } else {
            const token = getRootCookie('eregi_session');
            const authUrl = `https://${targetHost}/auth?mode=login&returnUrl=${encodeURIComponent(cleanPath)}${token ? `&token=${token}` : ''}`;
            window.location.href = authUrl;
        }
    };

    const handleReceiptClick = (e: React.MouseEvent, r: UserReg) => {
        e.stopPropagation();
        if (r.paymentStatus !== 'PAID') {
            toast.error("결제 완료된 건만 출력 가능합니다.");
            return;
        }
        // Fallback for config if missing (optional: can hardcode for demo if needed, but better to rely on data)
        if (!r.receiptConfig) {
            toast.error("영수증 설정이 없습니다. 관리자에게 문의하세요.");
            return;
        }
        setSelectedReceiptReg(r);
        setShowReceiptModal(true);
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
            toast.success("인증되었습니다.");
            setShowCertModal(false);
            // No need to call fetchUserData explicitly as onSnapshot handles it.
        } else {
            toast.error(res.message);
        }
    };

    // [Step 404] Seamless Loading: Removed blocking loader for Skeleton UI
    // if (loading) return <LoadingSpinner />;

    const hostname = window.location.hostname;
    const isMain = hostname === 'eregi.co.kr' || hostname.startsWith('www') || hostname.includes('firebaseapp') || hostname.includes('localhost');

    // Dynamic page title based on fetched society name from database
    const getSocietyName = (): string => {
        if (isMain) return ''; // No society prefix for main platform

        // Society name from database with i18n support
        if (society?.name) {
            if (typeof society.name === 'string') {
                return society.name;
            } else if (society.name.ko || society.name.en) {
                // Default to Korean, fallback to English
                return society.name.ko || society.name.en;
            }
        }

        // Fallback to hostname subdomain
        return hostname.split('.')[0];
    };

    const societyName = getSocietyName();
    const pageTitle = isMain ? "통합 마이페이지" : `${societyName} 마이페이지`;

    // [Fix-Step 357] Date Helper
    const formatDate = (date: any) => {
        if (!date) return '-';
        if (date.toDate) return date.toDate().toLocaleDateString(); // Firestore Timestamp 
        if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString(); // JSON 
        return date; // String 
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20 pt-20">
            <EregiNavigation />

            <div className="max-w-4xl mx-auto px-6">
                {/* TITLE & SYNC STATUS */}
                <div className="flex justify-between items-center mb-8 mt-8">
                    <h1 className="text-2xl font-heading-2 text-slate-900">{pageTitle}</h1>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* 1. Conferences Card */}
                    <DataWidget
                        title="My Conferences"
                        value={regs.length}
                        icon={Calendar}
                        loading={loading}
                    />

                    {/* 2. Abstract Card */}
                    <DataWidget
                        title="Submitted Abstracts"
                        value={abstracts.length}
                        icon={FileText}
                        loading={loading}
                    />

                    {/* 3. Points Card */}
                    <DataWidget
                        title="Total Points"
                        value={<><AnimatedCounter value={totalPoints} /> <span className="text-lg font-normal text-blue-200">pts</span></>}
                        icon={Award}
                        loading={loading}
                        variant="primary"
                    />
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
                        {/* 취소된 등록 제외 */}
                        {regs.filter(r => !['CANCELED', 'REFUNDED', 'REFUND_REQUESTED'].includes(r.status || '')).map(r => (

                            <div key={r.id} onClick={() => handleEventClick(r)} className="eregi-card cursor-pointer flex flex-col group animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex flex-col mb-4">
                                    <div className="flex items-center text-sm text-[#24669e] font-bold mb-2">
                                        <span>[{r.societyName}]</span>
                                    </div>
                                    <h3 className="font-heading-3 text-slate-900 mb-2 group-hover:text-[#1b4d77] transition-colors">{r.conferenceName}</h3>
                                    <div className="text-body-sm text-slate-500 flex flex-col gap-1">
                                        <span>📅 {r.dates}</span>
                                        <span>📍 {r.location}</span>
                                    </div>
                                </div>
                                <div className="mt-auto border-t border-slate-100 pt-4 flex items-center justify-between">
                                    <span className={r.earnedPoints ? "bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold" : "bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs"}>
                                        {r.earnedPoints ? `+${r.earnedPoints} pts` : '진행중'}
                                    </span>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/${r.slug}/abstracts`);
                                            }}
                                            className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 shadow-sm border border-slate-200"
                                        >
                                            <FileText size={14} /> 초록 접수/확인
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => handleQrClick(e, r)}
                                            className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 shadow-sm border border-slate-200"
                                        >
                                            <QrCode size={14} /> 등록 확인증 (QR)
                                        </Button>
                                        {r.paymentStatus === 'PAID' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => handleReceiptClick(e, r)}
                                                className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 shadow-sm border border-slate-200"
                                            >
                                                <Printer size={14} /> 영수증
                                            </Button>
                                        )}
                                    </div>
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
                                <div className="bg-white p-5 rounded-xl shadow-sm border-blue-100 flex justify-between items-center">
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

                        {!loading && user?.affiliations && Object.entries(user.affiliations).map(([socId, aff]: [string, any]) => {
                            if (!aff.verified) return null;

                            const soc = societies.find(s => s.id === socId);

                            return (
                                <div key={socId} className="eregi-card flex justify-between items-center bg-blue-50/30 border-blue-100">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-[#e1ecf6] text-[#24669e] rounded-full flex items-center justify-center font-bold text-xl">✓</div>
                                        <div>
                                            <h4 className="font-heading-3 text-slate-900 leading-tight">{forceString(soc?.name || socId)}</h4>
                                            <p className="text-body-sm text-slate-500 flex flex-col gap-1">
                                                {forceString(user.name)} | {forceString(aff.licenseNumber || aff.memberId)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="bg-white border border-blue-100 text-eregi-700 px-3 py-1 rounded text-xs font-bold block mb-1 shadow-sm">
                                            {forceString(aff.grade || '정회원')}
                                        </span>
                                        <p className="text-xs text-blue-600 mt-1">
                                            {aff.expiry || aff.expiryDate ? `유효기간: ${formatDate(aff.expiry || aff.expiryDate)}` : '무기한'}
                                        </p>
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
                        {!loading && abstracts.length === 0 && (
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
                            <div key={abs.id} className="eregi-card hover:border-eregi-200 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-col">
                                        <div className="text-xs font-bold text-eregi-600 mb-1 bg-eregi-50 inline-block px-2 py-0.5 rounded">
                                            [{abs.confId?.toUpperCase() || 'UNKNOWN'}]
                                        </div>
                                        <h3 className="font-heading-3 text-slate-900 mt-2">
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
                                                    const confId = abs.confId;
                                                    if (!confId) {
                                                        toast.error("유효하지 않은 컨퍼런스 ID입니다.");
                                                        return;
                                                    }
                                                    // 1. Delete Firestore Doc
                                                    await deleteDoc(doc(db, `conferences/${confId}/submissions/${abs.id}`));

                                                    // 2. Update Local State
                                                    setAbstracts(prev => prev.filter(p => p.id !== abs.id));
                                                    toast.success("초록이 철회되었습니다.");
                                                } catch (err) {
                                                    logger.error('UserHub', 'Withdraw failed', err);
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
                                {[1, 2, 3, 4, 5].map((i) => (
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
                                    {societies.map((s) => <option key={s.id} value={s.id}>{forceString(s.name) || s.id}</option>)}
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

            {/* Receipt Modal */}
            <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
                <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>영수증 미리보기 (Receipt Preview)</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-6 bg-gray-100 rounded-xl">
                        {selectedReceiptReg && selectedReceiptReg.receiptConfig && (
                            <div ref={receiptRef} className="shadow-2xl bg-white">
                                <ReceiptTemplate
                                    data={{
                                        registrationId: selectedReceiptReg.id,
                                        receiptNumber: selectedReceiptReg.receiptNumber || selectedReceiptReg.id,
                                        paymentDate: selectedReceiptReg.paymentDate ? (selectedReceiptReg.paymentDate.toDate ? selectedReceiptReg.paymentDate.toDate().toLocaleDateString() : new Date().toLocaleDateString()) : new Date().toLocaleDateString(),
                                        payerName: selectedReceiptReg.userName || 'Unknown',
                                        totalAmount: selectedReceiptReg.amount || 0,
                                        items: [
                                            { name: `Conference Registration (${selectedReceiptReg.conferenceName})`, amount: selectedReceiptReg.amount || 0 }
                                        ]
                                    }}
                                    config={selectedReceiptReg.receiptConfig}
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button onClick={() => setShowReceiptModal(false)} variant="secondary">
                            닫기
                        </Button>
                        <PrintHandler
                            contentRef={receiptRef}
                            triggerButton={
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <Printer className="w-4 h-4 mr-2" />
                                    인쇄하기
                                </Button>
                            }
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
export default UserHubPage;
