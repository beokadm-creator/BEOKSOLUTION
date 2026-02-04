import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ConferenceInfo, Society } from '../types/schema';

// Mock Auth for Super Admin (In real app, use Firebase Auth + Custom Claims or DB lookup)
// For demo, we just simulate "am I super admin?" check.
const checkIsSuperAdmin = async (): Promise<boolean> => {
    // In real app:
    // const docRef = doc(db, 'super_admins', email);
    // const snap = await getDoc(docRef);
    // return snap.exists();
    return true; // Always allow for demo
};

export const useSuperAdmin = () => {
    const [isSuper, setIsSuper] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [societies, setSocieties] = useState<Society[]>([]);

    useEffect(() => {
        // Simulate auth check
        checkIsSuperAdmin().then(setIsSuper);
        fetchSocieties();
    }, []);

    const fetchSocieties = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'societies'));
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Society));
            setSocieties(list);
        } catch (err) {
            console.error("Failed to fetch societies", err);
        }
    };

    const createSociety = async (
        id: string,
        nameKo: string,
        nameEn: string,
        adminEmail: string
    ) => {
        setLoading(true);
        setError(null);
        try {
            const societyRef = doc(db, 'societies', id);
            const snap = await getDoc(societyRef);
            if (snap.exists()) throw new Error("Society ID already exists");

            await setDoc(societyRef, {
                id,
                name: { ko: nameKo, en: nameEn },
                adminEmails: [adminEmail],
                createdAt: Timestamp.now()
            });
            
            await fetchSocieties(); // Refresh list
            setLoading(false);
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMessage);
            setLoading(false);
            return false;
        }
    };

    const createConference = async (
        societyId: string,
        slug: string, // Changed from id to slug
        titleKo: string,
        titleEn: string,
        startDate: string,
        endDate: string,
        location: string,
        adminEmail: string
    ) => {
        setLoading(true);
        setError(null);

        try {
            // Composite Key: societyId_slug
            const confId = `${societyId}_${slug}`;

            // 1. Create Conference Doc (conferences/{confId})
            const confRef = doc(db, 'conferences', confId);
            const confSnap = await getDoc(confRef);
            if (confSnap.exists()) {
                throw new Error("Conference ID already exists");
            }

            const startTs = Timestamp.fromDate(new Date(startDate));
            const endTs = Timestamp.fromDate(new Date(endDate));

            // Root Doc (Summary for listing)
            await setDoc(confRef, {
                id: confId,
                societyId,
                slug, // New Field
                title: { ko: titleKo, en: titleEn },
                dates: { start: startTs, end: endTs },
                location,
                status: 'PLANNING', // Default
                createdAt: Timestamp.now()
            });

            // 2. Create Detailed Info (conferences/{id}/info/general)
            const infoRef = doc(db, `conferences/${confId}/info/general`);
            const initialInfo: ConferenceInfo = {
                title: { ko: titleKo, en: titleEn },
                dates: { start: startTs, end: endTs },
                badgeLayout: { width: 400, height: 600, elements: [] },
                receiptConfig: { issuerName: titleKo, stampUrl: '', nextSerialNo: 1 }
            };
            await setDoc(infoRef, initialInfo);

            // 3. Create Admin Access (conferences/{id}/admins/{email})
            const adminRef = doc(db, `conferences/${confId}/admins/${adminEmail}`);
            await setDoc(adminRef, {
                email: adminEmail,
                role: 'MANAGER',
                createdAt: Timestamp.now()
            });

            // 4. Create Secrets Skeleton
            const secretsRef = doc(db, `conferences/${confId}/private_config/secrets`);
            await setDoc(secretsRef, {
                payment: { clientKey: '', secretKey: '', useGlobal: true },
                notification: { apiKey: '', senderKey: '', useGlobal: true },
                smtp: { host: '', port: 587, user: '', pass: '', useGlobal: true }
            });

            setLoading(false);
            return true;

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
            setLoading(false);
            return false;
        }
    };

    return { isSuper, loading, error, societies, createSociety, createConference };
};
