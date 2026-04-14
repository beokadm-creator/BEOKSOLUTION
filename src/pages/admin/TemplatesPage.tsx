import React, { useState, useEffect } from 'react';
import { useAdminStore } from '@/store/adminStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, MessageCircle } from 'lucide-react';
import { NotificationEventType, EVENT_TYPE_PRESETS } from '@/types/schema';

import {
    useTemplatesList,
    useTemplateForm,
    useNhnAlimtalk,
    TemplateTabs,
    VariableHelper,
    TemplateGrid,
    TemplateEditorModal,
    NhnImportModal
} from '@/features/admin-templates';

export default function TemplatesPage() {
    const { selectedSocietyId } = useAdminStore();

    // Get Society ID
    const getSocietyId = () => {
        if (selectedSocietyId) return selectedSocietyId;
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') return parts[0];
        return null;
    };

    const targetSocietyId = getSocietyId();

    const [selectedEventType, setSelectedEventType] = useState<NotificationEventType>('MEMBER_REGISTER');

    const {
        templates,
        loading,
        fetchTemplates,
        handleDelete,
        handleToggleActive
    } = useTemplatesList(targetSocietyId);

    const {
        isDialogOpen, setIsDialogOpen,
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
    } = useTemplateForm(targetSocietyId, fetchTemplates);

    const {
        isNhnImportOpen, setIsNhnImportOpen,
        nhnTemplates,
        loadingNhn,
        handleFetchNhnTemplates
    } = useNhnAlimtalk(targetSocietyId);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const handleSelectNhnTemplate = (tpl: any) => {
        setKakaoContent(tpl.templateContent || '');
        setKakaoTemplateCode(tpl.templateCode || '');

        if (tpl.buttons && Array.isArray(tpl.buttons)) {
            const mappedButtons = tpl.buttons.map((b: any) => ({
                name: b.name,
                type: b.linkType || 'WL',
                linkMobile: b.linkMo || '',
                linkPc: b.linkPc || ''
            }));
            setKakaoButtons(mappedButtons);
        } else {
            setKakaoButtons([]);
        }

        setKakaoStatus('APPROVED');
    };

    if (!targetSocietyId) return <div className="p-10 text-center">Society ID not found. Please access via society domain.</div>;

    const currentTemplates = templates[selectedEventType] || [];

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

            <TemplateTabs selectedEventType={selectedEventType} setSelectedEventType={setSelectedEventType}>
                {(eventType) => (
                    <>
                        <VariableHelper
                            eventType={eventType}
                            onInsert={(key) => insertVariable(key, eventType)}
                        />

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
                                    <p className="text-slate-500 max-w-sm mt-1 mb-6">다음 이벤트를 위한 첫 번째 템플릿을 생성하세요: {EVENT_TYPE_PRESETS[eventType].label.ko}.</p>
                                    <Button onClick={handleCreate} variant="outline" className="bg-white">
                                        새 템플릿 추가
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <TemplateGrid
                                templates={currentTemplates}
                                onEdit={handleEdit}
                                onToggleActive={handleToggleActive}
                                onDelete={handleDelete}
                            />
                        )}
                    </>
                )}
            </TemplateTabs>

            <TemplateEditorModal
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                editingTemplate={editingTemplate}
                selectedEventType={selectedEventType}
                onSave={handleSave}
                templateName={templateName} setTemplateName={setTemplateName}
                templateDescription={templateDescription} setTemplateDescription={setTemplateDescription}
                isActive={isActive} setIsActive={setIsActive}
                emailSubject={emailSubject} setEmailSubject={setEmailSubject}
                emailBody={emailBody} setEmailBody={setEmailBody}
                isHtmlEmail={isHtmlEmail} setIsHtmlEmail={setIsHtmlEmail}
                kakaoContent={kakaoContent} setKakaoContent={setKakaoContent}
                kakaoButtons={kakaoButtons}
                kakaoTemplateCode={kakaoTemplateCode} setKakaoTemplateCode={setKakaoTemplateCode}
                kakaoStatus={kakaoStatus} setKakaoStatus={setKakaoStatus}
                loadingNhn={loadingNhn}
                onFetchNhnTemplates={handleFetchNhnTemplates}
                insertVariable={insertVariable}
                onAddKakaoButton={handleAddKakaoButton}
                onUpdateKakaoButton={updateKakaoButton}
                onSmartLinkPreset={handleSmartLinkPreset}
                onRemoveKakaoButton={removeKakaoButton}
            />

            <NhnImportModal
                isOpen={isNhnImportOpen}
                onOpenChange={setIsNhnImportOpen}
                nhnTemplates={nhnTemplates}
                onSelectTemplate={handleSelectNhnTemplate}
            />
        </div>
    );
}
