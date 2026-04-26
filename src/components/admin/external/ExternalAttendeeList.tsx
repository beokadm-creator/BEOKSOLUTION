import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Download, FileText, Badge, Trash2, MessageCircle, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ExternalAttendee } from '@/types/schema';

interface ExternalAttendeeListProps {
    externalAttendees: ExternalAttendee[];
    selectedIds: string[];
    isProcessing: boolean;
    exporting: boolean;
    bixolonPrinting: boolean;
    toggleSelection: (e: React.MouseEvent, id: string) => void;
    toggleSelectAll: () => void;
    handleExport: () => void;
    handleDelete: (attendee: ExternalAttendee) => Promise<void>;
    handleResendNotification: (attendee: ExternalAttendee) => Promise<void>;
    handleBulkResendNotification: (mode: 'selected' | 'all') => Promise<void>;
    handleCreateAccount: (attendee: ExternalAttendee) => Promise<void>;
    handleIssueBadge: (attendee: ExternalAttendee) => Promise<void>;
    handleBixolonPrint: (attendee: ExternalAttendee) => Promise<void>;
    onOpenVoucherModal: (attendee: ExternalAttendee) => void;
}

export const ExternalAttendeeList: React.FC<ExternalAttendeeListProps> = ({
    externalAttendees, selectedIds, isProcessing, exporting, bixolonPrinting,
    toggleSelection, toggleSelectAll, handleExport, handleDelete, handleResendNotification,
    handleBulkResendNotification, handleCreateAccount, handleIssueBadge, handleBixolonPrint,
    onOpenVoucherModal
}) => {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5" />
                        등록된 외부 참석자 ({externalAttendees.length})
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBulkResendNotification('selected')}
                            disabled={isProcessing || selectedIds.length === 0}
                            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            선택 발송 ({selectedIds.length})
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBulkResendNotification('all')}
                            disabled={isProcessing || externalAttendees.length === 0}
                            className="text-white bg-indigo-600 border-indigo-600 hover:bg-indigo-700"
                        >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            전체 발송 (전체)
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            disabled={exporting || externalAttendees.length === 0}
                            className="text-white bg-green-600 border-green-600 hover:bg-green-700"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            엑셀 다운로드 ({externalAttendees.length})
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 w-10 text-center">
                                    <button onClick={toggleSelectAll} className="p-1 hover:bg-blue-50 rounded">
                                        {selectedIds.length === externalAttendees.length && externalAttendees.length > 0 ? (
                                            <CheckSquare size={18} className="text-blue-600 inline" />
                                        ) : (
                                            <Square size={18} className="text-gray-300 inline" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left font-semibold">이름</th>
                                <th className="px-4 py-3 text-left font-semibold">이메일</th>
                                <th className="px-4 py-3 text-left font-semibold">전화번호 / 소속</th>
                                <th className="px-4 py-3 text-center font-semibold">계정상태</th>
                                <th className="px-4 py-3 text-center font-semibold">명찰</th>
                                <th className="px-4 py-3 text-center font-semibold">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {externalAttendees.map(attendee => {
                                const hasAccount = attendee.authCreated || (attendee.userId && !attendee.userId.startsWith('EXT-'));
                                return (
                                    <tr key={attendee.id} className={`border-t hover:bg-gray-50 transition-colors ${selectedIds.includes(attendee.id) ? 'bg-blue-50/50' : ''}`}>
                                        <td className="px-4 py-3 text-center" onClick={(e) => toggleSelection(e, attendee.id)}>
                                            <button className="p-1 hover:bg-blue-50 rounded">
                                                {selectedIds.includes(attendee.id) ? (
                                                    <CheckSquare size={18} className="text-blue-600 inline" />
                                                ) : (
                                                    <Square size={18} className="text-gray-300 inline" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 font-medium">{attendee.name}</td>
                                        <td className="px-4 py-3">{attendee.email}</td>
                                        <td className="px-4 py-3">
                                            <div>{attendee.phone}</div>
                                            <div className="text-gray-500 text-xs">{attendee.organization}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {hasAccount ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-green-600 text-xs font-semibold bg-green-100 px-2 py-1 rounded-full">생성완료</span>
                                                    {attendee.password && (
                                                        <span className="text-xs text-gray-400 mt-1 cursor-pointer" onClick={() => {
                                                            navigator.clipboard.writeText(attendee.password!);
                                                            toast.success('비밀번호 복사됨');
                                                        }} title="비밀번호 복사">PW복사</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    className='bg-blue-600 hover:bg-blue-700 h-7 text-xs'
                                                    onClick={() => handleCreateAccount(attendee)}
                                                    disabled={isProcessing}
                                                >
                                                    계정 생성
                                                </Button>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                {attendee.badgeIssued ? (
                                                    <span className="text-green-600 font-bold text-xs flex items-center justify-center gap-1">
                                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> 발급완료
                                                    </span>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs px-2"
                                                        onClick={() => handleIssueBadge(attendee)}
                                                        disabled={isProcessing}
                                                    >
                                                        <Badge className="w-3 h-3 mr-1" />
                                                        발급
                                                    </Button>
                                                )}
                                                <div className="flex gap-1 mt-1 justify-center">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-[10px] text-blue-700 font-bold bg-blue-50 hover:bg-blue-100"
                                                        onClick={() => handleBixolonPrint(attendee)}
                                                        disabled={bixolonPrinting}
                                                        title="명찰 프린트"
                                                    >
                                                        명찰 프린트
                                                    </Button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => onOpenVoucherModal(attendee)}
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50"
                                                    onClick={() => handleResendNotification(attendee)}
                                                    title="알림톡 발송"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDelete(attendee)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};
