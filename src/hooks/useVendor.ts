import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, Timestamp, orderBy, limit, collectionGroup, type DocumentSnapshot, type QueryDocumentSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { db, auth, functions } from '../firebase';
import { ConferenceUser, Registration } from '../types/schema';
import { useNavigate } from 'react-router-dom';

export interface VendorProfile {
    id: string;
    name: string;
    slug?: string;
    description?: string;
    logoUrl?: string;
    homeUrl?: string;
    productUrl?: string;
    ownerUid?: string;
    adminEmail?: string;
    staffEmails?: string[];
}

export interface VisitLog {
    id: string;
    visitorName: string;
    visitorOrg?: string;
    visitorPhone?: string;
    visitorEmail?: string;
    conferenceId: string;
    timestamp: Date;
    isConsentAgreed: boolean;
}

export interface GuestbookLog {
    id: string;
    userName: string;
    userOrg?: string;
    vendorId: string;
    vendorName: string;
    conferenceId: string;
    message?: string;
    timestamp: Date;
}

export interface PublicConferenceSummary {
    id: string;
    title?: string;
    status?: string;
    societyId?: string;
    slug?: string;
}

export interface ConferenceFeatures {
    guestbookEnabled: boolean;
    stampTourEnabled: boolean;
}

type ConferenceUserSnapshot = ConferenceUser | {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    affiliation?: string;
    organization?: string;
    affiliations?: unknown;
};

type RegistrationSnapshot = Registration & {
    userName?: string;
    name?: string;
    email?: string;
    phone?: string;
    affiliation?: string;
    organization?: string;
    type?: string;
    category?: string;
};

const getAffiliationName = (user: ConferenceUserSnapshot, reg: RegistrationSnapshot): string => {
    const affiliations = (user as { affiliations?: unknown }).affiliations;
    if (Array.isArray(affiliations)) {
        const first = affiliations[0];
        if (first && typeof first === 'object' && 'name' in first) {
            const name = (first as { name?: string }).name;
            if (name) return name;
        }
    }
    if (affiliations && typeof affiliations === 'object') {
        const record = affiliations as Record<string, { name?: string }>;
        const firstKey = Object.keys(record)[0];
        if (firstKey && record[firstKey]?.name) {
            return record[firstKey].name || '';
        }
    }

    if ('affiliation' in user && user.affiliation) return user.affiliation;
    return reg.affiliation || reg.organization || '';
};

export const useVendor = (vid: string | undefined) => {
    const [vendor, setVendor] = useState<VendorProfile | null>(null);
    const [conferences, setConferences] = useState<{ id: string; name: string; sponsorId?: string; isStampTourParticipant?: boolean }[]>([]);
    const [conferenceId, setConferenceId] = useState<string | null>(null);
    const [conferenceFeatures, setConferenceFeatures] = useState<ConferenceFeatures>({
        guestbookEnabled: true,
        stampTourEnabled: false
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<{ user: ConferenceUserSnapshot; reg: RegistrationSnapshot } | null>(null);
    const [visits, setVisits] = useState<VisitLog[]>([]);
    const [guestbookEntries, setGuestbookEntries] = useState<GuestbookLog[]>([]);
    const [availableConferences, setAvailableConferences] = useState<PublicConferenceSummary[]>([]);
    const [vendorRequests, setVendorRequests] = useState<Record<string, { status?: string; requestedAt?: Date }>>({});
    const navigate = useNavigate();

    // 1. Initialize & Resolve Vendor
    useEffect(() => {
        if (!vid) {
            setLoading(false);
            return;
        }

        const init = async () => {
            setLoading(true);
            try {
                if (!auth.currentUser) {
                    const loginPath = window.location.pathname.startsWith('/partner') ? '/partner/login' : '/admin/login';
                    navigate(loginPath);
                    return;
                }

                // SECURITY CHECK: vendorId should match auth.currentUser.uid or they have some other mapping.
                // Assuming `vid` is the auth.currentUser.uid for L3 independent access
                const vendorId = vid;

                // Fetch Root Vendor Document
                const vendorRef = doc(db, 'vendors', vendorId);
                const vendorSnap = await getDoc(vendorRef);

                if (!vendorSnap.exists()) {
                    throw new Error('Vendor profile not found. Please contact the super admin to create the vendor account.');
                }

                const vData = vendorSnap.data() as VendorProfile & { adminEmail?: string; staffEmails?: string[] };

                const isOwner = vData.ownerUid === auth.currentUser.uid;
                const isAdmin = vData.adminEmail && vData.adminEmail === auth.currentUser.email;
                const isStaff = !!(vData.staffEmails && auth.currentUser.email && vData.staffEmails.includes(auth.currentUser.email));

                if (!isOwner && !isAdmin && !isStaff) {
                    throw new Error("Access Denied: You are not authorized to manage this vendor account.");
                }

                setVendor(vData);

                // Fetch Joined Conferences by finding sponsors that link to this vendor
                const q = query(collectionGroup(db, 'sponsors'), where('vendorId', '==', vendorId));
                const snap = await getDocs(q);
                const confs = snap.docs.map(d => {
                    const confRef = d.ref.parent.parent;
                    const sponsorData = d.data() as { isStampTourParticipant?: boolean };
                    return confRef ? {
                        id: confRef.id,
                        name: confRef.id,
                        sponsorId: d.id,
                        isStampTourParticipant: sponsorData?.isStampTourParticipant === true
                    } : null; // simplified name to confId
                }).filter(c => c !== null) as { id: string; name: string; sponsorId?: string; isStampTourParticipant?: boolean }[];

                // Remove duplicates in case a vendor is mapped magically multiple times
                const uniqueConfs = Array.from(new Map(confs.map(item => [item.id, item])).values());

                setConferences(uniqueConfs);
                if (uniqueConfs.length > 0) {
                    setConferenceId(uniqueConfs[0].id); // Default to first conf
                }

                await fetchVisits(vendorId);
                await fetchGuestbookEntries(vendorId);
                await fetchPublicConferences();
                await fetchVendorRequests(vendorId);
            } catch (e) {
                console.error(e);
                setError(e instanceof Error ? e.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [vid, navigate]);

    useEffect(() => {
        if (!conferenceId) return;

        const fetchConferenceFeatures = async () => {
            try {
                const confSnap = await getDoc(doc(db, 'conferences', conferenceId));
                if (confSnap.exists()) {
                    const features = confSnap.data().features || {};
                    setConferenceFeatures({
                        guestbookEnabled: features.guestbookEnabled ?? true,
                        stampTourEnabled: features.stampTourEnabled ?? false
                    });
                } else {
                    setConferenceFeatures({
                        guestbookEnabled: true,
                        stampTourEnabled: false
                    });
                }
            } catch (e) {
                console.error('Error fetching conference features:', e);
                setConferenceFeatures({
                    guestbookEnabled: true,
                    stampTourEnabled: false
                });
            }
        };

        fetchConferenceFeatures();
    }, [conferenceId]);

    // 2. Fetch Leads (Vendor DB)
    const fetchVisits = async (vendorId: string) => {
        try {
            const q = query(
                collection(db, `vendors/${vendorId}/leads`),
                orderBy('timestamp', 'desc')
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    visitorName: data.visitorName,
                    visitorOrg: data.visitorOrg,
                    visitorPhone: data.visitorPhone,
                    visitorEmail: data.visitorEmail,
                    conferenceId: data.conferenceId,
                    timestamp: data.timestamp?.toDate() || new Date(),
                    isConsentAgreed: data.isConsentAgreed
                } as VisitLog;
            });
            setVisits(list);
        } catch (e) {
            console.error('Error fetching leads:', e);
        }
    };

    const fetchGuestbookEntries = async (vendorId: string) => {
        try {
            const q = query(
                collectionGroup(db, 'guestbook_entries'),
                where('vendorId', '==', vendorId),
                limit(500)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    userName: data.userName || 'Unknown',
                    userOrg: data.userOrg,
                    vendorId: data.vendorId,
                    vendorName: data.vendorName,
                    conferenceId: data.conferenceId,
                    message: data.message,
                    timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
                } as GuestbookLog;
            });
            list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            setGuestbookEntries(list);
        } catch (e) {
            console.error('Error fetching guestbook entries:', e);
        }
    };

    const fetchPublicConferences = async () => {
        try {
            const q = query(collection(db, 'conferences'), where('status', 'in', ['PLANNING', 'OPEN']));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => {
                const data = d.data() as { title?: { ko?: string; en?: string }; status?: string; societyId?: string; slug?: string };
                return {
                    id: d.id,
                    title: data?.title?.ko || data?.title?.en || d.id,
                    status: data?.status,
                    societyId: data?.societyId,
                    slug: data?.slug
                } as PublicConferenceSummary;
            });
            setAvailableConferences(list);
        } catch (e) {
            console.error('Error fetching public conferences:', e);
        }
    };

    const fetchVendorRequests = async (vendorId: string) => {
        try {
            const q = query(collectionGroup(db, 'vendor_requests'), where('vendorId', '==', vendorId));
            const snap = await getDocs(q);
            const map: Record<string, { status?: string; requestedAt?: Date }> = {};
            snap.docs.forEach(d => {
                const data = d.data() as { conferenceId?: string; status?: string; requestedAt?: Timestamp };
                const confId = data.conferenceId || d.ref.parent.parent?.id;
                if (confId) {
                    map[confId] = {
                        status: data.status,
                        requestedAt: data.requestedAt?.toDate()
                    };
                }
            });
            setVendorRequests(map);
        } catch (e) {
            console.error('Error fetching vendor requests:', e);
        }
    };

    const requestSponsorship = async (confId: string) => {
        if (!vendor || !auth.currentUser) return;
        try {
            await setDoc(doc(db, `conferences/${confId}/vendor_requests/${vendor.id}`), {
                vendorId: vendor.id,
                vendorName: vendor.name,
                conferenceId: confId,
                status: 'PENDING',
                requesterEmail: auth.currentUser.email,
                requestedAt: Timestamp.now()
            }, { merge: true });

            await fetchVendorRequests(vendor.id);
            toast.success('스폰서 참여 요청이 접수되었습니다.');
        } catch (e) {
            console.error('Sponsorship request failed:', e);
            toast.error('요청에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
    };

    const logVendorAudit = useCallback(async (payload: {
        action: 'LEAD_CREATED' | 'LEAD_VIEWED' | 'LEAD_EXPORTED' | 'LEAD_DELETED' | 'STAMP_CREATED' | 'ALIMTALK_SENT' | 'ALIMTALK_FAILED' | 'CONSENT_WITHDRAWN' | 'CONSENT_GIVEN' | 'GUESTBOOK_SIGN' | 'VENDOR_LOGIN' | 'VENDOR_SETTINGS_CHANGED';
        entityType: 'LEAD' | 'STAMP' | 'ALIMTALK' | 'CONSENT' | 'VENDOR' | 'GUESTBOOK';
        entityId: string;
        details?: Record<string, unknown>;
        result?: 'SUCCESS' | 'FAILURE';
    }) => {
        if (!vendor || !auth.currentUser) return;
        try {
            await addDoc(collection(db, `vendors/${vendor.id}/audit_logs`), {
                actorId: auth.currentUser.uid,
                actorEmail: auth.currentUser.email,
                actorType: 'VENDOR_ADMIN',
                action: payload.action,
                entityType: payload.entityType,
                entityId: payload.entityId,
                vendorId: vendor.id,
                conferenceId: conferenceId || undefined,
                details: payload.details || {},
                result: payload.result || 'SUCCESS',
                timestamp: Timestamp.now()
            });
        } catch (e) {
            console.error('Failed to write audit log:', e);
        }
    }, [vendor, conferenceId]);

    // 3. Scan Badge
    const scanBadge = useCallback(async (qrData: string) => {
        if (!conferenceId) {
            setError('참여 중인 학회가 선택되지 않았습니다.');
            return;
        }

        setLoading(true);
        setError(null);
        setScanResult(null);

        try {
            // First check badgeQr
            const regQ = query(collection(db, `conferences/${conferenceId}/registrations`), where('badgeQr', '==', qrData), limit(1));
            const regSnap = await getDocs(regQ);
            let regDoc: QueryDocumentSnapshot | DocumentSnapshot | null = regSnap.docs[0] ?? null;

            // Fallback for DEV, just match ID directly if QR is simple 
            if (!regDoc) {
                const directRef = doc(db, `conferences/${conferenceId}/registrations`, qrData);
                const singleDoc = await getDoc(directRef);
                regDoc = singleDoc.exists() ? singleDoc : null;
            }

            if (!regDoc) {
                throw new Error('유효하지 않은 QR 코드이거나 해당 학회에 등록되지 않은 참석자입니다.');
            }

            const reg = regDoc.data() as RegistrationSnapshot;
            const regId = regDoc.id;
            reg.id = regId;

            // Try fetching from users collection or fallback to registration data
            const userRef = doc(db, `conferences/${conferenceId}/users/${reg.userId || regId}`);
            const userSnap = await getDoc(userRef);

            const userData: ConferenceUserSnapshot = userSnap.exists() ? (userSnap.data() as ConferenceUser) : {
                id: reg.userId || regId,
                name: reg.userName || reg.name || '알 수 없음',
                email: reg.email,
                phone: reg.phone,
                affiliation: reg.affiliation || reg.organization,
                organization: reg.organization
            };

            setScanResult({
                user: userData,
                reg
            });

        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [conferenceId]);

    // 4. Process Visit (Consent Gate)
    const processVisit = useCallback(async (agreed: boolean) => {
        if (!vendor || !conferenceId || !scanResult) return;
        if (!auth.currentUser) return;

        setLoading(true);
        try {
            const visitorName = agreed ? (scanResult.user.name || 'Unknown User') : 'Anonymous (별칭)';

            // L3 VENDOR DB: Write to /vendors/{vendorId}/leads
            const leadData: Record<string, unknown> = {
                conferenceId,
                visitorId: scanResult.user.id,
                visitorName,
                timestamp: Timestamp.now(),
                isConsentAgreed: agreed,
                consentStatus: agreed ? 'ACTIVE' : 'ACTIVE', // Start as ACTIVE, can be withdrawn later
                retentionPeriodDays: agreed ? 1095 : 1825, // 3 years for PII, 5 years for anonymous
            };

            if (agreed) {
                leadData.visitorOrg = getAffiliationName(scanResult.user, scanResult.reg);
                leadData.visitorPhone = scanResult.user.phone || scanResult.reg.phone || '';
                leadData.visitorEmail = scanResult.user.email || scanResult.reg.email || '';
            }

            const leadRef = await addDoc(collection(db, `vendors/${vendor.id}/leads`), leadData);
            await logVendorAudit({
                action: 'LEAD_CREATED',
                entityType: 'LEAD',
                entityId: leadRef.id,
                details: { isConsentAgreed: agreed, conferenceId }
            });

            if (agreed) {
                await logVendorAudit({
                    action: 'CONSENT_GIVEN',
                    entityType: 'CONSENT',
                    entityId: scanResult.user.id,
                    details: { conferenceId, vendorId: vendor.id }
                });
            }

            // STAMP TOUR: 스탬프 투어 참가 업체만 stamps 저장
            // conferences/{confId}/sponsors/{vendorId}에서 isStampTourParticipant 확인
            const sponsorSnap = await getDoc(doc(db, `conferences/${conferenceId}/sponsors/${vendor.id}`));
            const sponsorData = sponsorSnap.exists() ? sponsorSnap.data() : null;

            if (conferenceFeatures.stampTourEnabled && sponsorData?.isStampTourParticipant === true) {
                const stampRef = await addDoc(collection(db, `conferences/${conferenceId}/stamps`), {
                    userId: scanResult.user.id,
                    vendorId: vendor.id,
                    vendorName: vendor.name,
                    timestamp: Timestamp.now()
                });
                await logVendorAudit({
                    action: 'STAMP_CREATED',
                    entityType: 'STAMP',
                    entityId: stampRef.id,
                    details: { conferenceId, vendorId: vendor.id }
                });
            }

            if (agreed && conferenceFeatures.guestbookEnabled) {
                const guestbookRef = await addDoc(collection(db, `conferences/${conferenceId}/guestbook_entries`), {
                    userId: scanResult.user.id,
                    userName: scanResult.user.name || 'Unknown',
                    userOrg: leadData.visitorOrg || '',
                    vendorId: vendor.id,
                    vendorName: vendor.name,
                    conferenceId,
                    leadId: leadRef.id,
                    timestamp: Timestamp.now(),
                    isConsentAgreed: true
                });
                await logVendorAudit({
                    action: 'GUESTBOOK_SIGN',
                    entityType: 'GUESTBOOK',
                    entityId: guestbookRef.id,
                    details: { conferenceId, vendorId: vendor.id }
                });
            }

            // Send AlimTalk if consent was given
            if (agreed && leadData.visitorPhone) {
                try {
                    // Fetch vendor's notification settings
                    const infraSnap = await getDoc(doc(db, `vendors/${vendor.id}/settings/infrastructure`));
                    const infraData = infraSnap.data();
                    const nhnConfig = infraData?.notification?.nhnAlimTalk;

                    if (nhnConfig?.enabled && nhnConfig.senderKey) {
                        // Fetch active template for BOOTH_VISIT
                        const templatesQuery = query(
                            collection(db, `vendors/${vendor.id}/notification-templates`),
                            where('eventType', '==', 'BOOTH_VISIT'),
                            where('isActive', '==', true),
                            limit(1)
                        );
                        const templatesSnap = await getDocs(templatesQuery);

                        if (!templatesSnap.empty) {
                            const template = templatesSnap.docs[0].data();
                            const templateCode = template.channels.kakao?.kakaoTemplateCode;

                            if (templateCode) {
                                // Prepare template variables
                                const visitorOrg = leadData.visitorOrg as string || '';
                                const variables = {
                                    visitorName: scanResult.user.name || 'Unknown',
                                    visitorOrg: visitorOrg,
                                    partnerName: vendor.name || 'Partner',
                                    eventName: conferenceId, // You might want to fetch actual conference name
                                    visitTime: new Date().toLocaleString('ko-KR', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })
                                };

                                // Call Cloud Function to send AlimTalk
                                const sendAlimTalkFn = httpsCallable(functions, 'sendVendorAlimTalk');
                                await sendAlimTalkFn({
                                    vendorId: vendor.id,
                                    phone: leadData.visitorPhone as string,
                                    templateCode: templateCode,
                                    variables: variables
                                });

                                toast.success('알림톡을 발송했습니다.');
                            }
                        }
                    }
                } catch (alimError) {
                    console.error('Failed to send AlimTalk:', alimError);
                    // Don't fail the entire process if AlimTalk fails
                    toast.error('알림톡 발송에 실패했습니다. (방문 기록은 저장됨)');
                }
            }

            setScanResult(null);
            await fetchVisits(vendor.id);
            await fetchGuestbookEntries(vendor.id);
            alert("처리되었습니다. (Stamp Issued)");

        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [vendor, conferenceId, scanResult, conferenceFeatures, logVendorAudit]);

    const resetScan = () => {
        setScanResult(null);
        setError(null);
    };

    // Save Vendor Info (L3 Profile Edit)
    const updateVendorProfile = async (updates: Partial<VendorProfile>) => {
        if (!vendor) return;
        setLoading(true);
        try {
            const vendorRef = doc(db, 'vendors', vendor.id);
            await setDoc(vendorRef, updates, { merge: true });

            setVendor({ ...vendor, ...updates } as VendorProfile);

            // Also optionally sync to conferences mappings so L2 sees updated name
            for (const c of conferences) {
                const confVRef = doc(db, `conferences/${c.id}/vendors/${vendor.id}`);
                await setDoc(confVRef, { name: updates.name, logoUrl: updates.logoUrl }, { merge: true });
            }

            toast.success('프로필이 업데이트 되었습니다!');
        } catch (error) {
            console.error('Vendor profile update failed:', error);
            toast.error('프로필 업데이트 실패');
            setError('프로필 업데이트 실패');
        } finally {
            setLoading(false);
        }
    }

    return {
        vendor,
        conferences,
        conferenceId,
        setConferenceId,
        loading,
        error,
        scanResult,
        visits,
        guestbookEntries,
        availableConferences,
        vendorRequests,
        conferenceFeatures,
        fetchVisits,
        fetchGuestbookEntries,
        scanBadge,
        processVisit,
        resetScan,
        updateVendorProfile,
        logVendorAudit,
        requestSponsorship,
        logout: () => auth.signOut(),
        login: () => {
            const loginPath = window.location.pathname.startsWith('/partner') ? '/partner/login' : '/admin/login';
            navigate(loginPath);
        }
    };
};
