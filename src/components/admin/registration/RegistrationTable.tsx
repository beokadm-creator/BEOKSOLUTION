import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Square, MessageCircle } from 'lucide-react';
import { EregiButton } from '@/components/eregi/EregiForm';
import type { RootRegistration } from '@/hooks/useRegistrationList';
import { statusToKorean, displayTier } from '@/hooks/useRegistrationList';
import type { RegistrationFieldSettings } from '@/types/schema';

interface RegistrationTableProps {
    conferenceId: string;
    filteredData: RootRegistration[];
    fieldSettings: RegistrationFieldSettings;
    selectedIds: string[];
    isProcessing: boolean;
    bixolonPrinting: boolean;
    toggleSelection: (e: React.MouseEvent, id: string) => void;
    toggleSelectAll: () => void;
    handleIssueBadge: (e: React.MouseEvent, reg: RootRegistration) => void;
    handleBixolonPrint: (e: React.MouseEvent, reg: RootRegistration) => void;
    handleResendNotification: (e: React.MouseEvent, reg: RootRegistration) => void;
    handleDeleteRegistration: (e: React.MouseEvent, reg: RootRegistration) => void;
}

export const RegistrationTable: React.FC<RegistrationTableProps> = ({
    conferenceId,
    filteredData,
    fieldSettings,
    selectedIds,
    isProcessing,
    bixolonPrinting,
    toggleSelection,
    toggleSelectAll,
    handleIssueBadge,
    handleBixolonPrint,
    handleResendNotification,
    handleDeleteRegistration,
}) => {
    const navigate = useNavigate();

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
                <thead className="bg-[#f0f5fa] border-b border-[#e1ecf6]">
                    <tr>
                        <th className="p-4 w-10">
                            <button onClick={toggleSelectAll} className="p-1 hover:bg-blue-50 rounded">
                                {selectedIds.length === filteredData.length && filteredData.length > 0 ? (
                                    <CheckSquare size={18} className="text-blue-600" />
                                ) : (
                                    <Square size={18} className="text-gray-300" />
                                )}
                            </button>
                        </th>
                        <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">주문번호</th>
                        {fieldSettings.name.visible && <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">이름</th>}
                        {fieldSettings.email.visible && <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">이메일</th>}
                        {fieldSettings.phone.visible && <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">전화번호</th>}
                        {fieldSettings.affiliation.visible && <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">소속</th>}
                        {fieldSettings.position.visible && <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">직급</th>}
                        {fieldSettings.licenseNumber.visible && <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">면허번호</th>}
                        <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">등급</th>
                        <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">결제금액</th>
                        <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">결제수단</th>
                        <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">상태</th>
                        <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider text-center">명찰/알림</th>
                        <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider text-center">삭제</th>
                        <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">등록일</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredData.map(r => (
                        <tr
                            key={r.id}
                            className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedIds.includes(r.id) ? 'bg-blue-50/50' : ''}`}
                            onClick={() => navigate(`/admin/conf/${conferenceId}/registrations/${r.id}`)}
                        >
                            <td className="p-4" onClick={(e) => toggleSelection(e, r.id)}>
                                <div className="flex justify-center">
                                    {selectedIds.includes(r.id) ? (
                                        <CheckSquare size={18} className="text-blue-600" />
                                    ) : (
                                        <Square size={18} className="text-gray-300" />
                                    )}
                                </div>
                            </td>
                            <td className="p-4 font-mono text-xs text-gray-400">{r.orderId || r.id}</td>
                            {fieldSettings.name.visible && <td className="p-4 font-medium text-gray-900">{r.userName}</td>}
                            {fieldSettings.email.visible && <td className="p-4 text-sm text-gray-500">{r.userEmail || '-'}</td>}
                            {fieldSettings.phone.visible && <td className="p-4 text-sm text-gray-500">{r.userPhone || '-'}</td>}
                            {fieldSettings.affiliation.visible && <td className="p-4 text-sm text-gray-500">{r.userOrg || r.affiliation || '-'}</td>}
                            {fieldSettings.position.visible && <td className="p-4 text-sm text-gray-500">{r.position || '-'}</td>}
                            {fieldSettings.licenseNumber.visible && <td className="p-4 text-sm text-gray-500">{r.licenseNumber || '-'}</td>}
                            <td className="p-4 text-sm text-gray-500">{displayTier(r.tier)}</td>
                            <td className="p-4 text-sm font-medium text-[#1b4d77]">
                                <div>{(r.amount || 0).toLocaleString()}원</div>
                                {r.options && r.options.length > 0 && (
                                    <div className="text-[10px] mt-1">
                                        <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-bold">
                                            + 옵션 ({r.options.length})
                                        </span>
                                    </div>
                                )}
                            </td>
                            <td className="p-4 text-sm text-gray-500">{r.paymentType || r.paymentMethod || r.method || '카드'}</td>
                            <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${r.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-100' :
                                    (r.status === 'WAITING_FOR_DEPOSIT' || r.status === 'PENDING_PAYMENT') ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                        'bg-red-50 text-red-700 border-red-100'
                                    }`}>
                                    {statusToKorean(r.status)}
                                </span>
                                {(r.status === 'WAITING_FOR_DEPOSIT' || r.status === 'PENDING_PAYMENT') && r.virtualAccount && (
                                    <div className="text-[10px] text-gray-500 mt-1">
                                        {r.virtualAccount.bank} {r.virtualAccount.accountNumber}
                                    </div>
                                )}
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-2 justify-center">
                                    {r.badgeIssued ? (
                                        <span className="text-green-600 font-bold text-xs flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> 발급완료
                                        </span>
                                    ) : (
                                        r.status === 'PAID' && (
                                            <EregiButton
                                                onClick={(e) => handleIssueBadge(e, r)}
                                                variant="secondary"
                                                className="px-3 py-1 text-xs h-auto bg-white border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100"
                                            >
                                                명찰 발급
                                            </EregiButton>
                                        )
                                    )}
                                    <EregiButton
                                        onClick={(e) => handleBixolonPrint(e, r)}
                                        variant="secondary"
                                        className="px-2 py-1 text-xs h-auto bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700 font-bold"
                                        title="명찰 프린트"
                                        disabled={bixolonPrinting}
                                    >
                                        명찰 프린트
                                    </EregiButton>
                                    <EregiButton
                                        onClick={(e) => handleResendNotification(e, r)}
                                        variant="secondary"
                                        className="px-2 py-1 text-xs h-auto bg-indigo-50 border-indigo-200 hover:bg-indigo-100 text-indigo-700"
                                        title="알림톡 발송"
                                        disabled={isProcessing}
                                    >
                                        <MessageCircle size={14} />
                                    </EregiButton>
                                </div>
                            </td>
                            <td className="p-4 text-center">
                                <EregiButton
                                    onClick={(e) => handleDeleteRegistration(e, r)}
                                    variant="secondary"
                                    className="px-2 py-1 text-xs h-auto bg-red-50 border-red-200 hover:bg-red-100 text-red-600"
                                    title="삭제"
                                >
                                    🗑️
                                </EregiButton>
                            </td>
                            <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                                {r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : '-'}
                            </td>
                        </tr>
                    ))}
                    {filteredData.length === 0 && (
                        <tr><td colSpan={15} className="p-8 text-center text-gray-500">등록된 내역이 없습니다. (No records found)</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
