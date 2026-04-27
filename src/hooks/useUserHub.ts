import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import {
    getFirestore, collection, query, where, getDocs, doc,
    getDoc, collectionGroup, orderBy, updateDoc, deleteDoc,
    onSnapshot, Timestamp, setDoc, limit, serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { useMemberVerification } from './useMemberVerification';
import { useAuth } from './useAuth';
import { useSociety } from './useSociety';
import { functions } from '../firebase';
import { getRootCookie } from '../utils/cookie';
import { logger } from '../utils/logger';
import { Submission, ConferenceUser } from '../types/schema';
import { normalizeUserData } from '../utils/userDataMapper';
import { safeFormatDate, type DateLike } from '../utils/dateUtils';
import { DOMAIN_CONFIG, extractSocietyFromHost } from '../utils/domainHelper';
import { resolveSocietyByIdentifier } from '../utils/societyResolver';
import { ReceiptConfig } from '../types/print';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Stringable {
    ko?: string;
    en?: string;
    name?: string | Stringable;
    [key: string]: unknown;
}

export interface UserReg {
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
    status?: string;
    virtualAccount?: {
        bank: string;
        accountNumber: string;
        customerName?: string;
        dueDate?: string;
    };
    names?: unknown;
    hasAbstracts?: boolean;
}

export interface Affiliation {
    verified: boolean;
    licenseNumber?: string;
    memberId?: string;
    grade?: string;
    expiry?: string | Timestamp;
    expiryDate?: string | Timestamp;
}

export interface ConsentHistoryEntry {
    id: string;
    vendorName: string;
    conferenceId: string;
    conferenceName: string;
    message?: string;
    timestamp?: Timestamp;
}

interface FirestoreConferenceData {
    societyId?: string;
    title?: unknown;
    dates?: { start?: unknown; end?: unknown; startDate?: unknown };
    startDate?: unknown;
    endDate?: unknown;
    venue?: { name?: unknown; address?: unknown };
    venueName?: unknown;
    venueAddress?: unknown;
    slug?: string;
    receipt?: unknown;
    abstractSubmissionDeadline?: unknown;
    [key: string]: unknown;
}

interface FirestoreSocietyData {
    name?: unknown;
    [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Pure Utilities
// ---------------------------------------------------------------------------

export const forceString = (val: unknown): string => {
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
        'CANCELED', 'CANCELLED', 'CANCEL', 'CANCELLATION', 'REFUND',
        'REJECT', 'DENIED', 'FAILED', 'EXPIRED', 'VOID', 'VOIDED',
        'ABORT', 'WITHDRAW', '취소', '환불', '거절', '실패', '만료', '무효',
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

    if (canceledAt === 0) return null;
    if (activeAt === 0) return null;
    if (activeAt <= canceledAt) return null;

    return latestActive;
};

export const getAbstractConfLabel = (abs: Submission): string => {
    const r = abs as unknown as Record<string, unknown>;
    return (r.confId as string | undefined)?.toUpperCase() || 'UNKNOWN';
};

export const getAbstractConferenceId = (abs: Submission): string => {
    const r = abs as unknown as Record<string, unknown>;
    return forceString(r.slug || r.conferenceSlug || r.confId || r.conferenceId);
};

export const getAbstractSocietyId = (abs: Submission): string => {
    const r = abs as unknown as Record<string, unknown>;
    return forceString(r.societyId);
};

export { getSafeConferenceSlug };

// ---------------------------------------------------------------------------
// Hook Return Type
// ---------------------------------------------------------------------------

interface UseUserHubReturn {
    // State
    loading: boolean;
    auth: ReturnType<typeof useAuth>['auth'];
    profile: { displayName: string; phoneNumber: string; affiliation: string; licenseNumber: string; email: string };
    regs: UserReg[];
    abstracts: Submission[];
    guestbookEntries: ConsentHistoryEntry[];
    societies: Array<{ id: string; name?: string | { ko?: string; en?: string }; [key: string]: unknown }>;
    syncStatus: 'connected' | 'syncing' | 'disconnected';
    activeTab: 'EVENTS' | 'CERTS' | 'PROFILE' | 'ABSTRACTS';
    totalPoints: number;
    selectedReceiptReg: UserReg | null;
    showReceiptModal: boolean;
    showCertModal: boolean;
    showVirtualAccountModal: boolean;
    selectedVirtualAccountReg: UserReg | null;
    verifyForm: { societyId: string; name: string; code: string };
    verifyLoading: boolean;
    isSocLocked: boolean;
    profileSaving: boolean;

    // Setters
    setActiveTab: (tab: 'EVENTS' | 'CERTS' | 'PROFILE' | 'ABSTRACTS') => void;
    setSelectedReceiptReg: (reg: UserReg | null) => void;
    setShowReceiptModal: (show: boolean) => void;
    setShowCertModal: (show: boolean) => void;
    setShowVirtualAccountModal: (show: boolean) => void;
    setSelectedVirtualAccountReg: (reg: UserReg | null) => void;
    setVerifyForm: React.Dispatch<React.SetStateAction<{ societyId: string; name: string; code: string }>>;

    // Computed
    visibleRegs: UserReg[];
    pageTitle: string;
    formatDate: (date: DateLike) => string;

    // Handlers
    handleEventClick: (r: UserReg) => void;
    handleQrClick: (e: React.MouseEvent, r: UserReg) => void;
    handleReceiptClick: (e: React.MouseEvent, r: UserReg) => void;
    handleOpenModal: () => void;
    handleVerify: () => void;
    handleProfileFieldChange: (field: 'displayName' | 'phoneNumber' | 'affiliation' | 'licenseNumber', value: string) => void;
    handleSaveProfile: () => void;
    handleAbstractAction: (abs: Submission, action: 'edit' | 'withdraw') => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUserHub(): UseUserHubReturn {
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
    const [societies, setSocieties] = useState<Array<{ id: string; name?: string | { ko?: string; en?: string }; [key: string]: unknown }>>([]);

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

    // -------------------------------------------------------------------------
    // Society scope resolution
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // fetchUserData
    // -------------------------------------------------------------------------

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
                    toast.error('참가 정보를 불러오지 못했습니다.');
                }
            }
        } catch (docErr) {
            const errorCode = docErr instanceof Error && 'code' in docErr ? (docErr as { code?: string }).code : undefined;
            const errorMessage = docErr instanceof Error ? docErr.message : String(docErr);
            logger.error('UserHub', 'Error accessing users/{uid}', { code: errorCode, message: errorMessage });
            toast.error('사용자 정보를 불러오지 못했습니다.');
        }

        logger.debug('UserHub', 'Final profile data', profileData);
        setProfile(profileData);

        try {
            const snapSoc = await getDocs(collection(db, 'societies'));
            setSocieties(snapSoc.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (socErr) {
            logger.error('UserHub', 'Societies fetch error', socErr);
            toast.error('학회 정보를 불러오지 못했습니다.');
        }

        try {
            // [Fix] Re-enable abstracts fetching for mypage
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

            setAbstracts(scopedAbstracts as unknown as Submission[]);
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
            toast.error('방명록 데이터를 불러오지 못했습니다.');
        }

        setLoading(false);
        // setSyncStatus('connected'); // Handled by realtime listener
    }, [isInSocietyScope]);

    // -------------------------------------------------------------------------
    // Initialize verifyForm with user name when user data changes
    // -------------------------------------------------------------------------

    useLayoutEffect(() => {
        if (!authLoading && user && !verifyFormInitializedRef.current) {
            const initialName = forceString(user.name || (user as { displayName?: string }).displayName);
            requestAnimationFrame(() => {
                setVerifyForm(prev => ({ ...prev, name: initialName }));
            });
            verifyFormInitializedRef.current = true;
        }
    }, [user, authLoading]);

    // -------------------------------------------------------------------------
    // ZOMBIE KILLER: Force refresh when navigating back from history
    // -------------------------------------------------------------------------

    useEffect(() => {
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                window.location.reload();
            }
        };
        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, []);

    // -------------------------------------------------------------------------
    // Auth check + self-healing
    // -------------------------------------------------------------------------

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
                            return;
                        }
                        healingAttempted.current[socId] = true;

                        // Repair Logic
                        try {
                            if (aff.licenseNumber) {
                                const res = await verifyMember(
                                    socId,
                                    user.name || (user as { displayName?: string }).displayName,
                                    aff.licenseNumber,
                                    true,
                                    5,
                                    true // lockNow
                                );

                                if (res.success) {
                                    // Repaired
                                } else {
                                    // Repair Failed
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

    // -------------------------------------------------------------------------
    // Affiliation validation
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // [Step 512-D] Real-time Data Highway (Self-Healing)
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (!user) return;

        let unsubscribe: (() => void) | undefined;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;

        const setupRealtimeListener = () => {
            const db = getFirestore();
            const USE_REALTIME = false; // Toggle to false while index is building

            if (!USE_REALTIME) {
                // Fallback: Fetch from users/{uid}/participations (no index required)
                setSyncStatus('syncing');
                (async () => {
                    try {
                        const db = getFirestore();
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
                        const confCache = new Map<string, FirestoreConferenceData>();
                        confDocs.forEach((confData, i) => {
                            if (confData) confCache.set(uniqueConfSlugs[i], confData);
                        });

                        const societyCache = new Map<string, FirestoreSocietyData>();
                        societyDocs.forEach((snap, i) => {
                            if (snap.exists()) societyCache.set(uniqueSocietyIds[i], snap.data());
                        });

                        // [Fix] Fetch actual registration docs to ensure we have the real status
                        const regDocs = await Promise.all(
                            participationData.map(p => getDoc(doc(db, `conferences/${p.confSlug}/registrations/${p.docSnap.id}`)).catch(() => null))
                        );
                        const regCache = new Map<string, Record<string, unknown>>();
                        regDocs.forEach(snap => {
                            if (snap && snap.exists()) regCache.set(snap.id, snap.data());
                        });

                        // [PERF] Step 4: Map registrations using cached data
                        const loadedRegs: Array<UserReg | null> = participationData.map(({ docSnap, data, confSlug }) => {
                            const cData = confCache.get(confSlug);

                            let realTitle = forceString(data.conferenceName || confSlug);
                            let socName = forceString(data.societyName);
                            let loc = '장소 정보 없음';
                            let dates = '';
                            let receiptConfig: ReceiptConfig | undefined = undefined;

                            if (cData) {
                                realTitle = forceString(
                                    (cData.title as Stringable)?.ko || (cData.title as Stringable)?.en || cData.title || cData.slug
                                );

                                const dateStart = cData.dates?.start || cData.startDate || cData.dates?.startDate;
                                const dateEnd = cData.dates?.end || cData.endDate;
                                const s = safeFormatDate(dateStart as DateLike);
                                const e = safeFormatDate(dateEnd as DateLike);
                                dates = s === e ? s : `${s} ~ ${e}`;

                                const venueName = cData.venue?.name || cData.venueName;
                                const venueAddress = cData.venue?.address || cData.venueAddress;
                                loc = venueName ? forceString(venueName) : (venueAddress ? forceString(venueAddress) : '장소 정보 없음');
                                receiptConfig = cData.receipt as ReceiptConfig | undefined;
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
                                virtualAccount: data.virtualAccount,
                                hasAbstracts: !!cData?.abstractSubmissionDeadline
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

                    const confCache = new Map<string, FirestoreConferenceData>();
                    confDocs.forEach((confData, i) => { if (confData) confCache.set(uniqueConfSlugs[i], confData); });

                    const socCache = new Map<string, FirestoreSocietyData>();
                    socDocs.forEach((snap, i) => { if (snap.exists()) socCache.set(uniqueSocIds[i], snap.data()); });

                    const validRegs: UserReg[] = enrichedDocs.map(({ docSnap, data, confSlug }) => {
                        const cData = confCache.get(confSlug) as FirestoreConferenceData | undefined;

                        let realTitle = forceString(data.conferenceName || confSlug);
                        let socName = forceString(data.societyName);
                        let loc = '장소 정보 없음';
                        let dates = '';
                        let receiptConfig: ReceiptConfig | undefined = undefined;

                        if (cData) {
                            realTitle = forceString(
                                (cData.title as Stringable)?.ko || (cData.title as Stringable)?.en || cData.title
                            );
                            const venueName = cData.venue?.name || cData.venueName;
                            const venueAddress = cData.venue?.address || cData.venueAddress;
                            loc = venueName ? forceString(venueName) : (venueAddress ? forceString(venueAddress) : '장소 정보 없음');

                            const dateStart = cData.dates?.start || cData.startDate || cData.dates?.startDate;
                            const dateEnd = cData.dates?.end || cData.endDate;
                            const s = safeFormatDate(dateStart as DateLike);
                            const e = safeFormatDate(dateEnd as DateLike);
                            dates = s === e ? s : `${s} ~ ${e}`;
                            receiptConfig = cData.receipt as ReceiptConfig | undefined;
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
                            virtualAccount: data.virtualAccount,
                            hasAbstracts: !!cData?.abstractSubmissionDeadline
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
                    toast.error('데이터 처리 중 오류가 발생했습니다.');
                }
            }, (error) => {
                logger.error('UserHub', 'Snapshot listener error', error);
                setSyncStatus('disconnected');

                const errorMsg = error instanceof Error ? error.message : String(error);
                const errorCode = (error as { code?: string }).code;

                const isIndexingError = errorMsg?.includes('COLLECTION_GROUP_ASC index required') ||
                    errorCode === 'failed-precondition';

                if (isIndexingError) {
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

    // -------------------------------------------------------------------------
    // Event handlers
    // -------------------------------------------------------------------------

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
            const token = getRootCookie('eregi_session');
            const authUrl = `https://${targetHost}/auth?mode=login&returnUrl=${encodeURIComponent(cleanPath)}${token ? `&token=${token}` : ''}`;
            window.location.replace(authUrl);
        }
    };

    const handleQrClick = (e: React.MouseEvent, r: UserReg) => {
        e.stopPropagation();
        const currentHost = window.location.hostname;
        const safeSocietyId = r.societyId && r.societyId !== 'unknown' ? r.societyId : DOMAIN_CONFIG.DEFAULT_SOCIETY;
        const targetHost = `${safeSocietyId}.${DOMAIN_CONFIG.BASE_DOMAIN}`;

        const badgeSlug = getSafeConferenceSlug(r.slug);
        if (!badgeSlug) {
            toast.error('학술대회 정보가 없어 디지털 명찰로 이동할 수 없습니다.');
            return;
        }
        const cleanPath = `/${badgeSlug}/badge`;

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

    const handleVerify = async () => {
        const { societyId, name, code } = verifyForm;
        const res = await verifyMember(societyId, name, code, true, 5, true);

        if (res.success) {
            toast.success("인증되었습니다.");
            setShowCertModal(false);
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

    const handleAbstractAction = useCallback(async (abs: Submission, action: 'edit' | 'withdraw') => {
        if (action === 'edit') {
            const currentHost = window.location.hostname;
            const abstractSlug = getSafeConferenceSlug(getAbstractConferenceId(abs));
            if (!abstractSlug) {
                toast.error('학술대회 정보가 없어 초록 수정 페이지로 이동할 수 없습니다.');
                return;
            }
            const fallbackSocietyFromHost = extractSocietyFromHost(currentHost);
            const abstractSocietyId = forceString(
                getAbstractSocietyId(abs) ||
                getSocietyIdFromSlug(abstractSlug) ||
                fallbackSocietyFromHost
            );
            if (!abstractSocietyId) {
                toast.error('학회 정보를 찾을 수 없어 초록 수정 페이지로 이동할 수 없습니다.');
                return;
            }
            const targetHost = `${abstractSocietyId}.${DOMAIN_CONFIG.BASE_DOMAIN}`;
            const token = getRootCookie('eregi_session');

            if (currentHost === targetHost || currentHost.includes('localhost') || currentHost === DOMAIN_CONFIG.BASE_DOMAIN) {
                navigate(`/${abstractSlug}/abstracts?mode=edit&id=${abs.id}`);
            } else {
                const authUrl = `https://${targetHost}/${abstractSlug}/abstracts?mode=edit&id=${abs.id}${token ? `&token=${token}` : ''}`;
                window.location.href = authUrl;
            }
        }

        if (action === 'withdraw') {
            if (!confirm("정말 철회하시겠습니까? 철회 후에는 복구할 수 없습니다.")) return;
            try {
                const db = getFirestore();
                const confId = getAbstractConferenceId(abs);
                if (!confId) {
                    toast.error("유효하지 않은 컨퍼런스 ID입니다.");
                    return;
                }
                await deleteDoc(doc(db, `conferences/${confId}/submissions/${abs.id}`));
                setAbstracts(prev => prev.filter(p => p.id !== abs.id));
                toast.success("초록이 철회되었습니다.");
            } catch (err) {
                logger.error('UserHub', 'Withdraw failed', err);
                toast.error("철회 실패: 관리자에게 문의하세요.");
            }
        }
    }, [navigate]);

    // -------------------------------------------------------------------------
    // Computed values
    // -------------------------------------------------------------------------

    const hostname = window.location.hostname;
    const isMain = hostname === DOMAIN_CONFIG.BASE_DOMAIN || hostname.startsWith('www') || hostname.includes('firebaseapp') || hostname.includes('localhost');
    const visibleRegs = regs.filter(isVisibleActiveReg);

    const getSocietyName = (): string => {
        if (isMain) return '';

        if (society?.name) {
            if (typeof society.name === 'string') {
                return society.name;
            } else if (society.name.ko || society.name.en) {
                return society.name.ko || society.name.en;
            }
        }

        return hostname.split('.')[0];
    };

    const societyName = getSocietyName();
    const pageTitle = isMain ? "통합 마이페이지" : `${societyName} 마이페이지`;

    const formatDate = (date: DateLike): string => {
        return safeFormatDate(date, 'ko-KR');
    };

    // -------------------------------------------------------------------------
    // Return
    // -------------------------------------------------------------------------

    return {
        loading,
        auth,
        profile,
        regs,
        abstracts,
        guestbookEntries,
        societies,
        syncStatus,
        activeTab,
        totalPoints,
        selectedReceiptReg,
        showReceiptModal,
        showCertModal,
        showVirtualAccountModal,
        selectedVirtualAccountReg,
        verifyForm,
        verifyLoading,
        isSocLocked,
        profileSaving,
        setActiveTab,
        setSelectedReceiptReg,
        setShowReceiptModal,
        setShowCertModal,
        setShowVirtualAccountModal,
        setSelectedVirtualAccountReg,
        setVerifyForm,
        visibleRegs,
        pageTitle,
        formatDate,
        handleEventClick,
        handleQrClick,
        handleReceiptClick,
        handleOpenModal,
        handleVerify,
        handleProfileFieldChange,
        handleSaveProfile,
        handleAbstractAction,
    };
}
