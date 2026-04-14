import { useState } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/firebase';
import toast from 'react-hot-toast';

export function useNhnAlimtalk(societyId: string | null) {
    const [isNhnImportOpen, setIsNhnImportOpen] = useState(false);
    const [nhnTemplates, setNhnTemplates] = useState<unknown[]>([]);
    const [loadingNhn, setLoadingNhn] = useState(false);

    const handleFetchNhnTemplates = async () => {
        if (!societyId) return;
        setLoadingNhn(true);
        try {
            const infraDoc = await getDoc(
                doc(db, 'societies', societyId, 'settings', 'infrastructure')
            );
            const senderKey = infraDoc.data()?.notification?.nhnAlimTalk?.senderKey;

            if (!senderKey) {
                toast.error("NHN Cloud 발신 프로필 키가 설정되지 않았습니다.\nInfrastructure Settings에서 먼저 설정해주세요.");
                setLoadingNhn(false);
                return;
            }

            const getNhnTemplatesFn = httpsCallable(functions, 'getNhnAlimTalkTemplates');
            const result = await getNhnTemplatesFn({ senderKey, societyId });
            const data = result.data as { success: boolean; data?: { templateListResponse?: { templates?: unknown[] } } };

            if (data.success && data.data?.templateListResponse?.templates) {
                const templates = data.data.templateListResponse.templates;

                if (templates.length === 0) {
                    toast.error("승인된 템플릿이 없습니다.\nNHN Cloud Console에서 템플릿을 등록하고 승인받아주세요.");
                } else {
                    setNhnTemplates(templates);
                    setIsNhnImportOpen(true);
                    toast.success(`${templates.length}개의 승인된 템플릿을 불러왔습니다.`);
                }
            } else {
                toast.error("NHN Cloud 템플릿을 불러오지 못했습니다.");
            }
        } catch (error) {
            console.error("Failed to fetch NHN templates:", error);
            toast.error("NHN Cloud 템플릿 호출 중 오류가 발생했습니다.");
        } finally {
            setLoadingNhn(false);
        }
    };

    return {
        isNhnImportOpen,
        setIsNhnImportOpen,
        nhnTemplates,
        loadingNhn,
        handleFetchNhnTemplates
    };
}
