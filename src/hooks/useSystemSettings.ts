import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface SystemSettings {
    privacy?: string;
    privacyEn?: string;
    termsService?: string;
    termsServiceEn?: string;
    termsAdInfo?: string;
    termsAdInfoEn?: string;
    termsMarketing?: string;
    termsMarketingEn?: string;
    termsPrivacy?: string;
    termsPrivacyEn?: string;
    thirdParty?: string;
    thirdPartyEn?: string;
    updatedAt?: { seconds: number; nanoseconds: number };
}

export const useSystemSettings = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const snap = await getDoc(doc(db, 'system', 'settings'));
                if (snap.exists()) {
                    const data = snap.data() as SystemSettings;
                    setSettings(data);
                } else {
                    setSettings(null);
                }
            } catch (e) {
                console.error('Failed to fetch system settings:', e);
                setError(e instanceof Error ? e.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    return { settings, loading, error };
};
