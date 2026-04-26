import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { safeFormatDate } from '@/utils/dateUtils';
import { VoucherLinkSection } from './VoucherLinkSection';
import type { ExternalAttendee, ConferenceInfo } from '@/types/schema';

interface ExternalAttendeeVoucherModalProps {
    showVoucherModal: boolean;
    setShowVoucherModal: React.Dispatch<React.SetStateAction<boolean>>;
    selectedAttendee: ExternalAttendee | null;
    receiptConfig: { issuerName: string; stampUrl: string; nextSerialNo: number } | null;
    info: ConferenceInfo | null;
    confBaseUrl: string;
    confSlug: string;
    confId: string | undefined;
    handleResendNotification: (attendee: ExternalAttendee) => Promise<void>;
    isProcessing: boolean;
}

export const ExternalAttendeeVoucherModal: React.FC<ExternalAttendeeVoucherModalProps> = ({
    showVoucherModal, setShowVoucherModal, selectedAttendee, receiptConfig, info,
    confBaseUrl, confSlug, confId, handleResendNotification, isProcessing
}) => {
    return (
        <Dialog open={showVoucherModal} onOpenChange={setShowVoucherModal}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>바우처 / 등록 확인서</DialogTitle>
                </DialogHeader>
                {selectedAttendee && (
                    <div className="mt-4 space-y-4">
                        <div className="p-5 bg-white border rounded-lg">
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">등록 정보</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-gray-500">성명</span>
                                    <p className="font-bold text-gray-900">{selectedAttendee.name}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">소속</span>
                                    <p className="font-bold text-gray-900">{selectedAttendee.organization}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">이메일</span>
                                    <p className="font-medium">{selectedAttendee.email}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">전화번호</span>
                                    <p className="font-medium">{selectedAttendee.phone}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">등록비</span>
                                    <p className="font-bold text-blue-700">₩{selectedAttendee.amount.toLocaleString()}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">영수증 번호</span>
                                    <p className="font-mono font-medium">{selectedAttendee.receiptNumber}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">등록일</span>
                                    <p className="font-medium">{safeFormatDate(selectedAttendee.createdAt)}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">발행처</span>
                                    <p className="font-medium">{receiptConfig?.issuerName || info?.title?.ko || 'eRegi'}</p>
                                </div>
                            </div>
                        </div>

                        <VoucherLinkSection
                            attendee={selectedAttendee}
                            confId={confId}
                            confBaseUrl={confBaseUrl}
                            confSlug={confSlug}
                            onResend={() => handleResendNotification(selectedAttendee)}
                            isProcessing={isProcessing}
                        />

                        {selectedAttendee.password && (
                            <div className="p-4 bg-blue-50 rounded border border-blue-200">
                                <p className="text-sm text-gray-600 mb-2">마이페이지 로그인 비밀번호</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-mono font-bold text-blue-800">
                                        {selectedAttendee.password}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            navigator.clipboard.writeText(selectedAttendee.password!);
                                            toast.success('비밀번호가 복사되었습니다.');
                                        }}
                                    >
                                        <Copy className="w-4 h-4 mr-1" />
                                        복사
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">이 비밀번호로 마이페이지에 로그인할 수 있습니다.</p>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
