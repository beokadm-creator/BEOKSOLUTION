import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RefreshCw } from 'lucide-react';
import { useTemplates } from '@/hooks/useTemplates';
import TemplateCardList from '@/components/admin/templates/TemplateCardList';
import TemplateEditDialog from '@/components/admin/templates/TemplateEditDialog';
import NhnImportDialog from '@/components/admin/templates/NhnImportDialog';
import type { NotificationEventType } from '@/types/schema';

export default function TemplatesPage() {
    const {
        targetSocietyId,
        eventPresets,
        selectedEventType,
        setSelectedEventType,
        loading,
        isDialogOpen,
        setIsDialogOpen,
        isNhnImportOpen,
        setIsNhnImportOpen,
        currentTemplates,
        currentVariables,
        editingTemplate,
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
        nhnTemplates,
        loadingNhn,
        fetchTemplates,
        handleCreate,
        handleEdit,
        handleSave,
        handleDelete,
        handleToggleActive,
        insertVariable,
        handleFetchNhnTemplates,
        handleSelectNhnTemplate,
        handleAddKakaoButton,
        updateKakaoButton,
        handleSmartLinkPreset,
        removeKakaoButton,
    } = useTemplates();

    if (!targetSocietyId) return <div className="p-10 text-center">Society ID not found. Please access via society domain.</div>;

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
                        <TemplateCardList
                            eventType={eventType}
                            templates={currentTemplates}
                            eventPresets={eventPresets}
                            loading={loading}
                            onInsertVariable={insertVariable}
                            onCreate={handleCreate}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onToggleActive={handleToggleActive}
                        />
                    </TabsContent>
                ))}
            </Tabs>

            {/* Template Edit Dialog */}
            <TemplateEditDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                editingTemplate={editingTemplate}
                selectedEventType={selectedEventType}
                eventPresets={eventPresets}
                currentVariables={currentVariables}
                templateName={templateName}
                setTemplateName={setTemplateName}
                templateDescription={templateDescription}
                setTemplateDescription={setTemplateDescription}
                isActive={isActive}
                setIsActive={setIsActive}
                emailSubject={emailSubject}
                setEmailSubject={setEmailSubject}
                emailBody={emailBody}
                setEmailBody={setEmailBody}
                isHtmlEmail={isHtmlEmail}
                setIsHtmlEmail={setIsHtmlEmail}
                kakaoContent={kakaoContent}
                setKakaoContent={setKakaoContent}
                kakaoButtons={kakaoButtons}
                kakaoTemplateCode={kakaoTemplateCode}
                setKakaoTemplateCode={setKakaoTemplateCode}
                kakaoStatus={kakaoStatus}
                setKakaoStatus={setKakaoStatus}
                onSave={handleSave}
                onInsertVariable={insertVariable}
                onAddKakaoButton={handleAddKakaoButton}
                onUpdateKakaoButton={updateKakaoButton}
                onSmartLinkPreset={handleSmartLinkPreset}
                onRemoveKakaoButton={removeKakaoButton}
                onFetchNhnTemplates={handleFetchNhnTemplates}
                loadingNhn={loadingNhn}
            />

            {/* NHN Cloud Template Import Dialog */}
            <NhnImportDialog
                isOpen={isNhnImportOpen}
                onOpenChange={setIsNhnImportOpen}
                nhnTemplates={nhnTemplates}
                onSelectTemplate={handleSelectNhnTemplate}
            />
        </div>
    );
}
