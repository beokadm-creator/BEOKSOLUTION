import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import toast from 'react-hot-toast';

export const useSuperAdminSettings = () => {
    const [settingsLang, setSettingsLang] = useState<'KO' | 'EN'>('KO');
    const [termsService, setTermsService] = useState('');
    const [termsServiceEn, setTermsServiceEn] = useState('');
    const [privacy, setPrivacy] = useState('');
    const [privacyEn, setPrivacyEn] = useState('');
    const [thirdParty, setThirdParty] = useState('');
    const [thirdPartyEn, setThirdPartyEn] = useState('');
    const [termsMarketing, setTermsMarketing] = useState('');
    const [termsMarketingEn, setTermsMarketingEn] = useState('');
    const [termsAdInfo, setTermsAdInfo] = useState('');
    const [termsAdInfoEn, setTermsAdInfoEn] = useState('');
    const [termsPrivacy, setTermsPrivacy] = useState('');
    const [termsPrivacyEn, setTermsPrivacyEn] = useState('');
    const [loadingSettings, setLoadingSettings] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoadingSettings(true);
            try {
                const snap = await getDoc(doc(db, 'system', 'settings'));
                if (snap.exists()) {
                    const data = snap.data() as {
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
                    };
                    setPrivacy(data.privacy || '');
                    setPrivacyEn(data.privacyEn || '');
                    setTermsService(data.termsService || '');
                    setTermsServiceEn(data.termsServiceEn || '');
                    setTermsAdInfo(data.termsAdInfo || '');
                    setTermsAdInfoEn(data.termsAdInfoEn || '');
                    setTermsMarketing(data.termsMarketing || '');
                    setTermsMarketingEn(data.termsMarketingEn || '');
                    setTermsPrivacy(data.termsPrivacy || '');
                    setTermsPrivacyEn(data.termsPrivacyEn || '');
                    setThirdParty(data.thirdParty || '');
                    setThirdPartyEn(data.thirdPartyEn || '');
                }
            } catch (e) {
                console.error("Fetch Settings Error:", e);
            } finally {
                setLoadingSettings(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSaveSettings = async () => {
        const toastId = toast.loading("Saving settings...");
        try {
            await setDoc(doc(db, 'system', 'settings'), {
                privacy,
                privacyEn,
                termsService,
                termsServiceEn,
                termsAdInfo,
                termsAdInfoEn,
                termsMarketing,
                termsMarketingEn,
                termsPrivacy,
                termsPrivacyEn,
                thirdParty,
                thirdPartyEn,
                updatedAt: new Date()
            }, { merge: true });
            toast.success("Settings saved.", { id: toastId });
        } catch (e) {
            console.error("Save Settings Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    return {
        settingsLang,
        setSettingsLang,
        termsService,
        setTermsService,
        termsServiceEn,
        setTermsServiceEn,
        privacy,
        setPrivacy,
        privacyEn,
        setPrivacyEn,
        thirdParty,
        setThirdParty,
        thirdPartyEn,
        setThirdPartyEn,
        termsMarketing,
        setTermsMarketing,
        termsMarketingEn,
        setTermsMarketingEn,
        termsAdInfo,
        setTermsAdInfo,
        termsAdInfoEn,
        setTermsAdInfoEn,
        termsPrivacy,
        setTermsPrivacy,
        termsPrivacyEn,
        setTermsPrivacyEn,
        loadingSettings,
        handleSaveSettings
    };
};
