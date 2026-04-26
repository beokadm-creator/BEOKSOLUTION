import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConference } from '@/hooks/useConference';
import { useExternalAttendees } from '@/hooks/useExternalAttendees';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { ExternalAttendeeForm } from '@/components/admin/external/ExternalAttendeeForm';
import { ExternalAttendeeBulkUpload } from '@/components/admin/external/ExternalAttendeeBulkUpload';
import { ExternalAttendeeList } from '@/components/admin/external/ExternalAttendeeList';
import { ExternalAttendeeVoucherModal } from '@/components/admin/external/ExternalAttendeeVoucherModal';

const ExternalAttendeePage: React.FC = () => {
    const navigate = useNavigate();
    const { cid } = useParams<{ cid: string }>();
    const { id: confId, info, slug, societyId } = useConference(cid);

    const hook = useExternalAttendees(confId, slug, societyId);

    const handleOpenVoucherModal = (attendee: import('@/types/schema').ExternalAttendee) => {
        hook.setSelectedAttendee(attendee);
        hook.setShowVoucherModal(true);
    };

    if (hook.loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto py-8 px-4">
                <div className="mb-8">
                    <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
                        ← 뒤로가기
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-900">외부 참석자 관리</h1>
                    <p className="text-gray-600 mt-2">
                        {info?.title?.ko || '학술대회'}의 외부 참석자를 수동으로 등록하고 관리합니다.
                    </p>
                </div>

                <Tabs defaultValue="individual" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="individual">개별등록</TabsTrigger>
                        <TabsTrigger value="bulk">대량등록</TabsTrigger>
                        <TabsTrigger value="list">등록현황 ({hook.externalAttendees.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="individual">
                        <ExternalAttendeeForm
                            formData={hook.formData}
                            setFormData={hook.setFormData}
                            noEmail={hook.noEmail}
                            handleNoEmailChange={hook.handleNoEmailChange}
                            showPassword={hook.showPassword}
                            setShowPassword={hook.setShowPassword}
                            fieldSettings={hook.fieldSettings}
                            isProcessing={hook.isProcessing}
                            handleIndividualRegister={hook.handleIndividualRegister}
                        />
                    </TabsContent>

                    <TabsContent value="bulk">
                        <ExternalAttendeeBulkUpload
                            bulkPreview={hook.bulkPreview}
                            setBulkPreview={hook.setBulkPreview}
                            isProcessing={hook.isProcessing}
                            progress={hook.progress}
                            handleFileUpload={hook.handleFileUpload}
                            handleBulkRegister={hook.handleBulkRegister}
                            downloadTemplate={hook.downloadTemplate}
                            exporting={hook.exporting}
                        />
                    </TabsContent>

                    <TabsContent value="list">
                        <ExternalAttendeeList
                            externalAttendees={hook.externalAttendees}
                            selectedIds={hook.selectedIds}
                            isProcessing={hook.isProcessing}
                            exporting={hook.exporting}
                            bixolonPrinting={hook.bixolonPrinting}
                            toggleSelection={hook.toggleSelection}
                            toggleSelectAll={hook.toggleSelectAll}
                            handleExport={hook.handleExport}
                            handleDelete={hook.handleDelete}
                            handleResendNotification={hook.handleResendNotification}
                            handleBulkResendNotification={hook.handleBulkResendNotification}
                            handleCreateAccount={hook.handleCreateAccount}
                            handleIssueBadge={hook.handleIssueBadge}
                            handleBixolonPrint={hook.handleBixolonPrint}
                            onOpenVoucherModal={handleOpenVoucherModal}
                        />
                    </TabsContent>
                </Tabs>
            </div>

            <ExternalAttendeeVoucherModal
                showVoucherModal={hook.showVoucherModal}
                setShowVoucherModal={hook.setShowVoucherModal}
                selectedAttendee={hook.selectedAttendee}
                receiptConfig={hook.receiptConfig}
                info={info}
                confBaseUrl={hook.confBaseUrl()}
                confSlug={hook.confSlug()}
                confId={confId}
                handleResendNotification={hook.handleResendNotification}
                isProcessing={hook.isProcessing}
            />
        </div>
    );
};

export default ExternalAttendeePage;
