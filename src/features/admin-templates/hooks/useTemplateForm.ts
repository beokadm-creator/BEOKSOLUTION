import { useState } from 'react';
import { addDoc, collection, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { NotificationEventType, NotificationTemplate, AlimTalkButton, EmailConfig, KakaoConfig, EVENT_TYPE_PRESETS } from '@/types/schema';
import toast from 'react-hot-toast';

export function useTemplateForm(
    societyId: string | null,
    onSuccess: () => void
) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);

    // Basic State
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [isActive, setIsActive] = useState(true);

    // Email State
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [isHtmlEmail, setIsHtmlEmail] = useState(false);

    // Kakao State
    const [kakaoContent, setKakaoContent] = useState('');
    const [kakaoButtons, setKakaoButtons] = useState<AlimTalkButton[]>([]);
    const [kakaoTemplateCode, setKakaoTemplateCode] = useState('');
    const [kakaoStatus, setKakaoStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

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

    const handleCreate = () => {
        resetForm();
        setIsDialogOpen(true);
    };

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

    const handleSave = async (selectedEventType: NotificationEventType) => {
        if (!societyId) return;
        if (!templateName) {
            toast.error("템플릿 이름을 입력해주세요.");
            return;
        }

        const hasEmail = emailSubject && emailBody;
        const hasKakao = kakaoContent;

        if (!hasEmail && !hasKakao) {
            toast.error("최소 하나의 채널(이메일 또는 알림톡)을 설정해주세요.");
            return;
        }

        try {
            const templateData: Partial<NotificationTemplate> = {
                eventType: selectedEventType,
                societyId: societyId,
                name: templateName,
                description: templateDescription,
                isActive,
                variables: EVENT_TYPE_PRESETS[selectedEventType].variables,
                channels: {},
                updatedAt: Timestamp.now(),
            };

            if (!editingTemplate) {
                templateData.createdAt = Timestamp.now();
            }

            if (hasEmail) {
                templateData.channels!.email = {
                    subject: emailSubject,
                    body: emailBody,
                    isHtml: isHtmlEmail
                } as EmailConfig;
            }

            if (hasKakao) {
                templateData.channels!.kakao = {
                    content: kakaoContent,
                    buttons: kakaoButtons,
                    kakaoTemplateCode: kakaoTemplateCode || undefined,
                    status: kakaoStatus
                } as KakaoConfig;
            }

            if (editingTemplate) {
                await updateDoc(
                    doc(db, 'societies', societyId, 'notification-templates', editingTemplate.id),
                    templateData
                );
                toast.success("템플릿이 수정되었습니다.");
            } else {
                await addDoc(collection(db, 'societies', societyId, 'notification-templates'), templateData);
                toast.success("템플릿이 생성되었습니다.");
            }

            setIsDialogOpen(false);
            resetForm();
            onSuccess();
        } catch (error) {
            console.error("Error saving template:", error);
            toast.error("저장에 실패했습니다.");
        }
    };

    const insertVariable = (key: string, selectedEventType: NotificationEventType) => {
        const variable = `#{${key}}`;
        if (selectedEventType === 'ABSTRACT_SUBMIT' || selectedEventType === 'ABSTRACT_ACCEPTED' || selectedEventType === 'ABSTRACT_REJECTED') {
            setKakaoContent(prev => prev + variable);
        } else if (selectedEventType === 'CONFERENCE_REGISTER' || selectedEventType === 'DIGITAL_BADGE_ISSUED') {
            setEmailBody(prev => prev + variable);
            setKakaoContent(prev => prev + variable);
        } else {
            setEmailBody(prev => prev + variable);
        }
    };

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
        const domain = `https://${societyId}.eregi.co.kr`;
        let url = '';

        switch (preset) {
            case 'custom': url = ''; break;
            case 'qr': url = `#{digitalBadgeQrUrl}`; break;
            case 'badge': url = `#{digitalBadgeQrUrl}`; break;
            case 'landing': url = domain; break;
            case 'badge-prep': url = `#{badgePrepUrl}`; break;
            case 'digital-badge': url = `#{digitalBadgeQrUrl}`; break;
        }

        const updated = [...kakaoButtons];
        updated[index] = { ...updated[index], linkMobile: url, linkPc: url };
        setKakaoButtons(updated);
    };

    const removeKakaoButton = (index: number) => {
        setKakaoButtons(kakaoButtons.filter((_, i) => i !== index));
    };

    return {
        isDialogOpen,
        setIsDialogOpen,
        editingTemplate,
        templateName, setTemplateName,
        templateDescription, setTemplateDescription,
        isActive, setIsActive,
        emailSubject, setEmailSubject,
        emailBody, setEmailBody,
        isHtmlEmail, setIsHtmlEmail,
        kakaoContent, setKakaoContent,
        kakaoButtons, setKakaoButtons,
        kakaoTemplateCode, setKakaoTemplateCode,
        kakaoStatus, setKakaoStatus,
        handleCreate,
        handleEdit,
        handleSave,
        insertVariable,
        handleAddKakaoButton,
        updateKakaoButton,
        handleSmartLinkPreset,
        removeKakaoButton
    };
}
