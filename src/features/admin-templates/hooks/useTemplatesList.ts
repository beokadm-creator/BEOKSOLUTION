import { useState, useCallback } from 'react';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { NotificationEventType, NotificationTemplate } from '@/types/schema';
import toast from 'react-hot-toast';

export function useTemplatesList(societyId: string | null) {
    const [templates, setTemplates] = useState<Record<NotificationEventType, NotificationTemplate[]>>({
        MEMBER_REGISTER: [],
        CONFERENCE_REGISTER: [],
        ABSTRACT_SUBMIT: [],
        ABSTRACT_ACCEPTED: [],
        ABSTRACT_REJECTED: [],
        PAYMENT_COMPLETE: [],
        CHECKIN_COMPLETE: [],
        DIGITAL_BADGE_ISSUED: []
    });
    const [loading, setLoading] = useState(true);

    const fetchTemplates = useCallback(async () => {
        if (!societyId) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, 'societies', societyId, 'notification-templates'),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);

            const fetched: Record<NotificationEventType, NotificationTemplate[]> = {
                MEMBER_REGISTER: [],
                CONFERENCE_REGISTER: [],
                ABSTRACT_SUBMIT: [],
                ABSTRACT_ACCEPTED: [],
                ABSTRACT_REJECTED: [],
                PAYMENT_COMPLETE: [],
                CHECKIN_COMPLETE: [],
                DIGITAL_BADGE_ISSUED: []
            };

            snapshot.docs.forEach(doc => {
                const template = {
                    id: doc.id,
                    societyId: societyId,
                    ...doc.data()
                } as NotificationTemplate;

                if (template.eventType && fetched[template.eventType]) {
                    fetched[template.eventType].push(template);
                }
            });

            setTemplates(fetched);
        } catch (error) {
            console.error("Error fetching templates:", error);
            toast.error("템플릿 목록을 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }, [societyId]);

    const handleDelete = async (templateId: string) => {
        if (!societyId) return;
        if (!window.confirm("정말로 이 템플릿을 삭제하시겠습니까?")) return;

        try {
            await deleteDoc(doc(db, 'societies', societyId, 'notification-templates', templateId));
            toast.success("템플릿이 삭제되었습니다.");
            fetchTemplates();
        } catch (error) {
            console.error("Error deleting template:", error);
            toast.error("삭제에 실패했습니다.");
        }
    };

    const handleToggleActive = async (template: NotificationTemplate) => {
        if (!societyId) return;

        try {
            await updateDoc(
                doc(db, 'societies', societyId, 'notification-templates', template.id),
                { isActive: !template.isActive, updatedAt: Timestamp.now() }
            );
            toast.success(`템플릿 ${template.isActive ? '비활성화' : '활성화'}되었습니다.`);
            fetchTemplates();
        } catch (error) {
            console.error("Error toggling template:", error);
            toast.error("상태 변경에 실패했습니다.");
        }
    };

    return {
        templates,
        loading,
        fetchTemplates,
        handleDelete,
        handleToggleActive
    };
}
