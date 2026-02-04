import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, getDocs, addDoc, doc, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAdminStore } from '../../store/adminStore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Plus, Trash2, RefreshCw, Mail, MessageCircle, Info, Save, ToggleLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { NotificationEventType, NotificationChannelType, TemplateVariable, AlimTalkButton, EmailConfig, KakaoConfig, NotificationTemplate, EVENT_TYPE_PRESETS } from '../../types/schema';

// Legacy Template (for backward compatibility)
interface LegacyTemplate {
    id: string;
    code: string;
    name: string;
    content: string;
    buttons: AlimTalkButton[];
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: Timestamp;
}

export default function TemplatesPage() {
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

    // Get Society ID
    const getSocietyId = () => {
        if (selectedSocietyId) return selectedSocietyId;
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') return parts[0];
        if (hostname === 'localhost' || hostname === '127.0.0.1') return 'kap';
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
            case 'qr': url = `${domain}/my-qr/`; break;
            case 'badge': url = `${domain}/my-badge/`; break;
            case 'landing': url = domain; break;
            case 'badge-prep': url = `${domain}/badge-prep/`; break;      // 배지 수령 전 QR 페이지
            case 'digital-badge': url = `${domain}/my-badge/`; break;  // 디지털 명찰 QR URL
        }

        const updated = [...kakaoButtons];
        updated[index] = { ...updated[index], linkMobile: url, linkPc: url };
        setKakaoButtons(updated);
    };

    const removeKakaoButton = (index: number) => {
        setKakaoButtons(kakaoButtons.filter((_, i) => i !== index));
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

    if (!targetSocietyId) return <div className="p-10 text-center">Society ID not found. Please access via society domain.</div>;

    const eventPresets = EVENT_TYPE_PRESETS;
    const currentTemplates = templates[selectedEventType] || [];
    const currentVariables = eventPresets[selectedEventType]?.variables || [];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 pb-24">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50">Admin Console</Badge>
                        <span className="text-slate-300">|</span>
                        <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">Notification Center</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">알림 템플릿 관리</h1>
                    <p className="text-slate-500 mt-2 font-medium">이벤트별 알림톡 및 이메일 템플릿을 관리합니다.</p>
                </div>
                <Button onClick={fetchTemplates} variant="outline" disabled={loading} className="border-dashed hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50">
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    새로고침
                </Button>
            </div>

            {/* Event Type Tabs */}
            <Tabs value={selectedEventType} onValueChange={(v) => setSelectedEventType(v as NotificationEventType)} className="space-y-8">
                <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 w-full h-auto p-1.5 bg-slate-100/80 rounded-xl gap-1">
                    {(Object.keys(eventPresets) as NotificationEventType[]).map(eventType => (
                        <TabsTrigger
                            key={eventType}
                            value={eventType}
                            className="text-xs md:text-sm py-2.5 rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all"
                        >
                            {eventPresets[eventType].label.ko}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {(Object.keys(eventPresets) as NotificationEventType[]).map(eventType => (
                    <TabsContent key={eventType} value={eventType} className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        {/* Event Context Card */}
                        <Card className="border-none shadow-lg shadow-blue-100/50 bg-white rounded-2xl overflow-hidden">
                            <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                        <Info className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-bold text-slate-800">
                                            {eventPresets[eventType].label.ko} 가용 변수
                                        </CardTitle>
                                        <CardDescription className="text-blue-600/80 font-medium">
                                            템플릿 작성 시 사용할 수 있는 동적 데이터 변수 목록입니다.
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 bg-slate-50/30">
                                <div className="flex flex-wrap gap-2">
                                    {eventPresets[eventType].variables.map(variable => (
                                        <button
                                            key={variable.key}
                                            onClick={() => insertVariable(variable.key)}
                                            className="group flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 hover:shadow-sm transition-all shadow-sm"
                                            title="Click to copy/insert"
                                        >
                                            <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">#{`{${variable.key}}`}</span>
                                            <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600">{variable.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Actions Bar */}
                        <div className="flex justify-between items-center pt-2">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-slate-900">템플릿 목록</h2>
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600">{currentTemplates.length}</Badge>
                            </div>
                            <Button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 rounded-xl">
                                <Plus className="w-4 h-4 mr-2" />
                                새 템플릿 생성
                            </Button>
                        </div>

                        {/* Template Grid */}
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4" />
                                <p className="text-slate-500">Loading templates...</p>
                            </div>
                        ) : currentTemplates.length === 0 ? (
                            <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                                        <MessageCircle className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-700">문자/알림톡 템플릿 없음</h3>
                                    <p className="text-slate-500 max-w-sm mt-1 mb-6">다음 이벤트를 위한 첫 번째 템플릿을 생성하세요: {eventPresets[eventType].label.ko}.</p>
                                    <Button onClick={handleCreate} variant="outline" className="bg-white">
                                        새 템플릿 추가
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {currentTemplates.map(template => (
                                    <Card key={template.id} className={`border-none shadow-lg shadow-slate-200/50 bg-white rounded-2xl overflow-hidden transition-all hover:shadow-xl ${!template.isActive ? 'opacity-80 grayscale-[0.3]' : ''}`}>
                                        <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="font-bold text-lg text-slate-800">{template.name}</h3>
                                                        <Badge variant={template.isActive ? 'default' : 'secondary'} className={template.isActive ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                                                            {template.isActive ? '활성' : '비활성'}
                                                        </Badge>
                                                    </div>
                                                    {template.description && (
                                                        <p className="text-sm text-slate-500 font-medium">{template.description}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleToggleActive(template)}
                                                        className={template.isActive ? "text-slate-500 hover:text-slate-700" : "text-emerald-600 hover:text-emerald-700 bg-emerald-50"}
                                                        title="Toggle Status"
                                                    >
                                                        <ToggleLeft className="w-4 h-4 mr-2" />
                                                        {template.isActive ? '비활성화' : '활성화'}
                                                    </Button>
                                                    <div className="h-4 w-px bg-slate-200 mx-1" />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEdit(template)}
                                                        className="hover:bg-indigo-50 hover:text-indigo-600 border-slate-200"
                                                    >
                                                        <Save className="w-3.5 h-3.5 mr-2" />
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(template.id)}
                                                        className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                                                {/* Email Preview */}
                                                <div className="p-6 space-y-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-full w-fit">
                                                            <Mail className="w-3.5 h-3.5" />
                                                            이메일 채널
                                                        </div>
                                                        {!template.channels.email && <span className="text-xs text-slate-400 font-medium">설정되지 않음</span>}
                                                    </div>

                                                    {template.channels.email ? (
                                                        <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                                                            <div className="space-y-1">
                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">제목</span>
                                                                <p className="font-semibold text-slate-800 text-sm">{template.channels.email.subject}</p>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">본문 미리보기</span>
                                                                <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed bg-white p-3 rounded-lg border border-slate-100 shadow-sm font-mono text-xs">
                                                                    {template.channels.email.body}
                                                                </p>
                                                            </div>
                                                            {template.channels.email.isHtml && (
                                                                <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200 bg-white">HTML 사용</Badge>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="h-32 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                                            <Mail className="w-8 h-8 mb-2 opacity-20" />
                                                            <p className="text-xs font-medium">이메일 설정 없음</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Kakao Preview */}
                                                <div className="p-6 space-y-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2 text-amber-700 font-bold text-sm bg-amber-50 px-3 py-1 rounded-full w-fit">
                                                            <MessageCircle className="w-3.5 h-3.5" />
                                                            알림톡 (카카오)
                                                        </div>
                                                        {!template.channels.kakao && <span className="text-xs text-slate-400 font-medium">설정되지 않음</span>}
                                                    </div>

                                                    {template.channels.kakao ? (
                                                        <div className="space-y-3 bg-amber-50/30 rounded-xl p-4 border border-amber-100/50">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">상태</span>
                                                                <Badge variant={
                                                                    template.channels.kakao.status === 'APPROVED' ? 'default' :
                                                                        template.channels.kakao.status === 'REJECTED' ? 'destructive' : 'secondary'
                                                                } className={`
                                                                    ${template.channels.kakao.status === 'APPROVED' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                                                                    ${template.channels.kakao.status === 'PENDING' ? 'bg-slate-500' : ''}
                                                                `}>
                                                                    {template.channels.kakao.status === 'PENDING' ? '심사 대기중' :
                                                                        template.channels.kakao.status === 'APPROVED' ? '승인됨' : '반려됨'}
                                                                </Badge>
                                                            </div>

                                                            <div className="space-y-1">
                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">내용 미리보기</span>
                                                                <div className="bg-[#FAE100]/10 p-4 rounded-lg border border-[#FAE100]/30">
                                                                    <p className="text-sm text-slate-800 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                                                                        {template.channels.kakao.content}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {template.channels.kakao.buttons.length > 0 && (
                                                                <div className="space-y-2 pt-1">
                                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">버튼</span>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {template.channels.kakao.buttons.map((btn, idx) => (
                                                                            <Badge key={idx} variant="outline" className="bg-white text-slate-600 border-slate-200 py-1 px-2">
                                                                                {btn.name}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {template.channels.kakao.kakaoTemplateCode && (
                                                                <div className="pt-2 border-t border-amber-100/50 flex justify-between items-center">
                                                                    <span className="text-[10px] text-slate-400 font-medium uppercase">템플릿 코드</span>
                                                                    <code className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-600">
                                                                        {template.channels.kakao.kakaoTemplateCode}
                                                                    </code>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="h-32 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                                            <MessageCircle className="w-8 h-8 mb-2 opacity-20" />
                                                            <p className="text-xs font-medium">알림톡 설정 없음</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                ))}
            </Tabs>

            {/* Template Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white rounded-2xl overflow-hidden block">
                    <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                {editingTemplate ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            </div>
                            <DialogTitle className="text-xl font-bold text-slate-900">
                                {editingTemplate ? '템플릿 편집' : '새 템플릿 추가'}
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-500 ml-11">
                            Configuring for <span className="font-bold text-indigo-600">{eventPresets[selectedEventType].label.ko}</span> event.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-8">
                        {/* Basic Info Section */}
                        <section className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <span className="w-1 h-4 bg-indigo-500 rounded-full" /> 기본 정보
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-100">
                                <div className="md:col-span-8 space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">템플릿 이름 <span className="text-red-500">*</span></Label>
                                    <Input
                                        placeholder="예: 등록 완료 안내"
                                        value={templateName}
                                        onChange={e => setTemplateName(e.target.value)}
                                        className="bg-white"
                                    />
                                </div>
                                <div className="md:col-span-4 space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">상태</Label>
                                    <Select value={isActive ? 'active' : 'inactive'} onValueChange={v => setIsActive(v === 'active')}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">활성 (사용)</SelectItem>
                                            <SelectItem value="inactive">비활성 (미사용)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-12 space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">관리용 설명</Label>
                                    <Input
                                        placeholder="관리자를 위한 템플릿 설명"
                                        value={templateDescription}
                                        onChange={e => setTemplateDescription(e.target.value)}
                                        className="bg-white"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Email Config Section */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-2">
                                    <div className="p-1 bg-emerald-100 rounded text-emerald-600"><Mail className="w-3.5 h-3.5" /></div>
                                    이메일 설정
                                </h4>
                                <Badge variant="outline" className="text-xs text-slate-400 font-normal">선택사항</Badge>
                            </div>

                            <div className="bg-emerald-50/30 border border-emerald-100 p-5 rounded-xl space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">이메일 제목</Label>
                                    <Input
                                        placeholder="예: 등록 완료 안내"
                                        value={emailSubject}
                                        onChange={e => setEmailSubject(e.target.value)}
                                        className="bg-white border-emerald-100 focus:border-emerald-300"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">이메일 본문</Label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="isHtmlEmail"
                                                checked={isHtmlEmail}
                                                onChange={e => setIsHtmlEmail(e.target.checked)}
                                                className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <Label htmlFor="isHtmlEmail" className="text-xs text-slate-500 cursor-pointer font-medium">HTML 형식 사용</Label>
                                        </div>
                                    </div>
                                    <Textarea
                                        placeholder="이메일 본문을 입력하세요..."
                                        value={emailBody}
                                        onChange={e => setEmailBody(e.target.value)}
                                        rows={8}
                                        className="font-mono text-sm bg-white border-emerald-100 focus:border-emerald-300 min-h-[160px]"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Kakao Config Section */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wide flex items-center gap-2">
                                    <div className="p-1 bg-amber-100 rounded text-amber-600"><MessageCircle className="w-3.5 h-3.5" /></div>
                                    알림톡 설정
                                </h4>
                                <Badge variant="outline" className="text-xs text-slate-400 font-normal">선택사항</Badge>
                            </div>

                            <div className="bg-amber-50/30 border border-amber-100 p-5 rounded-xl space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 order-2 md:order-1">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">알림톡 내용</Label>
                                        <Textarea
                                            placeholder="알림톡 내용을 입력하세요..."
                                            value={kakaoContent}
                                            onChange={e => setKakaoContent(e.target.value)}
                                            rows={8}
                                            className="font-sans text-sm bg-white border-amber-200 focus:border-amber-400 min-h-[180px]"
                                        />
                                        <p className="text-[10px] text-slate-400 text-right">디바이스에 따라 다르게 보일 수 있습니다.</p>
                                    </div>
                                    <div className="space-y-4 order-1 md:order-2">
                                        <div className="bg-white p-4 rounded-lg border border-amber-200/50 shadow-sm space-y-4">
                                            <h5 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2">카카오 설정</h5>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-slate-600">템플릿 코드</Label>
                                                <Input
                                                    placeholder="예: 100234"
                                                    value={kakaoTemplateCode}
                                                    onChange={e => setKakaoTemplateCode(e.target.value)}
                                                    className="bg-slate-50 h-9 text-sm font-mono"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-slate-600">심사 상태</Label>
                                                <Select value={kakaoStatus} onValueChange={v => setKakaoStatus(v as 'PENDING' | 'APPROVED' | 'REJECTED')}>
                                                    <SelectTrigger className={`h-9 text-xs font-bold ${kakaoStatus === 'APPROVED' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                                                        kakaoStatus === 'REJECTED' ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-500 bg-slate-50'
                                                        }`}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PENDING">대기중 (심사중)</SelectItem>
                                                        <SelectItem value="APPROVED">승인됨 (사용가능)</SelectItem>
                                                        <SelectItem value="REJECTED">반려됨 (수정필요)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Variable Helper for Dialog */}
                                        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Info className="w-3.5 h-3.5 text-blue-600" />
                                                <span className="text-xs font-bold text-blue-700">변수 간편 삽입</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {currentVariables.map(variable => (
                                                    <button
                                                        key={variable.key}
                                                        onClick={() => insertVariable(variable.key)}
                                                        className="px-2 py-1 bg-white border border-blue-200 rounded text-[11px] font-mono text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                                                        title={variable.label}
                                                    >
                                                        #{`{${variable.key}}`}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Buttons Config */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center border-b border-amber-200/50 pb-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">버튼 설정 ({kakaoButtons.length}/5)</Label>
                                        <Button variant="outline" size="sm" onClick={handleAddKakaoButton} disabled={kakaoButtons.length >= 5} className="h-7 text-xs bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300">
                                            <Plus className="w-3 h-3 mr-1" />
                                            버튼 추가
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {kakaoButtons.length === 0 ? (
                                            <div className="text-center py-6 bg-white rounded-lg border border-dashed border-amber-200 text-slate-400 text-xs italic">
                                                추가된 버튼이 없습니다. '버튼 추가'를 눌러 링크를 연결하세요.
                                            </div>
                                        ) : (
                                            kakaoButtons.map((btn, idx) => (
                                                <div key={idx} className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded">버튼 #{idx + 1}</span>
                                                        <button onClick={() => removeKakaoButton(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                                                        <div className="md:col-span-3 space-y-1">
                                                            <Label className="text-[10px] font-bold text-slate-500 uppercase">버튼명</Label>
                                                            <Input
                                                                placeholder="버튼 이름"
                                                                value={btn.name}
                                                                onChange={e => updateKakaoButton(idx, 'name', e.target.value)}
                                                                className="h-9 text-sm"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-9 space-y-1">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">버튼 링크 (URL)</Label>
                                                                <Select onValueChange={v => handleSmartLinkPreset(idx, v)}>
                                                                    <SelectTrigger className="h-6 text-[10px] w-auto border-none bg-transparent shadow-none p-0 text-indigo-600 hover:text-indigo-800 font-medium">
                                                                        <SelectValue placeholder="프리셋 적용 ▼" />
                                                                    </SelectTrigger>
                                                                    <SelectContent align="end">
                                                                        <SelectItem value="custom">직접 입력</SelectItem>
                                                                        <SelectItem value="landing">행사 홈페이지</SelectItem>
                                                                        <SelectItem value="qr">나의 QR 페이지</SelectItem>
                                                                        <SelectItem value="badge">디지털 명찰 (이수증)</SelectItem>
                                                                        <SelectItem value="badge-prep">배지 수령용 QR</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <Input
                                                                placeholder="https://..."
                                                                value={btn.linkMobile}
                                                                onChange={e => updateKakaoButton(idx, 'linkMobile', e.target.value)}
                                                                className="h-9 text-xs font-mono text-slate-600 bg-slate-50"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50 sticky bottom-0 z-10">
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="mr-2">
                            취소
                        </Button>
                        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]">
                            <Save className="w-4 h-4 mr-2" />
                            저장하기
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
