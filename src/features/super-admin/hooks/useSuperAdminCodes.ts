import { useState, useCallback } from 'react';
import { collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import toast from 'react-hot-toast';

export const useSuperAdminCodes = () => {
    const [codes, setCodes] = useState<Array<{
        id: string;
        societyId: string;
        name: string;
        code: string;
        used: boolean;
        usedBy?: string;
        usedAt?: { seconds: number } | Date;
        expiryDate?: { seconds: number } | Date;
    }>>([]);
    const [loadingCodes, setLoadingCodes] = useState(false);

    const fetchCodes = useCallback(async (currentSocietyId: string) => {
        if (!currentSocietyId) return;
        setLoadingCodes(true);
        try {
            const codeRef = collection(db, 'societies', currentSocietyId, 'verification_codes');
            const snap = await getDocs(codeRef);
            setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; societyId: string; name: string; code: string; used: boolean; usedBy?: string; usedAt?: { seconds: number } | Date; expiryDate?: { seconds: number } | Date })));
        } catch (e) {
            console.error("Fetch Codes Error:", e);
        } finally {
            setLoadingCodes(false);
        }
    }, []);

    const handleCreateCode = async (
        newCodeSocId: string,
        newCodeName: string,
        newCodeValue: string,
        newCodeExpiry: string,
        onSuccess: () => void
    ) => {
        if (!newCodeSocId || !newCodeName || !newCodeValue) {
            toast.error("필수 항목 누락");
            return;
        }

        const toastId = toast.loading("Creating code...");
        try {
            const codeRef = collection(db, 'societies', newCodeSocId, 'verification_codes');
            await addDoc(codeRef, {
                name: newCodeName,
                code: newCodeValue,
                expiryDate: newCodeExpiry ? new Date(newCodeExpiry) : null,
                used: false
            });
            toast.success("Code created.", { id: toastId });
            onSuccess();
            fetchCodes(newCodeSocId); // Refresh codes if the current society is the one we added to
        } catch (e) {
            console.error("Create Code Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    const handleResetCodes = async (currentSocietyId: string) => {
        if (!confirm("모든 코드를 리셋합니다. 진행하시겠습니까?")) return;

        const toastId = toast.loading("Resetting codes...");
        try {
            const codeRef = collection(db, 'societies', currentSocietyId, 'verification_codes');
            const snap = await getDocs(codeRef);
            const batch = snap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(batch);
            toast.success("All codes reset.", { id: toastId });
            setCodes([]);
        } catch (e) {
            console.error("Reset Codes Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    return {
        codes,
        loadingCodes,
        fetchCodes,
        handleCreateCode,
        handleResetCodes
    };
};
