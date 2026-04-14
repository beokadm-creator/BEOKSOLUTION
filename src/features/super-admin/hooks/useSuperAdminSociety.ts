import { useState } from 'react';
import { doc, updateDoc, deleteDoc, getDoc, getDocs, collection, query, where, limit } from 'firebase/firestore';
import { db } from '@/firebase';
import toast from 'react-hot-toast';
import { Society } from '@/types/schema';

export const useSuperAdminSociety = (
    refreshSocieties: () => Promise<void>,
    createSocietyHook: (id: string, nameKo: string, nameEn: string, adminEmail: string) => Promise<boolean>
) => {
    const [socNameKo, setSocNameKo] = useState('');
    const [socNameEn, setSocNameEn] = useState('');
    const [socAdmin, setSocAdmin] = useState('');
    const [socDomainCode, setSocDomainCode] = useState('');

    const [editingSoc, setEditingSoc] = useState<{
        id: string;
        name: { ko: string; en?: string };
        description?: { ko?: string };
        homepageUrl?: string;
        adminEmails?: string[];
        domainCode?: string;
        aliases?: string[]
    } | null>(null);

    const [editDescKo, setEditDescKo] = useState('');
    const [editHomepage, setEditHomepage] = useState('');
    const [editDomainCode, setEditDomainCode] = useState('');
    const [editAliases, setEditAliases] = useState('');
    const [deletingSocietyId, setDeletingSocietyId] = useState<string | null>(null);

    const handleCreateSociety = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!socNameKo) return toast.error("사회명 (한글) 필수");
        if (!socAdmin) return toast.error("관리자 이메일 필수");
        if (!socNameEn) return toast.error("사회명 (영어) 필수");

        const toastId = toast.loading("Creating society...");
        const computedId = socNameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const societyId = (socDomainCode || computedId).toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
        if (!societyId) {
            toast.error("유효한 학회 도메인 코드(sid)를 입력하세요.", { id: toastId });
            return;
        }
        try {
            await createSocietyHook(societyId, socNameKo, socNameEn, socAdmin);
            toast.success("Society created.", { id: toastId });
            setSocNameKo('');
            setSocNameEn('');
            setSocAdmin('');
            setSocDomainCode('');
        } catch (e) {
            console.error("Create Society Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    const handleUpdateSociety = async (societyId: string) => {
        const toastId = toast.loading("Updating society...");
        try {
            const societyRef = doc(db, 'societies', societyId);
            await updateDoc(societyRef, {
                name: { ko: editDescKo },
                description: { ko: editDescKo },
                homepageUrl: editHomepage,
                domainCode: (editDomainCode || societyId).toLowerCase().trim(),
                aliases: Array.from(
                    new Set(
                        editAliases
                            .split(',')
                            .map((a) => a.trim().toLowerCase())
                            .filter(Boolean)
                    )
                )
            });
            toast.success("Updated.", { id: toastId });
            setEditingSoc(null);
            setEditDescKo('');
            setEditHomepage('');
            setEditDomainCode('');
            setEditAliases('');
            await refreshSocieties();
        } catch (e) {
            console.error("Update Society Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    const handleDeleteSociety = async (societyId: string, societyName: string) => {
        const safetyCode = `DELETE ${societyId}`;
        const confirmed = window.confirm(
            `"${societyName}" 학회를 삭제하시겠습니까?\n\n주의: 삭제 후 복구할 수 없습니다.\n연결 데이터가 없는 경우에만 삭제됩니다.`
        );
        if (!confirmed) return;
        const typed = window.prompt(`2차 확인: 아래 문구를 정확히 입력하세요.\n${safetyCode}`);
        if (typed !== safetyCode) {
            toast.error('2차 확인 문구가 일치하지 않아 삭제를 취소했습니다.');
            return;
        }

        setDeletingSocietyId(societyId);
        const toastId = toast.loading("학회 삭제 준비 중...");
        try {
            const societySnap = await getDoc(doc(db, 'societies', societyId));
            const societyData = societySnap.exists() ? societySnap.data() as { domainCode?: string } : {};
            const domainCode = (societyData.domainCode || societyId).toLowerCase();
            const societyKeys = Array.from(new Set([societyId, domainCode].filter(Boolean)));
            const confSnap = await getDocs(
                societyKeys.length === 1
                    ? query(collection(db, 'conferences'), where('societyId', '==', societyKeys[0]), limit(1))
                    : query(collection(db, 'conferences'), where('societyId', 'in', societyKeys.slice(0, 10)), limit(1))
            );
            if (!confSnap.empty) {
                toast.error('연결된 학술대회가 있어 삭제할 수 없습니다. 먼저 학술대회 정리 후 다시 시도하세요.', { id: toastId });
                return;
            }

            const codeSnap = await getDocs(collection(db, 'societies', societyId, 'verification_codes'));
            if (!codeSnap.empty) {
                await Promise.all(codeSnap.docs.map((d) => deleteDoc(d.ref)));
            }

            await deleteDoc(doc(db, 'societies', societyId));
            if (editingSoc?.id === societyId) {
                setEditingSoc(null);
            }
            await refreshSocieties();
            toast.success('학회가 삭제되었습니다.', { id: toastId });
        } catch (e) {
            console.error("Delete Society Error:", e);
            toast.error(`삭제 실패: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        } finally {
            setDeletingSocietyId(null);
        }
    };

    return {
        socNameKo, setSocNameKo,
        socNameEn, setSocNameEn,
        socAdmin, setSocAdmin,
        socDomainCode, setSocDomainCode,
        editingSoc, setEditingSoc,
        editDescKo, setEditDescKo,
        editHomepage, setEditHomepage,
        editDomainCode, setEditDomainCode,
        editAliases, setEditAliases,
        deletingSocietyId,
        handleCreateSociety,
        handleUpdateSociety,
        handleDeleteSociety
    };
};
