import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, serverTimestamp, getDoc, collectionGroup, orderBy, updateDoc, deleteDoc, onSnapshot, Timestamp, setDoc, limit } from 'firebase/firestore';
import { useMemberVerification } from '../hooks/useMemberVerification';
import { useAuth } from '../hooks/useAuth';
import { useSociety } from '../hooks/useSociety';
import { functions } from '../firebase';
import { getRootCookie } from '../utils/cookie';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { Calendar, FileText, QrCode, Printer, Award } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ABSTRACT_STATUS } from '@/constants/abstract';
import EregiNavigation from '../components/eregi/EregiNavigation';
import DataWidget from '../components/eregi/DataWidget';
import ReceiptTemplate from '../components/print/ReceiptTemplate';
import PrintHandler from '../components/print/PrintHandler';
import { ReceiptConfig } from '../types/print';
import { logger } from '../utils/logger';
import { CreditCard } from 'lucide-react';
import { Submission, ConferenceUser } from '../types/schema';
import { normalizeUserData } from '../utils/userDataMapper';
import { safeFormatDate } from '../utils/dateUtils';
import { DOMAIN_CONFIG, extractSocietyFromHost } from '../utils/domainHelper';
import { resolveSocietyByIdentifier } from '../utils/societyResolver';

interface Stringable {
    ko?: string;
    en?: string;
    name?: string | Stringable;
    [key: string]: unknown;
}

const forceString = (val: unknown): string => {
    try {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && val !== null) {
            const obj = val as Stringable;
            if (obj.ko) return forceString(obj.ko);
            if (obj.en) return forceString(obj.en);
            if (obj.name) return forceString(obj.name);
            return '';
        }
        return String(val);
    } catch { return ''; }
};

const getSafeConferenceSlug = (slug?: string): string => {
    if (!slug) return '';
    const trimmed = slug.trim();
    if (!trimmed || trimmed === 'unknown') return '';
    return trimmed;
};

const getSocietyIdFromSlug = (slug?: string): string => {
    const safeSlug = getSafeConferenceSlug(slug);
    if (!safeSlug || !safeSlug.includes('_')) return '';
    return safeSlug.split('_')[0] || '';
};

const normalizeSocietyKey = (value: unknown): string => forceString(value).trim().toLowerCase();

const getTimeValue = (d: unknown): number => {
    if (!d) return 0;
    if (typeof d === 'object' && d !== null && 'toMillis' in d && typeof (d as { toMillis?: () => number }).toMillis === 'function') {
        return (d as { toMillis: () => number }).toMillis();
    }
    if (typeof d === 'object' && d !== null && 'toDate' in d && typeof (d as { toDate?: () => Date }).toDate === 'function') {
        return (d as { toDate: () => Date }).toDate().getTime();
    }
    if (d instanceof Date) return d.getTime();
    if (typeof d === 'string') return new Date(d).getTime();
    return 0;
};

const isCanceledLike = (status: unknown): boolean => {
    const raw = forceString(status);
    if (!raw) return false;
    const s = raw.toUpperCase();
    const normalized = s.replace(/[\s-]+/g, '_');
    return [
        'CANCELED',
        'CANCELLED',
        'CANCEL',
        'CANCELLATION',
        'REFUND',
        'REJECT',
        'DENIED',
        'FAILED',
        'EXPIRED',
        'VOID',
        'VOIDED',
        'ABORT',
        'WITHDRAW',
        '취소',
        '환불',
        '거절',
        '실패',
        '만료',
        '무효'
    ].some(k => s.includes(k) || normalized.includes(k));
};

const isPaidLike = (r: UserReg): boolean => {
    const p = forceString(r.paymentStatus).toUpperCase();
    const s = forceString(r.status).toUpperCase();
    const paidKeywords = ['PAID', 'COMPLETED', 'SUCCESS', 'SUCCEEDED', 'APPROVED', 'DONE', '결제완료'];
    return paidKeywords.some((k) => p === k || s === k || p.includes(k) || s.includes(k));
};

const isPendingLike = (r: UserReg): boolean => {
    const p = forceString(r.paymentStatus).toUpperCase();
    const s = forceString(r.status).toUpperCase();
    const allow = ['PENDING', 'READY', 'SUBMITTED', 'PENDING_PAYMENT', 'WAITING_FOR_DEPOSIT', 'WAITING_DEPOSIT', 'DEPOSIT_WAITING', '입금대기'];
    return allow.includes(p) || allow.includes(s);
};

const isVisibleActiveReg = (r: UserReg): boolean => {
    if (isCanceledLike(r.paymentStatus) || isCanceledLike(r.status)) return false;
    return isPaidLike(r) || isPendingLike(r);
};

const pickLatestVisibleReg = (regs: UserReg[]): UserReg | null => {
    if (!regs.length) return null;
    const sorted = [...regs].sort((a, b) => getTimeValue(b.paymentDate) - getTimeValue(a.paymentDate));
    const latestCanceled = sorted.find((r) => isCanceledLike(r.paymentStatus) || isCanceledLike(r.status));
    const latestActive = sorted.find((r) => isVisibleActiveReg(r));

    if (!latestActive) return null;
    if (!latestCanceled) return latestActive;

    const canceledAt = getTimeValue(latestCanceled.paymentDate);
    const activeAt = getTimeValue(latestActive.paymentDate);

    // Conservative rule: if cancel time is unknown or newer/equal, hide from "등록학회"
    if (canceledAt === 0) return null;
    if (activeAt === 0) return null;
    if (activeAt <= canceledAt) return null;

    return latestActive;
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
    amount?: number;
    receiptNumber?: string;
    paymentDate?: Timestamp | Date | string;
    receiptConfig?: ReceiptConfig;
    userName?: string;
    status?: string; // Generic status field from Firestore (PAID, CANCELED, etc.)
    virtualAccount?: {
        bank: string;
        accountNumber: string;
        customerName?: string;
        dueDate?: string;
    };
}

interface Affiliation {
    verified: boolean;
    licenseNumber?: string;
    memberId?: string;
    grade?: string;
    expiry?: string | Timestamp;
    expiryDate?: string | Timestamp;
}

interface ConsentHistoryEntry {
    id: string;
    vendorName: string;
    conferenceId: string;
    conferenceName: string;
    message?: string;
    timestamp?: Timestamp;
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
    const { auth } = useAuth();
    const { user, loading: authLoading } = auth;
    // Fetch society data for dynamic name display
    const { society } = useSociety();

    const [loading, setLoading] = useState(true);
    // [Step 512-Des] Data Highway Feedback
    const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'disconnected'>('syncing');
    const [activeTab, setActiveTab] = useState<'EVENTS' | 'CERTS' | 'PROFILE' | 'ABSTRACTS'>('EVENTS');

    // Receipt Modal State
    const [selectedReceiptReg, setSelectedReceiptReg] = useState<UserReg | null>(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);

    const [regs, setRegs] = useState<UserReg[]>([]);
    const [abstracts, setAbstracts] = useState<Submission[]>([]);
    const [guestbookEntries, setGuestbookEntries] = useState<ConsentHistoryEntry[]>([]);
    const [societyScopeKeys, setSocietyScopeKeys] = useState<Set<string>>(new Set());
    const [scopeResolved, setScopeResolved] = useState(false);
    const healingAttempted = useRef<{ [key: string]: boolean }>({});
    const realtimeRetryCount = useRef(0);
    const MAX_REALTIME_RETRIES = 3;

    useEffect(() => {
        if (authLoading) return;
        // Indexing error handling removed since abstracts query is disabled
    }, [authLoading]);

    const [totalPoints, setTotalPoints] = useState(0);
    const [societies, setSocieties] = useState<Array<{ id: string; name: string | { ko?: string; en?: string };[key: string]: unknown }>>([]);

    // Profile
    const [profile, setProfile] = useState({ displayName: '', phoneNumber: '', affiliation: '', licenseNumber: '', email: '' });
    const [profileSaving, setProfileSaving] = useState(false);

    // Modal State
    const [showCertModal, setShowCertModal] = useState(false);
    const [showVirtualAccountModal, setShowVirtualAccountModal] = useState(false);
    const [verifyForm, setVerifyForm] = useState({ societyId: "", name: "", code: "" });
    const [isSocLocked, setIsSocLocked] = useState(false);
    // State for Virtual Account Modal
    const [selectedVirtualAccountReg, setSelectedVirtualAccountReg] = useState<UserReg | null>(null);
    // [Fix-Step 263] Use Hook
    const { verifyMember, loading: verifyLoading } = useMemberVerification();
    const verifyFormInitializedRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        const initSocietyScope = async () => {
            if (!cancelled) {
                setScopeResolved(false);
                setRegs([]);
            }
            const hostSociety = extractSocietyFromHost(window.location.hostname);
            const scopedSocietyFromQuery = normalizeSocietyKey(searchParams.get('scopeSociety'));
            const highlightSlug = getSafeConferenceSlug(searchParams.get('highlight') || '');

            let inferredSocietyFromHighlight = '';
            if (highlightSlug) {
                try {
                    const confById = await getDoc(doc(getFirestore(), 'conferences', highlightSlug));
                    if (confById.exists()) {
                        inferredSocietyFromHighlight = normalizeSocietyKey((confById.data() as { societyId?: string }).societyId);
                    } else {
                        const q = query(
                            collection(getFirestore(), 'conferences'),
                            where('slug', '==', highlightSlug),
                            limit(1)
                        );
                        const snap = await getDocs(q);
                        if (!snap.empty) {
                            inferredSocietyFromHighlight = normalizeSocietyKey((snap.docs[0].data() as { societyId?: string }).societyId);
                        }
                    }
                } catch {
                    inferredSocietyFromHighlight = '';
                }
            }

            const seedSociety = scopedSocietyFromQuery || hostSociety || inferredSocietyFromHighlight;
            if (!seedSociety) {
                if (!cancelled) {
                    setSocietyScopeKeys(new Set());
                    setScopeResolved(true);
                }
                return;
            }

            try {
                const resolved = await resolveSocietyByIdentifier(seedSociety);
                if (cancelled) return;

                const keys = new Set<string>();
                keys.add(normalizeSocietyKey(seedSociety));

                if (resolved) {
                    keys.add(normalizeSocietyKey(resolved.id));
                    keys.add(normalizeSocietyKey((resolved.data as { domainCode?: string }).domainCode));
                    const aliases = (resolved.data as { aliases?: string[] }).aliases;
                    if (Array.isArray(aliases)) {
                        aliases.forEach((a) => keys.add(normalizeSocietyKey(a)));
                    }
                }

                setSocietyScopeKeys(new Set(Array.from(keys).filter(Boolean)));
            } catch {
                if (!cancelled) {
                    setSocietyScopeKeys(new Set([normalizeSocietyKey(seedSociety)]));
                }
            } finally {
                if (!cancelled) {
                    setScopeResolved(true);
                }
            }
        };

        initSocietyScope();

        return () => {
            cancelled = true;
        };
    }, [searchParams]);

    const isInSocietyScope = useCallback((societyId?: string, slug?: string) => {
        if (!scopeResolved) return false;
        if (!societyScopeKeys.size) return true;
        const candidates = [
            normalizeSocietyKey(societyId),
            normalizeSocietyKey(getSocietyIdFromSlug(slug))
        ].filter(Boolean);
        return candidates.some((c) => societyScopeKeys.has(c));
    }, [societyScopeKeys, scopeResolved]);

    const fetchUserData = useCallback(async (u: ConferenceUser) => {
        const db = getFirestore();
        setLoading(true);

        // Initial profile from auth user
        let profileData = {
            displayName: u.name,
            phoneNumber: u.phone,
            affiliation: u.organization,
            licenseNumber: u.licenseNumber || '',
            email: u.email
        };

        logger.debug('UserHub', 'Starting profile load', { uid: u.id });

        try {
            const userDocSnap = await getDoc(doc(db, 'users', u.id));
            const hasUserDoc = userDocSnap.exists();

            if (hasUserDoc) {
                const rawData = userDocSnap.data();
                logger.debug('UserHub', 'users/{uid} document found', { uid: u.id });

                const normalized = normalizeUserData({ ...rawData, id: u.id });

                profileData = {
                    displayName: normalized.name || profileData.displayName,
                    phoneNumber: normalized.phone || profileData.phoneNumber,
                    affiliation: normalized.organization || profileData.affiliation,
                    licenseNumber: normalized.licenseNumber || profileData.licenseNumber,
                    email: normalized.email || profileData.email
                };
            } else {
                logger.debug('UserHub', 'users/{uid} document does not exist, checking participations');
                try {
                    const participationsRef = collection(db, `users/${u.id}/participations`);
                    const participationsSnap = await getDocs(participationsRef);

                    logger.debug('UserHub', 'Participations query returned', { count: participationsSnap.size });
                    if (!participationsSnap.empty) {
                        const nonMemberParticipation = participationsSnap.docs[0].data();
                        const confSlug = forceString(
                            nonMemberParticipation.slug ||
                            nonMemberParticipation.conferenceId ||
                            nonMemberParticipation.conferenceSlug
                        );

                        // [Non-member detection] users/{uid} doesn't exist but participations do
                        logger.debug('UserHub', 'Non-member detected', { uid: u.id, hasParticipations: participationsSnap.size, confSlug });

                        const normalizedPart = normalizeUserData(nonMemberParticipation);

                        profileData = {
                            displayName: normalizedPart.name || profileData.displayName,
                            phoneNumber: normalizedPart.phone || profileData.phoneNumber,
                            affiliation: normalizedPart.organization || profileData.affiliation,
                            licenseNumber: normalizedPart.licenseNumber || profileData.licenseNumber,
                            email: normalizedPart.email || profileData.email
                        };
                    }
                } catch (partErr) {
                    logger.warn('UserHub', 'Could not get participation data', partErr);
                }
            }
        } catch (docErr) {
            const errorCode = docErr instanceof Error && 'code' in docErr ? (docErr as { code?: string }).code : undefined;
            const errorMessage = docErr instanceof Error ? docErr.message : String(docErr);
            logger.error('UserHub', 'Error accessing users/{uid}', { code: errorCode, message: errorMessage });
        }

        logger.debug('UserHub', 'Final profile data', profileData);
        setProfile(profileData);

        try {
            const snapSoc = await getDocs(collection(db, 'societies'));
            setSocieties(snapSoc.docs.map(d => ({ id: d.id, ...d.data() })) as any);
        } catch (socErr) {
            logger.error('UserHub', 'Societies fetch error', socErr);
        }

        try {
            // [Fix] Re-enable abstracts fetching for mypage
            // Query submissions across ALL conferences where user is submitter
            // Use collectionGroup to search conferences/{confId}/submissions
            // [Safety] Use parameter u instead of outer scope user to avoid null reference
            const queryUserId = forceString(u.id || u.uid);
            if (!queryUserId) {
                logger.warn('UserHub', 'User UID is null, skipping abstracts fetch');
                setAbstracts([]);
                setLoading(false);
                return;
            }

            const submissionsRef = collectionGroup(db, 'submissions');
            const q = query(submissionsRef, where('userId', '==', queryUserId), orderBy('submittedAt', 'desc'));
            const snap = await getDocs(q);

            const userAbstracts = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            const scopedAbstracts = (userAbstracts as Array<Record<string, unknown>>).filter((absData) => {
                const absSlug = forceString(
                    absData.slug || absData.conferenceSlug || absData.confId || absData.conferenceId
                );
                const absSociety = forceString(absData.societyId || getSocietyIdFromSlug(absSlug));
                return isInSocietyScope(absSociety, absSlug);
            });

            setAbstracts(scopedAbstracts as any);
            logger.debug('UserHub', 'Abstracts fetched', { count: scopedAbstracts.length });
        } catch (absErr) {
            logger.error('UserHub', 'Abstracts fetch error', absErr);
            const errorMsg = absErr instanceof Error ? absErr.message : String(absErr);
            if (errorMsg?.includes('index') || errorMsg?.includes('Index')) {
                logger.warn('UserHub', 'Abstracts index is still building, showing empty state');
                setAbstracts([]);
                toast('초록 내역이 준비 중입니다. 잠시 후 새로고침해주세요.');
            } else {
                setAbstracts([]);
                toast.error('초록 내역을 불러올 수 없습니다.');
            }
        }

        try {
            let rawEntries: Array<{
                id: string;
                vendorName?: string;
                conferenceId?: string;
                message?: string;
                timestamp?: Timestamp;
            }> = [];

            try {
                const guestbookRef = collectionGroup(db, 'guestbook_entries');
                const guestbookQuery = query(guestbookRef, where('userId', '==', u.id));
                const guestbookSnap = await getDocs(guestbookQuery);
                rawEntries = guestbookSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Array<{
                    id: string;
                    vendorName?: string;
                    conferenceId?: string;
                    message?: string;
                    timestamp?: Timestamp;
                }>;
            } catch (indexErr) {
                const indexMsg = indexErr instanceof Error ? indexErr.message : String(indexErr);
                if (!indexMsg.includes('COLLECTION_GROUP_ASC index')) {
                    throw indexErr;
                }

                // Fallback without collection-group index: query each participated conference subcollection.
                const participationsSnap = await getDocs(collection(db, `users/${u.id}/participations`));
                const confIds = Array.from(new Set(
                    participationsSnap.docs
                        .map((d) => forceString(d.data().slug || d.data().conferenceId || d.data().conferenceSlug))
                        .filter(Boolean)
                ));

                const confGuestbookSnaps = await Promise.all(
                    confIds.map(async (confId) => {
                        try {
                            const confQ = query(collection(db, `conferences/${confId}/guestbook_entries`), where('userId', '==', u.id));
                            return await getDocs(confQ);
                        } catch {
                            return null;
                        }
                    })
                );

                rawEntries = confGuestbookSnaps
                    .filter((s): s is NonNullable<typeof s> => !!s)
                    .flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))) as Array<{
                        id: string;
                        vendorName?: string;
                        conferenceId?: string;
                        message?: string;
                        timestamp?: Timestamp;
                    }>;
            }

            const confIds = Array.from(new Set(rawEntries.map(e => forceString(e.conferenceId)).filter(Boolean)));
            const confNameMap = new Map<string, string>();
            const confSocietyMap = new Map<string, string>();

            await Promise.all(confIds.map(async (confId) => {
                try {
                    const confSnap = await getDoc(doc(db, 'conferences', confId));
                    if (confSnap.exists()) {
                        const confData = confSnap.data() as { title?: unknown; societyId?: string };
                        confNameMap.set(confId, forceString(confData.title) || confId);
                        confSocietyMap.set(confId, forceString(confData.societyId) || getSocietyIdFromSlug(confId));
                    } else {
                        confNameMap.set(confId, confId);
                        confSocietyMap.set(confId, getSocietyIdFromSlug(confId));
                    }
                } catch {
                    confNameMap.set(confId, confId);
                    confSocietyMap.set(confId, getSocietyIdFromSlug(confId));
                }
            }));

            const entries: ConsentHistoryEntry[] = rawEntries.map((entry) => {
                const confId = forceString(entry.conferenceId);
                return {
                    id: entry.id,
                    vendorName: forceString(entry.vendorName) || 'Unknown Booth',
                    conferenceId: confId,
                    conferenceName: confNameMap.get(confId) || confId,
                    message: forceString(entry.message),
                    timestamp: entry.timestamp
                };
            }).filter((entry) => isInSocietyScope(confSocietyMap.get(entry.conferenceId), entry.conferenceId));
            entries.sort((a, b) => {
                const at = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                const bt = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                return bt - at;
            });
            setGuestbookEntries(entries);
        } catch (guestErr) {
            logger.error('UserHub', 'Guestbook fetch error', guestErr);
            setGuestbookEntries([]);
        }

        setLoading(false);
        // setSyncStatus('connected'); // Handled by realtime listener
    }, [isInSocietyScope]);

    // Initialize verifyForm with user name when user data changes

    useLayoutEffect(() => {
        if (!authLoading && user && !verifyFormInitializedRef.current) {
            const initialName = forceString(user.name || (user as { displayName?: string }).displayName);
            requestAnimationFrame(() => {
                setVerifyForm(prev => ({ ...prev, name: initialName }));
            });
            verifyFormInitializedRef.current = true;
        }
    }, [user, authLoading]);

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


    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                window.location.href = `/auth?mode=login&returnUrl=${encodeURIComponent(window.location.pathname)}`;
                return;
            }
            logger.debug('UserHub', 'User object from auth', { uid: user.uid || user.id });

            // Wrap setState in a callback to avoid direct setState in effect
            requestAnimationFrame(() => {
                fetchUserData(user);
            });

            if (user.affiliations) {
                Object.entries(user.affiliations).forEach(async ([socId, aff]: [string, { verified?: boolean; expiry?: string; expiryDate?: string; licenseNumber?: string }]) => {
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
                                    user.name || (user as { displayName?: string }).displayName,
                                    aff.licenseNumber,
                                    true,
                                    5,
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

    const validateCurrentAffiliationRef = useRef<(user: { uid: string; name?: string; displayName?: string; userName?: string; affiliations?: { [key: string]: { verified?: boolean; licenseNumber?: string; code?: string; memberId?: string } } }) => Promise<void> | null>(null);

    useEffect(() => {
        if (user && !authLoading && validateCurrentAffiliationRef.current) {
            validateCurrentAffiliationRef.current(user);
        }
    }, [user, authLoading]);

    const validateCurrentAffiliation = useCallback(async (u: { uid: string; name?: string; displayName?: string; userName?: string; affiliations?: { [key: string]: { verified?: boolean; licenseNumber?: string; code?: string; memberId?: string } } }): Promise<void> => {
        if (!u.affiliations) return;
        const db = getFirestore();

        for (const [socId, aff] of Object.entries(u.affiliations)) {
            const castAff = aff as { verified?: boolean; licenseNumber?: string; code?: string; memberId?: string };
            if (castAff.verified) {
                try {
                    const codeToUse = castAff.licenseNumber || castAff.code || castAff.memberId;
                    if (!codeToUse) continue;

                    const verifyFn = httpsCallable(functions, 'verifyMemberIdentity');
                    const { data } = await verifyFn({
                        societyId: socId,
                        name: u.name || u.displayName || u.userName,
                        code: codeToUse,
                        lockNow: false
                    }) as { data: { success: boolean; message?: string } };

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

                        // [PERF] Step 1: Extract unique confSlugs and societyIds to batch-fetch
                        const participationData = snapshot.docs.map(docSnap => ({
                            docSnap,
                            data: docSnap.data(),
                            confSlug: forceString(docSnap.data().slug || docSnap.data().conferenceId || docSnap.data().conferenceSlug)
                        })).filter(p => !!p.confSlug);

                        const uniqueConfSlugs = [...new Set(participationData.map(p => p.confSlug))];
                        const uniqueSocietyIds = [...new Set(participationData.map(p => {
                            const d = p.data;
                            let sid = d.societyId as string;
                            if (!sid || sid === 'unknown') {
                                sid = p.confSlug.includes('_') ? p.confSlug.split('_')[0] : '';
                            }
                            return sid as string;
                        }).filter(Boolean))];

                        // [PERF] Step 2: Batch fetch all unique conferences and societies in parallel
                        const [confDocs, societyDocs] = await Promise.all([
                            Promise.all(uniqueConfSlugs.map(async (slug) => {
                                const byId = await getDoc(doc(db, 'conferences', slug));
                                if (byId.exists()) return byId.data();

                                const bySlugQ = query(collection(db, 'conferences'), where('slug', '==', slug), limit(1));
                                const bySlugSnap = await getDocs(bySlugQ);
                                if (!bySlugSnap.empty) return bySlugSnap.docs[0].data();
                                return null;
                            })),
                            Promise.all(uniqueSocietyIds.map(sid => getDoc(doc(db, 'societies', sid))))
                        ]);

                        // [PERF] Step 3: Build lookup Maps (O(1) access)
                        const confCache = new Map<string, any>();
                        confDocs.forEach((confData, i) => {
                            if (confData) confCache.set(uniqueConfSlugs[i], confData);
                        });

                        const societyCache = new Map<string, any>();
                        societyDocs.forEach((snap, i) => {
                            if (snap.exists()) societyCache.set(uniqueSocietyIds[i], snap.data());
                        });

                        // [Fix] Fetch actual registration docs to ensure we have the real status
                        // Since participations might not be updated when admin cancels
                        const regDocs = await Promise.all(
                            participationData.map(p => getDoc(doc(db, `conferences/${p.confSlug}/registrations/${p.docSnap.id}`)).catch(() => null))
                        );
                        const regCache = new Map<string, any>();
                        regDocs.forEach(snap => {
                            if (snap && snap.exists()) regCache.set(snap.id, snap.data());
                        });


                        // [PERF] Step 4: Map registrations using cached data (no more per-item Firestore calls)
                        const loadedRegs: Array<UserReg | null> = participationData.map(({ docSnap, data, confSlug }) => {
                            const cData = confCache.get(confSlug) as ({ societyId?: string;[key: string]: unknown }) | undefined;

                            let realTitle = forceString(data.conferenceName || confSlug);
                            let socName = forceString(data.societyName);
                            let loc = '장소 정보 없음';
                            let dates = '';
                            let receiptConfig: ReceiptConfig | undefined = undefined;

                            if (cData) {
                                realTitle = forceString((cData as any).title?.ko || (cData as any).title?.en || (cData as any).title || (cData as any).slug);

                                const dateStart = (cData as any).dates?.start || (cData as any).startDate || (cData as any).dates?.startDate;
                                const dateEnd = (cData as any).dates?.end || (cData as any).endDate;
                                const s = safeFormatDate(dateStart);
                                const e = safeFormatDate(dateEnd);
                                dates = s === e ? s : `${s} ~ ${e}`;

                                const venueName = (cData as any).venue?.name || (cData as any).venueName;
                                const venueAddress = (cData as any).venue?.address || (cData as any).venueAddress;
                                loc = venueName ? forceString(venueName) : (venueAddress ? forceString(venueAddress) : '장소 정보 없음');
                                receiptConfig = (cData as any).receipt as ReceiptConfig | undefined;
                            }

                            let societyId = data.societyId as string;
                            if (!societyId || societyId === 'unknown') {
                                societyId = (cData?.societyId as string) || (confSlug.includes('_') ? confSlug.split('_')[0] : '');
                            }

                            const socData = societyCache.get(societyId);
                            if (socData?.name) {
                                if (typeof socData.name === 'string') {
                                    socName = socData.name;
                                } else if ((socData.name as Record<string, string>).ko || (socData.name as Record<string, string>).en) {
                                    socName = (socData.name as Record<string, string>).ko || (socData.name as Record<string, string>).en || '';
                                }
                            }

                            const realReg = regCache.get(docSnap.id);
                            const currentPaymentStatus = realReg?.paymentStatus || data.paymentStatus;
                            const currentStatus = realReg?.status || data.status;

                            return {
                                id: docSnap.id,
                                conferenceName: realTitle,
                                societyName: socName,
                                earnedPoints: Number(data.earnedPoints || 0),
                                slug: forceString(data.slug || data.conferenceId || data.conferenceSlug || confSlug),
                                societyId: forceString(data.societyId === 'unknown' ? cData?.societyId || societyId || '' : data.societyId || cData?.societyId || societyId || ''),
                                location: loc,
                                dates,
                                paymentStatus: currentPaymentStatus,
                                amount: data.amount,
                                receiptNumber: data.id,
                                names: data.names,
                                paymentDate: data.createdAt || data.updatedAt || data.registeredAt,
                                receiptConfig,
                                userName: data.userName || user.name || (user as { displayName?: string }).displayName,
                                status: currentStatus,
                                virtualAccount: data.virtualAccount
                            } as UserReg;
                        });

                        const validRegs = loadedRegs.filter((r) => r !== null) as UserReg[];
                        logger.debug('UserHub', 'Batch-loaded registrations', { total: snapshot.size, valid: validRegs.length });

                        // [Fix] Advanced Deduplication & Filtering Strategy (Fallback)
                        const grouped = new Map<string, UserReg[]>();
                        validRegs.forEach(r => {
                            if (!grouped.has(r.slug)) grouped.set(r.slug, []);
                            grouped.get(r.slug)!.push(r);
                        });

                        const activeRegs: UserReg[] = [];

                        grouped.forEach((groupedRegs) => {
                            const visibleReg = pickLatestVisibleReg(groupedRegs);
                            if (visibleReg) activeRegs.push(visibleReg);
                        });


                        const visibleRegs = activeRegs.filter(isVisibleActiveReg);
                        const scopedRegs = visibleRegs.filter((r) => isInSocietyScope(r.societyId, r.slug));
                        setRegs(scopedRegs);
                        setTotalPoints(scopedRegs.reduce((acc, r) => acc + (r.earnedPoints ?? 0), 0));
                        setSyncStatus('connected');
                        setLoading(false);
                    } catch (err) {
                        logger.error('UserHub', 'Fallback participation fetch error', err);
                        if (err instanceof Error && err.message?.includes('insufficient permissions')) {
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

            unsubscribe = onSnapshot(qReg, async (snapshot) => {
                try {
                    // [PERF] Batch fetch all unique conferences & societies in parallel
                    const enrichedDocs = snapshot.docs.map(docSnap => ({
                        docSnap,
                        data: docSnap.data(),
                        confSlug: forceString(docSnap.data().slug || docSnap.data().conferenceId || docSnap.data().conferenceSlug)
                    })).filter(p => !!p.confSlug);

                    const uniqueConfSlugs = [...new Set(enrichedDocs.map(p => p.confSlug))];
                    const uniqueSocIds = [...new Set(enrichedDocs.map(p => {
                        const d = p.data;
                        let sid = d.societyId as string;
                        if (!sid || sid === 'unknown') sid = p.confSlug.includes('_') ? p.confSlug.split('_')[0] : '';
                        return sid;
                    }).filter(Boolean))];

                    const [confDocs, socDocs] = await Promise.all([
                        Promise.all(uniqueConfSlugs.map(async (slug) => {
                            const byId = await getDoc(doc(db, 'conferences', slug));
                            if (byId.exists()) return byId.data();

                            const bySlugQ = query(collection(db, 'conferences'), where('slug', '==', slug), limit(1));
                            const bySlugSnap = await getDocs(bySlugQ);
                            if (!bySlugSnap.empty) return bySlugSnap.docs[0].data();
                            return null;
                        })),
                        Promise.all(uniqueSocIds.map(sid => getDoc(doc(db, 'societies', sid))))
                    ]);

                    const confCache = new Map<string, any>();
                    confDocs.forEach((confData, i) => { if (confData) confCache.set(uniqueConfSlugs[i], confData); });

                    const socCache = new Map<string, any>();
                    socDocs.forEach((snap, i) => { if (snap.exists()) socCache.set(uniqueSocIds[i], snap.data()); });

                    const validRegs: UserReg[] = enrichedDocs.map(({ docSnap, data, confSlug }) => {
                        const cData = confCache.get(confSlug) as ({ societyId?: string;[key: string]: unknown }) | undefined;

                        let realTitle = forceString(data.conferenceName || confSlug);
                        let socName = forceString(data.societyName);
                        let loc = '장소 정보 없음';
                        let dates = '';
                        let receiptConfig: ReceiptConfig | undefined = undefined;

                        if (cData) {
                            realTitle = forceString((cData as any).title?.ko || (cData as any).title?.en || (cData as any).title);
                            const venueName = (cData as any).venue?.name || (cData as any).venueName;
                            const venueAddress = (cData as any).venue?.address || (cData as any).venueAddress;
                            loc = venueName ? forceString(venueName) : (venueAddress ? forceString(venueAddress) : '장소 정보 없음');

                            const dateStart = (cData as any).dates?.start || (cData as any).startDate || (cData as any).dates?.startDate;
                            const dateEnd = (cData as any).dates?.end || (cData as any).endDate;
                            const s = safeFormatDate(dateStart);
                            const e = safeFormatDate(dateEnd);
                            dates = s === e ? s : `${s} ~ ${e}`;
                            receiptConfig = (cData as any).receipt as ReceiptConfig | undefined;
                        }

                        let societyId = data.societyId as string;
                        if (!societyId || societyId === 'unknown') {
                            societyId = (cData?.societyId as string) || (confSlug.includes('_') ? confSlug.split('_')[0] : '');
                        }

                        const socData = socCache.get(societyId);
                        if (!socName || socName === 'Unknown') {
                            if (socData?.name) {
                                if (typeof socData.name === 'string') {
                                    socName = socData.name;
                                } else if ((socData.name as Record<string, string>).ko || (socData.name as Record<string, string>).en) {
                                    socName = (socData.name as Record<string, string>).ko || (socData.name as Record<string, string>).en || '';
                                }
                            }
                        }

                        return {
                            id: docSnap.id,
                            conferenceName: realTitle,
                            societyName: socName,
                            earnedPoints: Number(data.earnedPoints || 0),
                            slug: forceString(data.slug || data.conferenceId || data.conferenceSlug || confSlug),
                            societyId: forceString(data.societyId === 'unknown' ? cData?.societyId || societyId || '' : data.societyId || cData?.societyId || societyId || ''),
                            location: loc,
                            dates,
                            paymentStatus: data.paymentStatus,
                            amount: data.amount,
                            receiptNumber: data.id,
                            names: data.names,
                            paymentDate: data.createdAt || data.updatedAt || data.registeredAt,
                            receiptConfig,
                            userName: data.userName || user.name || (user as { displayName?: string }).displayName,
                            status: data.status,
                            virtualAccount: data.virtualAccount
                        } as UserReg;
                    });

                    // [Fix] Advanced Deduplication & Filtering Strategy (Realtime)
                    const grouped = new Map<string, UserReg[]>();
                    validRegs.forEach(r => {
                        if (!grouped.has(r.slug)) grouped.set(r.slug, []);
                        grouped.get(r.slug)!.push(r);
                    });

                    const activeRegs: UserReg[] = [];

                    grouped.forEach((groupedRegs) => {
                        const visibleReg = pickLatestVisibleReg(groupedRegs);
                        if (visibleReg) activeRegs.push(visibleReg);
                    });

                    const visibleRegs = activeRegs.filter(isVisibleActiveReg);
                    const scopedRegs = visibleRegs.filter((r) => isInSocietyScope(r.societyId, r.slug));
                    setRegs(scopedRegs);
                    setTotalPoints(scopedRegs.reduce((acc, r) => acc + (r.earnedPoints ?? 0), 0));

                    setSyncStatus('connected');
                } catch (processError) {
                    logger.error('UserHub', 'Data processing error', processError);
                    setSyncStatus('disconnected');
                }
            }, (error) => {
                logger.error('UserHub', 'Snapshot listener error', error);
                setSyncStatus('disconnected');

                const errorMsg = error instanceof Error ? error.message : String(error);
                const errorCode = (error as { code?: string }).code;

                const isIndexingError = errorMsg?.includes('COLLECTION_GROUP_ASC index required') ||
                    errorCode === 'failed-precondition';

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
    }, [user, isInSocietyScope]);

    const handleEventClick = (r: UserReg) => {
        const currentHost = window.location.hostname;
        const eventSlug = getSafeConferenceSlug(r.slug);
        const fallbackSocietyFromHost = extractSocietyFromHost(currentHost);
        const safeSocietyId = forceString(
            r.societyId && r.societyId !== 'unknown'
                ? r.societyId
                : getSocietyIdFromSlug(eventSlug) || fallbackSocietyFromHost
        );
        const targetHost = safeSocietyId ? `${safeSocietyId}.${DOMAIN_CONFIG.BASE_DOMAIN}` : currentHost;
        const cleanPath = eventSlug ? `/${eventSlug}` : '/mypage';

        if (currentHost === targetHost || currentHost.includes('localhost')) {
            navigate(cleanPath);
        } else {
            // CLEAN AUTH URL - NO SLUG
            // [Step 403-D] Pass token via URL for bulletproof session bridge
            const token = getRootCookie('eregi_session');
            const authUrl = `https://${targetHost}/auth?mode=login&returnUrl=${encodeURIComponent(cleanPath)}${token ? `&token=${token}` : ''}`;
            window.location.replace(authUrl);
        }
    };

    // [Step 403-D] Dashboard Quick Action: QR Badge
    const handleQrClick = (e: React.MouseEvent, r: UserReg) => {
        e.stopPropagation(); // Prevent card click
        const currentHost = window.location.hostname;
        // [CRITICAL FIX] Use societyId from registration, fallback to DOMAIN_CONFIG.DEFAULT_SOCIETY if 'unknown'
        const safeSocietyId = r.societyId && r.societyId !== 'unknown' ? r.societyId : DOMAIN_CONFIG.DEFAULT_SOCIETY;
        const targetHost = `${safeSocietyId}.${DOMAIN_CONFIG.BASE_DOMAIN}`;

        // [CRITICAL FIX] Safely extract slug with fallback
        const badgeSlug = getSafeConferenceSlug(r.slug);
        if (!badgeSlug) {
            toast.error('학술대회 정보가 없어 디지털 명찰로 이동할 수 없습니다.');
            return;
        }
        const cleanPath = `/${badgeSlug}/badge`;

        console.log('[UserHub] Badge click - Registration slug:', r.slug, 'Badge slug:', badgeSlug, 'Society ID:', safeSocietyId);

        // CRITICAL FIX: Check if user is already authenticated
        // If Firebase auth has a currentUser, redirect directly without auth page
        const authInstance = getAuth();
        if (authInstance.currentUser) {
            window.location.replace(`https://${targetHost}${cleanPath}`);
            return;
        }

        if (currentHost === targetHost || currentHost.includes('localhost')) {
            navigate(cleanPath);
        } else {
            const token = getRootCookie('eregi_session');
            const authUrl = `https://${targetHost}/auth?mode=login&returnUrl=${encodeURIComponent(cleanPath)}${token ? `&token=${token}` : ''}`;
            window.location.replace(authUrl);
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

    const handleOpenModal = () => {
        const hostname = window.location.hostname;
        const isMain = hostname === DOMAIN_CONFIG.BASE_DOMAIN || hostname.startsWith('www') || hostname.includes('firebaseapp') || hostname.includes('localhost');
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
        const res = await verifyMember(societyId, name, code, true, 5, true);

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

    const handleProfileFieldChange = (field: 'displayName' | 'phoneNumber' | 'affiliation' | 'licenseNumber', value: string) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveProfile = async () => {
        if (!user?.uid) return;
        setProfileSaving(true);
        try {
            const db = getFirestore();
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                name: profile.displayName || '',
                phone: profile.phoneNumber || '',
                organization: profile.affiliation || '',
                licenseNumber: profile.licenseNumber || '',
                email: profile.email || user.email || '',
                updatedAt: serverTimestamp()
            }, { merge: true });
            toast.success('기본 정보가 저장되었습니다.');
        } catch (error) {
            logger.error('UserHub', 'Profile save failed', error);
            toast.error('기본 정보 저장에 실패했습니다.');
        } finally {
            setProfileSaving(false);
        }
    };

    // [Step 404] Seamless Loading: Removed blocking loader for Skeleton UI
    // if (loading) return <LoadingSpinner />;

    const hostname = window.location.hostname;
    const isMain = hostname === DOMAIN_CONFIG.BASE_DOMAIN || hostname.startsWith('www') || hostname.includes('firebaseapp') || hostname.includes('localhost');
    const visibleRegs = regs.filter(isVisibleActiveReg);

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

    const formatDate = (date: any): string => {
        return safeFormatDate(date, 'ko-KR');
    };

    return (
        <div className="min-h-screen bg-[#f0f5fa] pb-20 pt-20">
            <EregiNavigation />

            <div className="max-w-5xl mx-auto px-3 sm:px-6">
                {/* TITLE & SYNC STATUS */}
                <div className="mb-8 mt-8 rounded-2xl border border-[#c3daee] bg-white px-5 py-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-[#003366] uppercase mb-1">My eRegi</p>
                            <h1 className="text-2xl font-heading-2 text-slate-900">{pageTitle}</h1>
                            <p className="text-sm text-slate-500 mt-1">등록, 초록, 인증, 개인정보 제공 이력을 한 화면에서 확인할 수 있습니다.</p>
                        </div>
                        <div className="flex items-center gap-4">
                        {/* [Step 512-Des] Sync Status Indicator */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-gray-100 shadow-sm">
                            <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${syncStatus === 'connected' ? 'bg-green-500' :
                                syncStatus === 'syncing' ? 'bg-[#003366] animate-pulse' :
                                    'bg-amber-500'
                                }`} />
                            <span className="text-[10px] font-mono font-medium text-gray-400 uppercase tracking-wider">
                                {syncStatus === 'connected' ? 'Data Live' :
                                    syncStatus === 'syncing' ? 'Syncing...' : 'Offline'}
                            </span>
                        </div>
                    </div>
                </div>
                </div>

                {/* [REMOVED] Guest Warning Banner - Anonymous registration deprecated
                    See docs/ANONYMOUS_CLEANUP_ANALYSIS.md for details
                    All users now have full accounts with email/password authentication */}

                {/* INFO WIDGET GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
                <div className="mb-6 overflow-x-auto no-scrollbar min-w-0">
                    <div className="inline-flex w-full min-w-max gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
                    <button onClick={() => setActiveTab('EVENTS')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${activeTab === 'EVENTS' ? 'bg-[#003366] text-white shadow-sm' : 'text-gray-600 hover:bg-slate-100'}`}>등록학회</button>
                    <button onClick={() => setActiveTab('ABSTRACTS')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${activeTab === 'ABSTRACTS' ? 'bg-[#003366] text-white shadow-sm' : 'text-gray-600 hover:bg-slate-100'}`}>초록 내역</button>
                    {/* [SIMPLIFIED] Anonymous check removed - all users have full accounts */}
                    <button onClick={() => setActiveTab('CERTS')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${activeTab === 'CERTS' ? 'bg-[#003366] text-white shadow-sm' : 'text-gray-600 hover:bg-slate-100'}`}>학회 인증</button>
                    <button onClick={() => setActiveTab('PROFILE')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${activeTab === 'PROFILE' ? 'bg-[#003366] text-white shadow-sm' : 'text-gray-600 hover:bg-slate-100'}`}>내 정보</button>
                    </div>
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
                        {!loading && visibleRegs.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-xl border-2 border-dashed border-gray-200 text-center">
                                <div className="w-20 h-20 bg-[#f0f5fa] rounded-full flex items-center justify-center mb-6">
                                    <Calendar className="w-10 h-10 text-[#c3daee]" />
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
                        {visibleRegs.map(r => (
                            <div key={r.id} onClick={() => handleEventClick(r)} className="eregi-card cursor-pointer flex flex-col group animate-in fade-in slide-in-from-bottom-2 duration-500 border border-slate-200 bg-white/95 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                <div className="flex flex-col mb-4">
                                    <div className="flex items-center text-sm text-[#003366] font-bold mb-2">
                                        <span className="inline-flex items-center rounded-full bg-[#f0f5fa] px-2 py-0.5 border border-[#c3daee]">[{r.societyName}]</span>
                                    </div>
                                    <h3 className="font-heading-3 text-slate-900 mb-2 group-hover:text-[#1b4d77] transition-colors">{r.conferenceName}</h3>
                                    <div className="text-body-sm text-slate-500 flex flex-col gap-1">
                                        <span>📅 {r.dates}</span>
                                        <span>📍 {r.location}</span>
                                    </div>
                                </div>
                                <div className="mt-auto border-t border-slate-100 pt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <span className={r.earnedPoints ? "bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold" :
                                        (r.status === 'PENDING_PAYMENT' || r.paymentStatus === 'WAITING_FOR_DEPOSIT') ? "bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-100" :
                                            "bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs"}>
                                        {r.earnedPoints ? `+${r.earnedPoints} pts` :
                                            (r.status === 'PENDING_PAYMENT' || r.paymentStatus === 'WAITING_FOR_DEPOSIT') ? '입금 대기 (가상계좌)' :
                                                `[STATUS] ${r.paymentStatus || r.status}`}
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const currentLang = searchParams.get('lang') || 'ko';
                                                const safeSlug = getSafeConferenceSlug(r.slug);
                                                if (!safeSlug) {
                                                    toast.error('학술대회 정보가 없어 초록 페이지로 이동할 수 없습니다.');
                                                    return;
                                                }
                                                navigate(`/${safeSlug}/abstracts?lang=${currentLang}`);
                                            }}
                                            className="w-full sm:w-auto justify-center bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 shadow-sm border border-slate-200"
                                        >
                                            <FileText size={14} /> 초록 접수/확인
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => handleQrClick(e, r)}
                                            className="w-full sm:w-auto justify-center bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 shadow-sm border border-slate-200"
                                        >
                                            <QrCode size={14} /> 등록 확인증 (QR)
                                        </Button>
                                        {r.paymentStatus === 'PAID' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => handleReceiptClick(e, r)}
                                                className="w-full sm:w-auto justify-center bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 shadow-sm border border-slate-200"
                                            >
                                                <Printer size={14} /> 영수증
                                            </Button>
                                        )}
                                        {(r.status === 'PENDING_PAYMENT' || r.paymentStatus === 'WAITING_FOR_DEPOSIT') && r.virtualAccount && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedVirtualAccountReg(r);
                                                    setShowVirtualAccountModal(true);
                                                }}
                                                className="w-full sm:w-auto justify-center bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs gap-1.5 shadow-sm border border-orange-200"
                                            >
                                                <CreditCard size={14} /> 계좌 확인
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {!loading && false && (
                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-gray-900">방명록 기록</h3>
                                    <span className="text-xs font-semibold text-gray-500">{guestbookEntries.length}건</span>
                                </div>
                                {guestbookEntries.length === 0 ? (
                                    <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-4">
                                        아직 남긴 방명록이 없습니다.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {guestbookEntries.map(entry => (
                                            <div key={entry.id} className="flex flex-col gap-1 border border-gray-100 rounded-lg p-4">
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                                    <span className="font-semibold text-gray-700">{entry.conferenceName}</span>
                                                    <span className="text-gray-300">•</span>
                                                    <span>{entry.vendorName}</span>
                                                    {entry.timestamp?.toDate && (
                                                        <>
                                                            <span className="text-gray-300">•</span>
                                                            <span>{entry.timestamp.toDate().toLocaleString()}</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                                    {entry.message || '메시지 없음'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
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

                        {!loading && user?.affiliations && Object.entries(user.affiliations).map(([socId, aff]: [string, Affiliation]) => {
                            if (!aff.verified) return null;

                            const soc = societies.find(s => s.id === socId);

                            return (
                                <div key={socId} className="eregi-card flex justify-between items-center bg-[#f0f5fa]/50 border-[#c3daee]">
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
                                        <p className="text-xs text-[#24669e] mt-1">
                                            {aff.expiry || aff.expiryDate ? `유효기간: ${formatDate(aff.expiry || aff.expiryDate)}` : '무기한'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        <button onClick={handleOpenModal} className="w-full py-4 bg-white border-2 border-dashed border-[#c3daee] text-[#003366] rounded-xl font-bold hover:bg-[#f0f5fa]">
                            + 학회 정회원 인증 추가하기
                        </button>
                        <button onClick={() => navigate('/mypage/membership')} className="w-full py-4 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2 transition-colors">
                            <CreditCard className="w-5 h-5" />
                            학회 회비 납부
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
                                <div className="w-20 h-20 bg-[#f0f5fa] rounded-full flex items-center justify-center mb-6">
                                    <FileText className="w-10 h-10 text-[#c3daee]" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">제출된 초록이 없습니다</h3>
                                <p className="text-gray-500 max-w-sm mb-8">
                                    아직 제출된 초록이 없습니다.<br />
                                    현재 접수 중인 학술대회를 확인해보세요.
                                </p>
                                <Button
                                    onClick={() => setActiveTab('EVENTS')}
                                    variant="outline"
                                    className="px-8 py-6 text-base font-bold border-2 border-[#c3daee] text-[#003366] hover:bg-[#f0f5fa] hover:border-[#003366]"
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
                                            [(abs as any).confId?.toUpperCase() || 'UNKNOWN']
                                        </div>
                                        <h3 className="font-heading-3 text-slate-900 mt-2">
                                            {abs.title?.ko || abs.title?.en || 'Untitled'}
                                        </h3>
                                    </div>
                                    <span className={`px-3 py-1 rounded-md text-xs font-bold shadow-sm border ${abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_ORAL
                                        ? 'bg-green-100 text-green-800 border-green-200'
                                        : abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_POSTER
                                            ? 'bg-[#f0f5fa] text-[#003366] border-[#c3daee]'
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
                                    <p>저자: {abs.authors?.map((a: { name: string; email: string; affiliation: string; isPresenter: boolean }) => a.name).join(', ') || '-'}</p>

                                    {/* [Step 405-D] Edit/Withdraw Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-2 mt-4 w-full sm:w-auto">
                                        {/* Edit Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // [Fix-Step 410-D] Correct Edit URL with proper query string
                                                const currentHost = window.location.hostname;
                                                const absData = abs as any;
                                                const abstractSlug = getSafeConferenceSlug(
                                                    forceString(absData.slug || absData.conferenceSlug || absData.confId || absData.conferenceId)
                                                );
                                                if (!abstractSlug) {
                                                    toast.error('학술대회 정보가 없어 초록 수정 페이지로 이동할 수 없습니다.');
                                                    return;
                                                }
                                                const fallbackSocietyFromHost = extractSocietyFromHost(currentHost);
                                                const abstractSocietyId = forceString(
                                                    absData.societyId ||
                                                    getSocietyIdFromSlug(abstractSlug) ||
                                                    fallbackSocietyFromHost
                                                );
                                                if (!abstractSocietyId) {
                                                    toast.error('학회 정보를 찾을 수 없어 초록 수정 페이지로 이동할 수 없습니다.');
                                                    return;
                                                }
                                                const targetHost = `${abstractSocietyId}.${DOMAIN_CONFIG.BASE_DOMAIN}`;
                                                const token = getRootCookie('eregi_session');

                                                // If we are on the same domain or localhost, use React Router if possible, 
                                                // but since we need to switch subdomains potentially, full redirect is safer for multi-tenant.
                                                // However, user specifically asked for `/${slug}/abstracts?mode=edit&id=${abs.id}` format.
                                                // Let's assume we stay on the current domain if it matches, or redirect if not.

                                                if (currentHost === targetHost || currentHost.includes('localhost') || currentHost === DOMAIN_CONFIG.BASE_DOMAIN) {
                                                    // Use the slug-based route we just confirmed in App.tsx: /:slug/abstracts
                                                    navigate(`/${abstractSlug}/abstracts?mode=edit&id=${abs.id}`);
                                                } else {
                                                    // Cross-domain redirect
                                                    const authUrl = `https://${targetHost}/${abstractSlug}/abstracts?mode=edit&id=${abs.id}${token ? `&token=${token}` : ''}`;
                                                    window.location.href = authUrl;
                                                }
                                            }}
                                            className="w-full sm:w-auto text-xs bg-[#f0f5fa] text-[#003366] px-3 py-2 sm:py-1.5 rounded hover:bg-[#e1ecf6] font-bold border border-[#c3daee]"
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
                                                    const confId = forceString(
                                                        (abs as any).confId ||
                                                        (abs as any).conferenceId ||
                                                        (abs as any).slug ||
                                                        (abs as any).conferenceSlug
                                                    );
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
                    <div className="bg-white/95 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200">
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
                                <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded">기본 정보는 여기에서 바로 수정할 수 있습니다.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">이름</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={profile.displayName} onChange={(e) => handleProfileFieldChange('displayName', e.target.value)} /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={profile.phoneNumber} onChange={(e) => handleProfileFieldChange('phoneNumber', e.target.value)} /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">소속</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={profile.affiliation} onChange={(e) => handleProfileFieldChange('affiliation', e.target.value)} /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">면허번호</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={profile.licenseNumber} onChange={(e) => handleProfileFieldChange('licenseNumber', e.target.value)} /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">이메일</label><input type="text" className="w-full border p-3 rounded-lg bg-gray-100" value={profile.email} disabled /></div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={profileSaving}
                                        className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#003366] text-white hover:bg-[#002244] disabled:opacity-60 transition-colors"
                                    >
                                        {profileSaving ? '저장 중...' : '기본 정보 저장'}
                                    </button>
                                </div>
                                <div className="mt-8 border-t border-gray-100 pt-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-lg font-bold text-gray-900">내 정보 제공 이력</h4>
                                        <span className="text-xs font-semibold text-gray-500">{guestbookEntries.length}건</span>
                                    </div>
                                    {guestbookEntries.length === 0 ? (
                                        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-4">
                                            아직 제3자 정보 제공 이력이 없습니다.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {guestbookEntries.map((entry) => (
                                                <div key={entry.id} className="flex flex-col gap-1 border border-gray-100 rounded-lg p-4">
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                                        <span className="font-semibold text-gray-700">{entry.conferenceName}</span>
                                                        <span className="text-gray-300">•</span>
                                                        <span>{entry.vendorName}</span>
                                                        {entry.timestamp?.toDate && (
                                                            <>
                                                                <span className="text-gray-300">•</span>
                                                                <span>{entry.timestamp.toDate().toLocaleString()}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-emerald-700 font-semibold">동의 완료</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                        <p className="text-xs text-center text-[#003366] mb-6 font-bold bg-[#f0f5fa] p-1 rounded">{isSocLocked ? `[${verifyForm.societyId}] 학회 전용 모드` : '통합 모드 (학회 선택 가능)'}</p>
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
                                className="px-5 py-3 bg-[#003366] text-white rounded-lg font-bold hover:bg-[#002244] flex items-center justify-center min-w-[100px] transition-colors"
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
                                        paymentDate: safeFormatDate(selectedReceiptReg.paymentDate || new Date()),
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
                                <Button className="bg-[#003366] hover:bg-[#002244] text-white">
                                    <Printer className="w-4 h-4 mr-2" />
                                    인쇄하기
                                </Button>
                            }
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Virtual Account Modal */}
            <Dialog open={showVirtualAccountModal} onOpenChange={setShowVirtualAccountModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>가상계좌 입금 정보</DialogTitle>
                    </DialogHeader>
                    {selectedVirtualAccountReg && selectedVirtualAccountReg.virtualAccount && (
                        <div className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm mt-2">
                            <h3 className="text-lg font-bold text-orange-800 mb-4 border-b border-orange-100 pb-2">
                                입금 계좌 안내
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">은행</span>
                                    <span className="font-bold">{selectedVirtualAccountReg.virtualAccount.bank}</span>
                                </div>
                                <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                    <span className="text-gray-500">계좌번호</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lg text-blue-600">{selectedVirtualAccountReg.virtualAccount.accountNumber}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">예금주</span>
                                    <span className="font-medium">{selectedVirtualAccountReg.virtualAccount.customerName || 'Toss Payments'}</span>
                                </div>
                                {selectedVirtualAccountReg.virtualAccount.dueDate && (
                                    <div className="flex justify-between text-red-500 pt-2 border-t border-dashed border-gray-200 mt-2">
                                        <span className="font-medium">입금기한</span>
                                        <span className="font-bold">
                                            {new Date(selectedVirtualAccountReg.virtualAccount.dueDate).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="mt-6 text-xs text-gray-400 text-center">
                                ※ 입금 기한 내에 입금하지 않으시면 자동 취소됩니다.
                            </div>
                        </div>
                    )}
                    <div className="flex justify-center mt-4">
                        <Button onClick={() => setShowVirtualAccountModal(false)} className="w-full bg-slate-900 text-white hover:bg-slate-800">
                            확인
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
export default UserHubPage;
