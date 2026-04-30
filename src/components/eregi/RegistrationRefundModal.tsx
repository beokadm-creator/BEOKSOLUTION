import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface RegistrationRefundModalProps {
    showRefundModal: boolean;
    setShowRefundModal: (value: boolean) => void;
    refundPolicy?: string;
    language: 'ko' | 'en';
}

export default function RegistrationRefundModal({
    showRefundModal,
    setShowRefundModal,
    refundPolicy,
    language,
}: RegistrationRefundModalProps) {
    return (
        <>
            {/* Refund Policy Modal - Floating Trigger Button */}
            <button
                type="button"
                onClick={() => setShowRefundModal(true)}
                className="fixed bottom-4 right-4 z-40 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold transition-colors"
            >
                {language === 'ko' ? '환불 규정' : 'Refund Policy'}
            </button>

            {/* Refund Policy Modal */}
            <Dialog open={showRefundModal} onOpenChange={setShowRefundModal}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{language === 'ko' ? '환불 규정' : 'Refund Policy'}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">
                        {refundPolicy || (language === 'ko'
                            ? '등록 이후 환불 규정은 학회 운영 방침을 따릅니다. 자세한 사항은 사무국으로 문의해주세요.'
                            : 'Refund policy follows the society policy after registration. Please contact the secretariat for details.')}

                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button onClick={() => setShowRefundModal(false)}>
                            {language === 'ko' ? '닫기' : 'Close'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
