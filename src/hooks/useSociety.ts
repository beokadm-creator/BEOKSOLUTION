import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Society } from '../types/schema';

export const useSociety = () => {
    const [society, setSociety] = useState<Society | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSociety = async () => {
            const host = window.location.hostname;
            const parts = host.split('.');
            let societyId = null;

            if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
                societyId = parts[0];
            } else if (host.includes('localhost') || host.includes('web.app')) {
                 // Dev fallback or need a way to simulate
                 // societyId = 'kap'; // Uncomment for dev testing
            }

            if (!societyId) {
                // Force check for 'kadd' if domain is kadd.eregi.co.kr (safety net)
                if (host.startsWith('kadd.')) {
                    societyId = 'kadd';
                } else {
                    setLoading(false);
                    return;
                }
            }

            try {
                const docRef = doc(db, 'societies', societyId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSociety({ id: docSnap.id, ...docSnap.data() } as Society);
                } else {
                    console.error(`[useSociety] Society document not found: ${societyId}`);
                    setError('Society not found');
                }
            } catch (err: any) {
                console.error(`[useSociety] Error fetching society:`, err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSociety();
    }, []);

    return { society, loading, error };
};
