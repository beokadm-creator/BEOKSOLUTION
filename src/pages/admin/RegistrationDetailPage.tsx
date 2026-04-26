import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Printer, XCircle, CheckCircle, CreditCard } from 'lucide-react';
import { useRegistrationDetail } from '../../hooks/useRegistrationDetail';
import { RegistrationInfoCard } from '../../components/admin/registration/RegistrationInfoCard';
import { VoucherLinkSection } from '../../components/admin/registration/VoucherLinkSection';

const RegistrationDetailPage: React.FC = () => {
    const { cid, regId } = useParams<{ cid: string; regId: string }>();
    const navigate = useNavigate();

    const {
        data, loading, effectiveCid, fieldSettings,
        isEditing, setIsEditing, editData, setEditData, isSaving, handleSaveEdit, cancelEdit,
        canceling, handlePaymentCancel, handleRefundRequest,
        isResending, handleResendNotification, handleManualApprove,
        canCancel, canRequestRefund, canManualApprove,
    } = useRegistrationDetail(cid || null, regId || null);

    if (loading) return <div className="p-8">Loading...</div>;
    if (!data) return <div className="p-8">데이터가 없습니다.</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto bg-white min-h-screen">
            <div className="flex items-center mb-6">
                <Button variant="ghost" onClick={() => navigate(-1)} className="mr-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <h1 className="text-2xl font-bold">등록 상세 (Registration Detail)</h1>
                <Button variant="outline" className="ml-auto" onClick={() => window.print()}>
                    <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
            </div>

            <RegistrationInfoCard
                data={data}
                fieldSettings={fieldSettings}
                isEditing={isEditing}
                editData={editData}
                setEditData={setEditData}
                isSaving={isSaving}
                onSave={handleSaveEdit}
                onCancelEdit={cancelEdit}
                onEdit={() => setIsEditing(true)}
            />

            {(canCancel || canRequestRefund) && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                        <CreditCard className="w-4 h-4" /> 결제 관리
                    </h3>
                    <div className="flex gap-3">
                        {canCancel && (
                            <Button
                                variant="destructive"
                                onClick={handlePaymentCancel}
                                disabled={canceling}
                                className="flex items-center gap-2"
                            >
                                <XCircle className="w-4 h-4" />
                                {canceling ? '처리중...' : '결제 취소 (PG 환불)'}
                            </Button>
                        )}
                        {canRequestRefund && (
                            <Button
                                variant="outline"
                                onClick={handleRefundRequest}
                                className="flex items-center gap-2 border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                            >
                                <CheckCircle className="w-4 h-4" />
                                환불 요청 처리
                            </Button>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        * 결제 취소는 PG사 직접 환불 처리됩니다.
                    </p>
                </div>
            )}

            {canManualApprove && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-bold mb-3 flex items-center gap-2 text-blue-800">
                        <CheckCircle className="w-4 h-4" /> 수동 관리 (Manual Action)
                    </h3>
                    <div className="flex gap-3 items-center">
                        <Button
                            variant="default"
                            onClick={handleManualApprove}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                        >
                            <CheckCircle className="w-4 h-4" />
                            {data.status === 'PAID' ? '결제 상태 강제 정정 (Fix Payment Status)' : '수동 결제 완료 처리 (Force Approve)'}
                        </Button>
                        <p className="text-sm text-blue-600 ml-2">
                            * 실제 결제가 되었으나 시스템 오류로 대기 상태인 경우 사용하세요.
                        </p>
                    </div>
                </div>
            )}

            <VoucherLinkSection
                registrationId={regId!}
                confId={effectiveCid}
                confBaseUrl={window.location.origin}
                confSlug={
                    (effectiveCid || '').includes('_')
                        ? (effectiveCid || '').split('_').slice(1).join('_')
                        : (effectiveCid || '')
                }
                onResend={handleResendNotification}
                isProcessing={isResending}
            />
        </div>
    );
};

export default RegistrationDetailPage;
