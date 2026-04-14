import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, serverTimestamp, getDoc, collectionGroup, orderBy, updateDoc, Timestamp, setDoc, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

import { useMemberVerification } from '@/hooks/useMemberVerification';
import { useAuth } from '@/hooks/useAuth';
import { useSociety } from '@/hooks/useSociety';
import { functions } from '@/firebase';
import { getRootCookie } from '@/utils/cookie';
import { logger } from '@/utils/logger';
import { normalizeUserData } from '@/utils/userDataMapper';
import { safeFormatDate } from '@/utils/dateUtils';
import { DOMAIN_CONFIG, extractSocietyFromHost } from '@/utils/domainHelper';
import { resolveSocietyByIdentifier } from '@/utils/societyResolver';

import { UserReg, ConsentHistoryEntry } from '../types';
import { 
    forceString, 
    getSafeConferenceSlug, 
    getSocietyIdFromSlug, 
    normalizeSocietyKey, 
    isVisibleActiveReg, 
    pickLatestVisibleReg 
} from '../utils';
import { Submission, ConferenceUser } from '@/types/schema';

export const useUserHubState = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { auth } = useAuth();
    const { user, loading: authLoading } = auth;
    const { society } = useSociety();

    const [loading, setLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'disconnected'>('syncing');
    const [activeTab, setActiveTab] = useState<'EVENTS' | 'CERTS' | 'PROFILE' | 'ABSTRACTS'>('EVENTS');

    const [selectedReceiptReg, setSelectedReceiptReg] = useState<UserReg | null>(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    const [regs, setRegs] = useState<UserReg[]>([]);
    const [abstracts, setAbstracts] = useState<Submission[]>([]);
    const [guestbookEntries, setGuestbookEntries] = useState<ConsentHistoryEntry[]>([]);
    const [societyScopeKeys, setSocietyScopeKeys] = useState<Set<string>>(new Set());
    const [scopeResolved, setScopeResolved] = useState(false);
    const healingAttempted = useRef<{ [key: string]: boolean }>({});

    const [totalPoints, setTotalPoints] = useState(0);
    const [societies, setSocieties] = useState<Array<{ id: string; name: string | { ko?: string; en?: string };[key: string]: unknown }>>([]);

    const [profile, setProfile] = useState({ displayName: '', phoneNumber: '', affiliation: '', licenseNumber: '', email: '' });
    const [profileSaving, setProfileSaving] = useState(false);

    const [showCertModal, setShowCertModal] = useState(false);
    const [showVirtualAccountModal, setShowVirtualAccountModal] = useState(false);
    const [verifyForm, setVerifyForm] = useState({ societyId: "", name: "", code: "" });
    const [isSocLocked, setIsSocLocked] = useState(false);
    const [selectedVirtualAccountReg, setSelectedVirtualAccountReg] = useState<UserReg | null>(null);

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
                const normalized = normalizeUserData({ ...rawData, id: u.id });

                profileData = {
                    displayName: normalized.name || profileData.displayName,
                    phoneNumber: normalized.phone || profileData.phoneNumber,
                    affiliation: normalized.organization || profileData.affiliation,
                    licenseNumber: normalized.licenseNumber || profileData.licenseNumber,
                    email: normalized.email || profileData.email
                };
            } else {
                try {
                    const participationsRef = collection(db, `users/${u.id}/participations`);
                    const participationsSnap = await getDocs(participationsRef);

                    if (!participationsSnap.empty) {
                        const nonMemberParticipation = participationsSnap.docs[0].data();
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
            logger.error('UserHub', 'Error accessing users/{uid}', docErr);
        }

        setProfile(profileData);

        try {
            const snapSoc = await getDocs(collection(db, 'societies'));
            setSocieties(snapSoc.docs.map(d => ({ id: d.id, ...d.data() })) as any);
        } catch (socErr) {
            logger.error('UserHub', 'Societies fetch error', socErr);
        }

        try {
            const queryUserId = forceString(u.id || u.uid);
            if (!queryUserId) {
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
        } catch (absErr) {
            const errorMsg = absErr instanceof Error ? absErr.message : String(absErr);
            if (errorMsg?.includes('index') || errorMsg?.includes('Index')) {
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
                rawEntries = guestbookSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any;
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
                    .flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))) as any;
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
        } catch {
            setGuestbookEntries([]);
        }

        setLoading(false);
    }, [isInSocietyScope]);

    useLayoutEffect(() => {
        if (!authLoading && user && !verifyFormInitializedRef.current) {
            const initialName = forceString(user.name || (user as { displayName?: string }).displayName);
            requestAnimationFrame(() => {
                setVerifyForm(prev => ({ ...prev, name: initialName }));
            });
            verifyFormInitializedRef.current = true;
        }
    }, [user, authLoading]);

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

            requestAnimationFrame(() => {
                fetchUserData(user);
            });

            if (user.affiliations) {
                Object.entries(user.affiliations).forEach(async ([socId, aff]: [string, any]) => {
                    const hasExpiry = aff.expiry !== undefined || aff.expiryDate !== undefined;

                    if (aff.verified && !hasExpiry) {
                        if (healingAttempted.current[socId]) return;
                        healingAttempted.current[socId] = true;

                        try {
                            if (aff.licenseNumber) {
                                await verifyMember(
                                    socId,
                                    user.name || (user as { displayName?: string }).displayName,
                                    aff.licenseNumber,
                                    true,
                                    5,
                                    true
                                );
                            }
                        } catch (e) {
                            logger.error('UserHub', `Self-healing error for ${socId}`, e);
                        }
                    }
                });
            }
        }
    }, [user, authLoading, fetchUserData, verifyMember]);

    const validateCurrentAffiliationRef = useRef<(user: any) => Promise<void> | null>(null);

    useEffect(() => {
        if (user && !authLoading && validateCurrentAffiliationRef.current) {
            validateCurrentAffiliationRef.current(user);
        }
    }, [user, authLoading]);

    const validateCurrentAffiliation = useCallback(async (u: any): Promise<void> => {
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

    useEffect(() => {
        validateCurrentAffiliationRef.current = validateCurrentAffiliation;
    }, [validateCurrentAffiliation]);

    useEffect(() => {
        if (!user) return;

        let unsubscribe: (() => void) | undefined;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;

        const setupRealtimeListener = () => {
            const db = getFirestore();
            const USE_REALTIME = false; 

            if (!USE_REALTIME) {
                setSyncStatus('syncing');
                (async () => {
                    try {
                        const participationsRef = collection(db, `users/${user.uid}/participations`);
                        const snapshot = await getDocs(participationsRef);

                        if (snapshot.empty) {
                            setRegs([]);
                            setTotalPoints(0);
                            setSyncStatus('connected');
                            setLoading(false);
                            return;
                        }

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

                        const confCache = new Map<string, any>();
                        confDocs.forEach((confData, i) => {
                            if (confData) confCache.set(uniqueConfSlugs[i], confData);
                        });

                        const societyCache = new Map<string, any>();
                        societyDocs.forEach((snap, i) => {
                            if (snap.exists()) societyCache.set(uniqueSocietyIds[i], snap.data());
                        });

                        const regDocs = await Promise.all(
                            participationData.map(p => getDoc(doc(db, `conferences/${p.confSlug}/registrations/${p.docSnap.id}`)).catch(() => null))
                        );
                        const regCache = new Map<string, any>();
                        regDocs.forEach(snap => {
                            if (snap && snap.exists()) regCache.set(snap.id, snap.data());
                        });

                        const loadedRegs: Array<UserReg | null> = participationData.map(({ docSnap, data, confSlug }) => {
                            const cData = confCache.get(confSlug);

                            let realTitle = forceString(data.conferenceName || confSlug);
                            let socName = forceString(data.societyName);
                            let loc = '장소 정보 없음';
                            let dates = '';
                            let receiptConfig: any = undefined;

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
                                receiptConfig = (cData as any).receipt;
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
        } catch {
            toast.error('기본 정보 저장에 실패했습니다.');
        } finally {
            setProfileSaving(false);
        }
    };

    return {
        loading,
        syncStatus,
        activeTab,
        setActiveTab,
        regs,
        setRegs,
        abstracts,
        setAbstracts,
        guestbookEntries,
        totalPoints,
        societies,
        profile,
        profileSaving,
        showCertModal,
        setShowCertModal,
        showVirtualAccountModal,
        setShowVirtualAccountModal,
        verifyForm,
        setVerifyForm,
        isSocLocked,
        selectedVirtualAccountReg,
        setSelectedVirtualAccountReg,
        selectedReceiptReg,
        setSelectedReceiptReg,
        showReceiptModal,
        setShowReceiptModal,
        verifyLoading,
        handleEventClick,
        handleQrClick,
        handleReceiptClick,
        handleOpenModal,
        handleVerify,
        handleProfileFieldChange,
        handleSaveProfile,
        user,
        society
    };
};
