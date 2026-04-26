import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAdminStore } from '../store/adminStore';
import toast from 'react-hot-toast';
import type { NotificationEventType, NotificationTemplate, AlimTalkButton, EmailConfig, KakaoConfig, TemplateVariable } from '@/types/schema';
import { EVENT_TYPE_PRESETS } from '@/types/schema';

export type { NotificationEventType, NotificationTemplate, AlimTalkButton, TemplateVariable };

export interface UseTemplatesReturn {
    // Computed
    targetSocietyId: string | null;
    eventPresets: typeof EVENT_TYPE_PRESETS;
    currentTemplates: NotificationTemplate[];
    currentVariables: TemplateVariable[];

    // State
    selectedEventType: NotificationEventType;
    setSelectedEventType: React.Dispatch<React.SetStateAction<NotificationEventType>>;
    templates: Record<NotificationEventType, NotificationTemplate[]>;
    loading: boolean;
    isDialogOpen: boolean;
    setIsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    editingTemplate: NotificationTemplate | null;

    // Form State
    templateName: string;
    setTemplateName: React.Dispatch<React.SetStateAction<string>>;
    templateDescription: string;
    setTemplateDescription: React.Dispatch<React.SetStateAction<string>>;
    isActive: boolean;
    setIsActive: React.Dispatch<React.SetStateAction<boolean>>;
    emailSubject: string;
    setEmailSubject: React.Dispatch<React.SetStateAction<string>>;
    emailBody: string;
    setEmailBody: React.Dispatch<React.SetStateAction<string>>;
    isHtmlEmail: boolean;
    setIsHtmlEmail: React.Dispatch<React.SetStateAction<boolean>>;
    kakaoContent: string;
    setKakaoContent: React.Dispatch<React.SetStateAction<string>>;
    kakaoButtons: AlimTalkButton[];
    kakaoTemplateCode: string;
    setKakaoTemplateCode: React.Dispatch<React.SetStateAction<string>>;
    kakaoStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    setKakaoStatus: React.Dispatch<React.SetStateAction<'PENDING' | 'APPROVED' | 'REJECTED'>>;

    // NHN Import State
    isNhnImportOpen: boolean;
    setIsNhnImportOpen: React.Dispatch<React.SetStateAction<boolean>>;
    nhnTemplates: { templateId: string; name: string; content?: string }[];
    loadingNhn: boolean;

    // Actions
    fetchTemplates: () => Promise<void>;
    handleCreate: () => void;
    handleEdit: (template: NotificationTemplate) => void;
    handleSave: () => Promise<void>;
    handleDelete: (templateId: string) => Promise<void>;
    handleToggleActive: (template: NotificationTemplate) => Promise<void>;
    insertVariable: (key: string) => void;
    handleAddKakaoButton: () => void;
    updateKakaoButton: (index: number, field: keyof AlimTalkButton, value: string) => void;
    handleSmartLinkPreset: (index: number, preset: string) => void;
    removeKakaoButton: (index: number) => void;
    handleFetchNhnTemplates: () => Promise<void>;
    handleSelectNhnTemplate: (tpl: unknown) => void;
}

export function useTemplates(): UseTemplatesReturn {
    const { selectedSocietyId } = useAdminStore();

    // State
    const [selectedEventType, setSelectedEventType] = useState<NotificationEventType>('MEMBER_REGISTER');
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
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);

    // Form State
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [isActive, setIsActive] = useState(true);

    // Email Form State
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [isHtmlEmail, setIsHtmlEmail] = useState(false);

    // Kakao Form State
    const [kakaoContent, setKakaoContent] = useState('');
    const [kakaoButtons, setKakaoButtons] = useState<AlimTalkButton[]>([]);
    const [kakaoTemplateCode, setKakaoTemplateCode] = useState('');
    const [kakaoStatus, setKakaoStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');



    // NHN Cloud Import State
    const [isNhnImportOpen, setIsNhnImportOpen] = useState(false);
    const [nhnTemplates, setNhnTemplates] = useState<{ templateId: string; name: string; content?: string }[]>([]);
    const [loadingNhn, setLoadingNhn] = useState(false);



    // Get Society ID
    const getSocietyId = () => {
        if (selectedSocietyId) return selectedSocietyId;
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') return parts[0];
        return null;
    };

    const targetSocietyId = getSocietyId();

    // Fetch Templates
    const fetchTemplates = useCallback(async () => {
        if (!targetSocietyId) return;
        setLoading(true);
        try {
            // Fetch from new notification-templates collection
            // Fixed: Use single collection with eventType field (not subcollection)
            const q = query(
                collection(db, 'societies', targetSocietyId, 'notification-templates'),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);

            // Group templates by eventType
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
                    societyId: targetSocietyId,
                    ...doc.data()
                } as NotificationTemplate;

                // Group by eventType from document data
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
    }, [targetSocietyId]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    // Fetch NHN Cloud Templates
    const handleFetchNhnTemplates = async () => {
        setLoadingNhn(true);
        try {
            // Get senderKey from Infrastructure settings
            const infraDoc = await getDoc(
                doc(db, 'societies', targetSocietyId!, 'settings', 'infrastructure')
            );
            const senderKey = infraDoc.data()?.notification?.nhnAlimTalk?.senderKey;

            if (!senderKey) {
                toast.error("NHN Cloud 발신 프로필 키가 설정되지 않았습니다.\nInfrastructure Settings에서 먼저 설정해주세요.");
                setLoadingNhn(false);
                return;
            }

            const getNhnTemplatesFn = httpsCallable(functions, 'getNhnAlimTalkTemplates');
            const result = await getNhnTemplatesFn({ senderKey, societyId: targetSocietyId });
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



    // Select NHN Cloud Template
    const handleSelectNhnTemplate = (tpl: unknown) => {
        setKakaoContent(tpl.templateContent);
        setKakaoTemplateCode(tpl.templateCode);

        // Parse buttons
        if (tpl.buttons && Array.isArray(tpl.buttons)) {
            const mappedButtons = tpl.buttons.map((b: unknown) => ({
                name: b.name,
                type: b.linkType || 'WL',
                linkMobile: b.linkMo || '',
                linkPc: b.linkPc || ''
            }));
            setKakaoButtons(mappedButtons);
        } else {
            setKakaoButtons([]);
        }

        // NHN Cloud returns only approved templates, so set to APPROVED
        setKakaoStatus('APPROVED');

        setIsNhnImportOpen(false);
        toast.success("NHN Cloud 템플릿을 불러왔습니다.");
    };

    // Insert Variable
    const insertVariable = (key: string) => {
        const variable = `#{${key}}`;
        // Abstract events → Kakao content
        if (selectedEventType === 'ABSTRACT_SUBMIT' || selectedEventType === 'ABSTRACT_ACCEPTED' || selectedEventType === 'ABSTRACT_REJECTED') {
            setKakaoContent(prev => prev + variable);
        } else if (selectedEventType === 'CONFERENCE_REGISTER' || selectedEventType === 'DIGITAL_BADGE_ISSUED') {
            // Conference registration & Digital badge issuance → add to both email and kakao
            setEmailBody(prev => prev + variable);
            setKakaoContent(prev => prev + variable);
        } else {
            // Other events → Email content
            setEmailBody(prev => prev + variable);
        }
    };

    // Add Kakao Button
    const handleAddKakaoButton = () => {
        setKakaoButtons([...kakaoButtons, {
            name: '홈페이지 이동',
            type: 'WL',
            linkMobile: '',
            linkPc: ''
        }]);
    };

    const updateKakaoButton = (index: number, field: keyof AlimTalkButton, value: string) => {
        const updated = [...kakaoButtons];
        updated[index] = { ...updated[index], [field]: value };
        setKakaoButtons(updated);
    };

    const handleSmartLinkPreset = (index: number, preset: string) => {
        const domain = `https://${targetSocietyId}.eregi.co.kr`;
        let url = '';

        switch (preset) {
            case 'custom': url = ''; break;
            case 'qr': url = `#{digitalBadgeQrUrl}`; break;
            case 'badge': url = `#{digitalBadgeQrUrl}`; break;
            case 'landing': url = domain; break;
            case 'badge-prep': url = `#{badgePrepUrl}`; break;      // 배지 수령 전 QR 페이지
            case 'digital-badge': url = `#{digitalBadgeQrUrl}`; break;  // 디지털 명찰 QR URL
        }

        const updated = [...kakaoButtons];
        updated[index] = { ...updated[index], linkMobile: url, linkPc: url };
        setKakaoButtons(updated);
    };

    const removeKakaoButton = (index: number) => {
        setKakaoButtons(kakaoButtons.filter((_, i) => i !== index));
    };

    // Reset Form
    const resetForm = () => {
        setTemplateName('');
        setTemplateDescription('');
        setIsActive(true);
        setEmailSubject('');
        setEmailBody('');
        setIsHtmlEmail(false);
        setKakaoContent('');
        setKakaoButtons([]);
        setKakaoTemplateCode('');
        setKakaoStatus('PENDING');
        setEditingTemplate(null);
    };

    // Save Template
    const handleSave = async () => {
        if (!targetSocietyId) return;
        if (!templateName) {
            toast.error("템플릿 이름을 입력해주세요.");
            return;
        }

        // Validate at least one channel
        const hasEmail = emailSubject && emailBody;
        const hasKakao = kakaoContent;

        if (!hasEmail && !hasKakao) {
            toast.error("최소 하나의 채널(이메일 또는 알림톡)을 설정해주세요.");
            return;
        }

        try {
            const templateData: Partial<NotificationTemplate> = {
                eventType: selectedEventType,
                societyId: targetSocietyId,
                name: templateName,
                description: templateDescription,
                isActive,
                variables: EVENT_TYPE_PRESETS[selectedEventType].variables,
                channels: {},
                updatedAt: Timestamp.now(),
                createdAt: Timestamp.now()
            };

            // Add Email Config
            if (hasEmail) {
                templateData.channels!.email = {
                    subject: emailSubject,
                    body: emailBody,
                    isHtml: isHtmlEmail
                } as EmailConfig;
            }

            // Add Kakao Config
            if (hasKakao) {
                templateData.channels!.kakao = {
                    content: kakaoContent,
                    buttons: kakaoButtons,
                    kakaoTemplateCode: kakaoTemplateCode || undefined,
                    status: kakaoStatus
                } as KakaoConfig;
            }

            if (editingTemplate) {
                // Update existing - use direct doc reference
                await updateDoc(
                    doc(db, 'societies', targetSocietyId, 'notification-templates', editingTemplate.id),
                    templateData
                );
                toast.success("템플릿이 수정되었습니다.");
            } else {
                // Create new - use single collection
                await addDoc(collection(db, 'societies', targetSocietyId, 'notification-templates'), templateData);
                toast.success("템플릿이 생성되었습니다.");
            }

            setIsDialogOpen(false);
            resetForm();
            fetchTemplates();
        } catch (error) {
            console.error("Error saving template:", error);
            toast.error("저장에 실패했습니다.");
        }
    };

    // Delete Template
    const handleDelete = async (templateId: string) => {
        if (!targetSocietyId) return;
        if (!window.confirm("정말로 이 템플릿을 삭제하시겠습니까?")) return;

        try {
            await deleteDoc(doc(db, 'societies', targetSocietyId, 'notification-templates', templateId));
            toast.success("템플릿이 삭제되었습니다.");
            fetchTemplates();
        } catch (error) {
            console.error("Error deleting template:", error);
            toast.error("삭제에 실패했습니다.");
        }
    };

    // Toggle Active
    const handleToggleActive = async (template: NotificationTemplate) => {
        if (!targetSocietyId) return;

        try {
            await updateDoc(
                doc(db, 'societies', targetSocietyId, 'notification-templates', template.id),
                { isActive: !template.isActive, updatedAt: Timestamp.now() }
            );
            toast.success(`템플릿 ${template.isActive ? '비활성화' : '활성화'}되었습니다.`);
            fetchTemplates();
        } catch (error) {
            console.error("Error toggling template:", error);
            toast.error("상태 변경에 실패했습니다.");
        }
    };

    // Open Dialog for New Template
    const handleCreate = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    // Open Dialog for Editing
    const handleEdit = (template: NotificationTemplate) => {
        setEditingTemplate(template);
        setTemplateName(template.name);
        setTemplateDescription(template.description || '');
        setIsActive(template.isActive);

        if (template.channels.email) {
            setEmailSubject(template.channels.email.subject);
            setEmailBody(template.channels.email.body);
            setIsHtmlEmail(template.channels.email.isHtml);
        } else {
            setEmailSubject('');
            setEmailBody('');
            setIsHtmlEmail(false);
        }

        if (template.channels.kakao) {
            setKakaoContent(template.channels.kakao.content);
            setKakaoButtons(template.channels.kakao.buttons || []);
            setKakaoTemplateCode(template.channels.kakao.kakaoTemplateCode || '');
            setKakaoStatus(template.channels.kakao.status || 'PENDING');
        } else {
            setKakaoContent('');
            setKakaoButtons([]);
            setKakaoTemplateCode('');
            setKakaoStatus('PENDING');
        }

        setIsDialogOpen(true);
    };

    // Computed values
    const eventPresets = EVENT_TYPE_PRESETS;
    const currentTemplates = templates[selectedEventType] || [];
    const currentVariables = eventPresets[selectedEventType]?.variables || [];

    return {
        // Computed
        targetSocietyId,
        eventPresets,
        currentTemplates,
        currentVariables,

        // State
        selectedEventType,
        setSelectedEventType,
        templates,
        loading,
        isDialogOpen,
        setIsDialogOpen,
        editingTemplate,

        // Form State
        templateName,
        setTemplateName,
        templateDescription,
        setTemplateDescription,
        isActive,
        setIsActive,
        emailSubject,
        setEmailSubject,
        emailBody,
        setEmailBody,
        isHtmlEmail,
        setIsHtmlEmail,
        kakaoContent,
        setKakaoContent,
        kakaoButtons,
        kakaoTemplateCode,
        setKakaoTemplateCode,
        kakaoStatus,
        setKakaoStatus,

        // NHN Import State
        isNhnImportOpen,
        setIsNhnImportOpen,
        nhnTemplates,
        loadingNhn,

        // Actions
        fetchTemplates,
        handleCreate,
        handleEdit,
        handleSave,
        handleDelete,
        handleToggleActive,
        insertVariable,
        handleAddKakaoButton,
        updateKakaoButton,
        handleSmartLinkPreset,
        removeKakaoButton,
        handleFetchNhnTemplates,
        handleSelectNhnTemplate,
    };
}
