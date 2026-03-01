import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, Timestamp, orderBy, limit, collectionGroup } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db, auth } from '../firebase';
import { ConferenceUser, Registration } from '../types/schema';
import { useNavigate } from 'react-router-dom';

export interface VendorProfile {
    id: string;
    name: string;
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

export const useVendor = (vid: string | undefined) => {
    const [vendor, setVendor] = useState<VendorProfile | null>(null);
    const [conferences, setConferences] = useState<{ id: string, name: string }[]>([]);
    const [conferenceId, setConferenceId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<{ user: ConferenceUser; reg: Registration } | null>(null);
    const [visits, setVisits] = useState<VisitLog[]>([]);
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
                    navigate('/admin/login');
                    return;
                }

                // SECURITY CHECK: vendorId should match auth.currentUser.uid or they have some other mapping.
                // Assuming `vid` is the auth.currentUser.uid for L3 independent access
                const vendorId = vid;

                // Fetch Root Vendor Document
                const vendorRef = doc(db, 'vendors', vendorId);
                const vendorSnap = await getDoc(vendorRef);

                if (!vendorSnap.exists()) {
                    // Create basic profile if it doesn't exist (First Login)
                    await setDoc(vendorRef, {
                        id: vendorId,
                        name: 'New Partner',
                        ownerUid: auth.currentUser.uid,
                        createdAt: Timestamp.now()
                    });
                }

                const vData = (await getDoc(vendorRef)).data() as VendorProfile & { adminEmail?: string };

                const isOwner = vData.ownerUid === auth.currentUser.uid;
                const isAdmin = vData.adminEmail && vData.adminEmail === auth.currentUser.email;

                if (!isOwner && !isAdmin) {
                    throw new Error("Access Denied: You are not authorized to manage this vendor account.");
                }

                setVendor(vData);

                // Fetch Joined Conferences by finding sponsors that link to this vendor
                const q = query(collectionGroup(db, 'sponsors'), where('vendorId', '==', vendorId));
                const snap = await getDocs(q);
                const confs = snap.docs.map(d => {
                    const confRef = d.ref.parent.parent;
                    return confRef ? { id: confRef.id, name: confRef.id } : null; // simplified name to confId
                }).filter(c => c !== null) as { id: string, name: string }[];

                // Remove duplicates in case a vendor is mapped magically multiple times
                const uniqueConfs = Array.from(new Map(confs.map(item => [item.id, item])).values());

                setConferences(uniqueConfs);
                if (uniqueConfs.length > 0) {
                    setConferenceId(uniqueConfs[0].id); // Default to first conf
                }

                await fetchVisits(vendorId);
            } catch (e) {
                console.error(e);
                setError(e instanceof Error ? e.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [vid, navigate]);

    // 2. Fetch Leads (Vendor DB)
    const fetchVisits = async (vendorId: string) => {
        try {
            const q = query(
                collection(db, `vendors/${vendorId}/leads`),
                orderBy('timestamp', 'desc'),
                limit(50)
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
            let regSnap = await getDocs(regQ);

            // Fallback for DEV, just match ID directly if QR is simple 
            if (regSnap.empty) {
                const directRef = doc(db, `conferences/${conferenceId}/registrations`, qrData);
                const singleDoc = await getDoc(directRef);
                if (singleDoc.exists()) {
                    regSnap = { docs: [singleDoc], empty: false } as any;
                }
            }

            if (regSnap.empty) {
                throw new Error('유효하지 않은 QR 코드이거나 해당 학회에 등록되지 않은 참석자입니다.');
            }

            const reg = regSnap.docs[0].data() as Registration;
            const regId = regSnap.docs[0].id;
            reg.id = regId;

            // Try fetching from users collection or fallback to registration data
            const userRef = doc(db, `conferences/${conferenceId}/users/${reg.userId || regId}`);
            const userSnap = await getDoc(userRef);

            const userData = userSnap.exists() ? (userSnap.data() as ConferenceUser) : {
                id: reg.userId || regId,
                name: (reg as any).userName || (reg as any).name || '알 수 없음',
                email: (reg as any).email,
                phone: (reg as any).phone,
                affiliation: (reg as any).affiliation || (reg as any).organization
            } as any as ConferenceUser;

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
            };

            if (agreed) {
                leadData.visitorOrg = (scanResult.user as any).affiliations?.[0]?.name || (scanResult.user as any).affiliation || (scanResult.reg as any).affiliation || '';
                leadData.visitorPhone = (scanResult.user as any).phone || (scanResult.reg as any).phone || '';
                leadData.visitorEmail = (scanResult.user as any).email || (scanResult.reg as any).email || '';
            }

            await addDoc(collection(db, `vendors/${vendor.id}/leads`), leadData);

            // STAMP TOUR: Write to /conferences/{confId}/stamps (Gamification Validation)
            // Even if denied, grant the stamp for the tour.
            await addDoc(collection(db, `conferences/${conferenceId}/stamps`), {
                userId: scanResult.user.id,
                vendorId: vendor.id,
                vendorName: vendor.name,
                timestamp: Timestamp.now()
            });

            setScanResult(null);
            await fetchVisits(vendor.id);
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

            toast.success('프로필이 업데이트 되었습니다!');
        } catch (e) {
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
        fetchVisits,
        scanBadge,
        processVisit,
        resetScan,
        updateVendorProfile,
        logout: () => auth.signOut(),
        login: () => navigate('/admin/login')
    };
};
