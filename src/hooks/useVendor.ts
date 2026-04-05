import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, Timestamp, orderBy, limit, collectionGroup } from 'firebase/firestore';
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
    id?: string;
    collectionName?: string;
};

type VendorScanResponse = {
    user: ConferenceUserSnapshot;
    reg: RegistrationSnapshot;
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
        if (!vendor?.id) {
            setError('Vendor context is not ready.');
            return;
        }

        setLoading(true);
        setError(null);
        setScanResult(null);

        try {
            const resolveVendorBadgeScan = httpsCallable(functions, 'resolveVendorBadgeScan');
            const result = await resolveVendorBadgeScan({
                vendorId: vendor.id,
                confId: conferenceId,
                qrData
            });

            const payload = result.data as VendorScanResponse;
            setScanResult({
                user: payload.user,
                reg: payload.reg
            });
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [conferenceId, vendor?.id]);

    // 4. Process Visit (Consent Gate)
    const processVisit = useCallback(async (agreed: boolean, guestbookMessage?: string) => {
        if (!vendor || !conferenceId || !scanResult) return;
        if (!auth.currentUser) return;

        setLoading(true);
        try {
            const visitorOrg = getAffiliationName(scanResult.user, scanResult.reg);
            const visitorPhone = scanResult.user.phone || scanResult.reg.phone || '';
            const processVendorVisitFn = httpsCallable(functions, 'processVendorVisit');
            await processVendorVisitFn({
                vendorId: vendor.id,
                confId: conferenceId,
                qrData: scanResult.reg.id || scanResult.user.id,
                agreed,
                guestbookMessage: guestbookMessage || ''
            });

            // Send AlimTalk if consent was given
            if (agreed && visitorPhone) {
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
                                const variables = {
                                    visitorName: scanResult.user.name || 'Unknown',
                                    visitorOrg,
                                    partnerName: vendor.name || 'Partner',
                                    eventName: conferenceId,
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
                                    phone: visitorPhone,
                                    templateCode: templateCode,
                                    variables: variables
                                });

                                toast.success('알림톡을 발송했습니다.');
                            }
                        }
                    }
                } catch (alimError) {
                    console.error('Failed to send AlimTalk:', alimError);
                    toast.error('알림톡 발송에 실패했습니다. 방문 기록은 정상 저장되었습니다.');
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
    }, [vendor, conferenceId, scanResult]);

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

            toast.success('프로필이 업데이트되었습니다.');
        } catch (error) {
            console.error('Vendor profile update failed:', error);
            toast.error('프로필 업데이트에 실패했습니다.');
            setError('프로필 업데이트에 실패했습니다.');
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


