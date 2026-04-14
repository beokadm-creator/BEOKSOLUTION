import React, { useRef } from 'react';
import { Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ReceiptTemplate from '@/components/print/ReceiptTemplate';
import PrintHandler from '@/components/print/PrintHandler';
import { safeFormatDate } from '@/utils/dateUtils';
import { UserReg } from '../types';
import { forceString } from '../utils';

interface ModalsProps {
    showCertModal: boolean;
    setShowCertModal: (v: boolean) => void;
    isSocLocked: boolean;
    verifyForm: { societyId: string; name: string; code: string; };
    setVerifyForm: React.Dispatch<React.SetStateAction<{ societyId: string; name: string; code: string; }>>;
    societies: Array<{ id: string; name: string | { ko?: string; en?: string };[key: string]: unknown }>;
    handleVerify: () => void;
    verifyLoading: boolean;

    showReceiptModal: boolean;
    setShowReceiptModal: (v: boolean) => void;
    selectedReceiptReg: UserReg | null;

    showVirtualAccountModal: boolean;
    setShowVirtualAccountModal: (v: boolean) => void;
    selectedVirtualAccountReg: UserReg | null;
}

export const Modals: React.FC<ModalsProps> = ({
    showCertModal,
    setShowCertModal,
    isSocLocked,
    verifyForm,
    setVerifyForm,
    societies,
    handleVerify,
    verifyLoading,

    showReceiptModal,
    setShowReceiptModal,
    selectedReceiptReg,

    showVirtualAccountModal,
    setShowVirtualAccountModal,
    selectedVirtualAccountReg
}) => {
    const receiptRef = useRef<HTMLDivElement>(null);

    return (
        <>
            {showCertModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full relative">
                        <h3 className="text-xl font-bold mb-2 text-gray-900">학회 정회원 인증</h3>
                        <p className="text-xs text-center text-blue-500 mb-6 font-bold bg-blue-50 p-1 rounded">{isSocLocked ? `[${verifyForm.societyId}] 학회 전용 모드` : '통합 모드 (학회 선택 가능)'}</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">학회 선택</label>
                                <select className={`w-full border p-3 rounded-lg ${isSocLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}`} value={verifyForm.societyId} onChange={(e) => setVerifyForm({ ...verifyForm, societyId: e.target.value })} disabled={isSocLocked}>
                                    <option value="">선택해주세요</option>
                                    {societies.map((s) => <option key={s.id} value={s.id}>{forceString(s.name) || s.id}</option>)}
                                </select>
                            </div>
                            <div><label className="block text-sm font-medium mb-1">이름</label><input type="text" className="w-full border p-3 rounded-lg" value={verifyForm.name} onChange={(e) => setVerifyForm({ ...verifyForm, name: e.target.value })} /></div>
                            <div><label className="block text-sm font-medium mb-1">인증 코드</label><input type="text" className="w-full border p-3 rounded-lg" value={verifyForm.code} onChange={(e) => setVerifyForm({ ...verifyForm, code: e.target.value })} /></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowCertModal(false)} className="px-5 py-3 text-gray-500 hover:bg-gray-100 rounded-lg font-bold">취소</button>
                            <button
                                onClick={handleVerify}
                                className="px-5 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center min-w-[100px]"
                                disabled={verifyLoading}
                            >
                                {verifyLoading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : '인증 받기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
                <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>영수증 미리보기 (Receipt Preview)</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-6 bg-gray-100 rounded-xl">
                        {selectedReceiptReg && selectedReceiptReg.receiptConfig && (
                            <div ref={receiptRef} className="shadow-2xl bg-white">
                                <ReceiptTemplate
                                    data={{
                                        registrationId: selectedReceiptReg.id,
                                        receiptNumber: selectedReceiptReg.receiptNumber || selectedReceiptReg.id,
                                        paymentDate: safeFormatDate(selectedReceiptReg.paymentDate || new Date()),
                                        payerName: selectedReceiptReg.userName || 'Unknown',
                                        totalAmount: selectedReceiptReg.amount || 0,
                                        items: [
                                            { name: `Conference Registration (${selectedReceiptReg.conferenceName})`, amount: selectedReceiptReg.amount || 0 }
                                        ]
                                    }}
                                    config={selectedReceiptReg.receiptConfig}
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button onClick={() => setShowReceiptModal(false)} variant="secondary">
                            닫기
                        </Button>
                        <PrintHandler
                            contentRef={receiptRef}
                            triggerButton={
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <Printer className="w-4 h-4 mr-2" />
                                    인쇄하기
                                </Button>
                            }
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showVirtualAccountModal} onOpenChange={setShowVirtualAccountModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>가상계좌 입금 정보</DialogTitle>
                    </DialogHeader>
                    {selectedVirtualAccountReg && selectedVirtualAccountReg.virtualAccount && (
                        <div className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm mt-2">
                            <h3 className="text-lg font-bold text-orange-800 mb-4 border-b border-orange-100 pb-2">
                                입금 계좌 안내
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">은행</span>
                                    <span className="font-bold">{selectedVirtualAccountReg.virtualAccount.bank}</span>
                                </div>
                                <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                    <span className="text-gray-500">계좌번호</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lg text-blue-600">{selectedVirtualAccountReg.virtualAccount.accountNumber}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">예금주</span>
                                    <span className="font-medium">{selectedVirtualAccountReg.virtualAccount.customerName || 'Toss Payments'}</span>
                                </div>
                                {selectedVirtualAccountReg.virtualAccount.dueDate && (
                                    <div className="flex justify-between text-red-500 pt-2 border-t border-dashed border-gray-200 mt-2">
                                        <span className="font-medium">입금기한</span>
                                        <span className="font-bold">
                                            {new Date(selectedVirtualAccountReg.virtualAccount.dueDate).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="mt-6 text-xs text-gray-400 text-center">
                                ※ 입금 기한 내에 입금하지 않으시면 자동 취소됩니다.
                            </div>
                        </div>
                    )}
                    <div className="flex justify-center mt-4">
                        <Button onClick={() => setShowVirtualAccountModal(false)} className="w-full bg-slate-900 text-white hover:bg-slate-800">
                            확인
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
