import { useState, useEffect } from 'react';
import { doc, getDoc, collection, addDoc, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { ConferenceUser, Registration } from '../types/schema';

// Mock Vendor Auth (In real app, dedicated collection or Firebase Auth with claims)
const mockVendorLogin = async (confId: string, code: string): Promise<{ id: string; name: string } | null> => {
    // Simulate lookup
    if (code === 'VENDOR123') return { id: 'vendor_samsung', name: 'Samsung Electronics' };
    return null;
};

export interface VisitLog {
    id: string;
    visitorName: string; // If consented, else "Anonymous"
    visitorPhone?: string;
    timestamp: Date;
    isConsentAgreed: boolean;
}

export const useVendor = (conferenceId: string) => {
    const [vendor, setVendor] = useState<{ id: string; name: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<{ user: ConferenceUser; reg: Registration } | null>(null);
    const [visits, setVisits] = useState<VisitLog[]>([]);

    // 1. Login
    const login = async (code: string) => {
        setLoading(true);
        const v = await mockVendorLogin(conferenceId, code);
        if (v) {
            setVendor(v);
            localStorage.setItem(`vendor_${conferenceId}`, JSON.stringify(v));
            fetchVisits(v.id);
        } else {
            setError('Invalid Vendor Code');
        }
        setLoading(false);
    };

    // Auto-login from storage
    useEffect(() => {
        const stored = localStorage.getItem(`vendor_${conferenceId}`);
        if (stored) {
            const v = JSON.parse(stored);
            setVendor(v);
            fetchVisits(v.id);
        }
    }, [conferenceId]);

    // 2. Fetch Recent Visits
    const fetchVisits = async (vendorId: string) => {
        try {
            const q = query(
                collection(db, `conferences/${conferenceId}/booth_visits`),
                where('vendorId', '==', vendorId),
                orderBy('timestamp', 'desc'),
                limit(10)
            );
            const snap = await getDocs(q);
            // Need to fetch user names if consented? Or stored in visit log?
            // For efficiency, assume visit log has denormalized data or we fetch.
            // Let's assume we store name in log for simplicity.
            const list = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    visitorName: data.isConsentAgreed ? data.visitorName : 'Anonymous',
                    timestamp: data.timestamp.toDate(),
                    isConsentAgreed: data.isConsentAgreed
                };
            });
            setVisits(list);
        } catch (e) {
            console.error(e);
        }
    };

    // 3. Scan Badge
    const scanBadge = async (qrData: string) => {
        setLoading(true);
        setError(null);
        setScanResult(null);
        try {
            // Find Registration by Badge QR
            const regQ = query(collection(db, `conferences/${conferenceId}/registrations`), where('badgeQr', '==', qrData));
            const regSnap = await getDocs(regQ);
            
            if (regSnap.empty) throw new Error('Invalid Badge QR');
            
            const reg = regSnap.docs[0].data() as Registration;
            
            // Find User
            const userRef = doc(db, `conferences/${conferenceId}/users/${reg.userId}`);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) throw new Error('User Data Not Found');
            
            setScanResult({
                user: userSnap.data() as ConferenceUser,
                reg
            });

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // 4. Process Consent & Save
    const processVisit = async (agreed: boolean) => {
        if (!vendor || !scanResult) return;
        setLoading(true);
        try {
            await addDoc(collection(db, `conferences/${conferenceId}/booth_visits`), {
                vendorId: vendor.id,
                vendorName: vendor.name,
                visitorId: scanResult.user.id,
                visitorName: scanResult.user.name, // Storing for convenience, usually only if agreed
                isConsentAgreed: agreed,
                timestamp: Timestamp.now()
            });

            if (agreed) {
                // Trigger Promo (Mock)
                console.log(`[Vendor] Sending Promo to ${scanResult.user.phone}`);
            }

            alert(agreed ? 'Lead Collected!' : 'Anonymous Visit Recorded');
            setScanResult(null); // Reset
            fetchVisits(vendor.id); // Refresh list

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        setVendor(null);
        localStorage.removeItem(`vendor_${conferenceId}`);
    };

    return { vendor, loading, error, scanResult, visits, login, logout, scanBadge, processVisit };
};
