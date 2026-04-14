import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ConferenceInfo } from '@/types/schema';
import { RegistrationSettings } from '../types';

interface RefundPolicyModalProps {
    language: 'ko' | 'en';
    showRefundModal: boolean;
    setShowRefundModal: (show: boolean) => void;
    regSettings: RegistrationSettings | null;
    info: ConferenceInfo | null | undefined;
}

export function RefundPolicyModal({
    language,
    showRefundModal,
    setShowRefundModal,
    regSettings,
    info
}: RefundPolicyModalProps) {
    return (
        <>
            <button
                type="button"
                onClick={() => setShowRefundModal(true)}
                className="fixed bottom-4 right-4 z-40 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold transition-colors"
            >
                {language === 'ko' ? '환불 규정' : 'Refund Policy'}
            </button>

            <Dialog open={showRefundModal} onOpenChange={setShowRefundModal}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{language === 'ko' ? '환불 규정' : 'Refund Policy'}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">
                        {regSettings?.refundPolicy || info?.refundPolicy || "등록 이후 환불 규정은 학회 운영 방침을 따릅니다. 자세한 사항은 사무국으로 문의해주세요."}
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
