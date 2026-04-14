import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, FileText, QrCode, Printer, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserReg } from '../types';
import { isVisibleActiveReg, getSafeConferenceSlug } from '../utils';

interface EventsTabProps {
    loading: boolean;
    regs: UserReg[];
    handleEventClick: (r: UserReg) => void;
    handleQrClick: (e: React.MouseEvent, r: UserReg) => void;
    handleReceiptClick: (e: React.MouseEvent, r: UserReg) => void;
    setSelectedVirtualAccountReg: (r: UserReg | null) => void;
    setShowVirtualAccountModal: (v: boolean) => void;
}

export const EventsTab: React.FC<EventsTabProps> = ({
    loading,
    regs,
    handleEventClick,
    handleQrClick,
    handleReceiptClick,
    setSelectedVirtualAccountReg,
    setShowVirtualAccountModal,
}) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const visibleRegs = regs.filter(isVisibleActiveReg);

    return (
        <div className="space-y-4">
            {loading && (
                <>
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-white p-5 rounded-xl shadow-sm border flex flex-col gap-3">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-6 w-3/4" />
                            <div className="flex gap-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                        </div>
                    ))}
                </>
            )}
            {!loading && visibleRegs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-xl border-2 border-dashed border-gray-200 text-center">
                    <div className="w-20 h-20 bg-blue-50 text-blue-200 rounded-full flex items-center justify-center mb-6">
                        <Calendar className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">등록된 학회가 없습니다</h3>
                    <p className="text-gray-500 max-w-sm mb-8">
                        현재 참여 중인 학술대회 내역이 없습니다.<br />
                        진행 중인 학술대회를 찾아 등록해보세요.
                    </p>
                    <Button
                        onClick={() => window.location.href = '/'}
                        className="px-8 py-6 text-base font-bold bg-[#003366] hover:bg-[#002244] text-white shadow-lg shadow-blue-900/10"
                    >
                        지금 학회 등록하기
                    </Button>
                </div>
            )}
            {visibleRegs.map(r => (
                <div key={r.id} onClick={() => handleEventClick(r)} className="eregi-card cursor-pointer flex flex-col group animate-in fade-in slide-in-from-bottom-2 duration-500 border border-slate-200 bg-white/95 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <div className="flex flex-col mb-4">
                        <div className="flex items-center text-sm text-[#24669e] font-bold mb-2">
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 border border-blue-100">[{r.societyName}]</span>
                        </div>
                        <h3 className="font-heading-3 text-slate-900 mb-2 group-hover:text-[#1b4d77] transition-colors">{r.conferenceName}</h3>
                        <div className="text-body-sm text-slate-500 flex flex-col gap-1">
                            <span>📅 {r.dates}</span>
                            <span>📍 {r.location}</span>
                        </div>
                    </div>
                    <div className="mt-auto border-t border-slate-100 pt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <span className={r.earnedPoints ? "bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold" :
                            (r.status === 'PENDING_PAYMENT' || r.paymentStatus === 'WAITING_FOR_DEPOSIT') ? "bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-100" :
                                "bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs"}>
                            {r.earnedPoints ? `+${r.earnedPoints} pts` :
                                (r.status === 'PENDING_PAYMENT' || r.paymentStatus === 'WAITING_FOR_DEPOSIT') ? '입금 대기 (가상계좌)' :
                                    `[STATUS] ${r.paymentStatus || r.status}`}
                        </span>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const currentLang = searchParams.get('lang') || 'ko';
                                    const safeSlug = getSafeConferenceSlug(r.slug);
                                    if (!safeSlug) {
                                        toast.error('학술대회 정보가 없어 초록 페이지로 이동할 수 없습니다.');
                                        return;
                                    }
                                    navigate(`/${safeSlug}/abstracts?lang=${currentLang}`);
                                }}
                                className="w-full sm:w-auto justify-center bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 shadow-sm border border-slate-200"
                            >
                                <FileText size={14} /> 초록 접수/확인
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => handleQrClick(e, r)}
                                className="w-full sm:w-auto justify-center bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 shadow-sm border border-slate-200"
                            >
                                <QrCode size={14} /> 등록 확인증 (QR)
                            </Button>
                            {r.paymentStatus === 'PAID' && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => handleReceiptClick(e, r)}
                                    className="w-full sm:w-auto justify-center bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 shadow-sm border border-slate-200"
                                >
                                    <Printer size={14} /> 영수증
                                </Button>
                            )}
                            {(r.status === 'PENDING_PAYMENT' || r.paymentStatus === 'WAITING_FOR_DEPOSIT') && r.virtualAccount && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedVirtualAccountReg(r);
                                        setShowVirtualAccountModal(true);
                                    }}
                                    className="w-full sm:w-auto justify-center bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs gap-1.5 shadow-sm border border-orange-200"
                                >
                                    <CreditCard size={14} /> 계좌 확인
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
            {/* The guestbookEntries logic is currently disabled in the original with `&& false`
            {!loading && false && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">방명록 기록</h3>
                        <span className="text-xs font-semibold text-gray-500">{guestbookEntries.length}건</span>
                    </div>
                    {guestbookEntries.length === 0 ? (
                        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-4">
                            아직 남긴 방명록이 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {guestbookEntries.map(entry => (
                                <div key={entry.id} className="flex flex-col gap-1 border border-gray-100 rounded-lg p-4">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                        <span className="font-semibold text-gray-700">{entry.conferenceName}</span>
                                        <span className="text-gray-300">•</span>
                                        <span>{entry.vendorName}</span>
                                        {entry.timestamp?.toDate && (
                                            <>
                                                <span className="text-gray-300">•</span>
                                                <span>{entry.timestamp.toDate().toLocaleString()}</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                        {entry.message || '메시지 없음'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            */}
        </div>
    );
};
