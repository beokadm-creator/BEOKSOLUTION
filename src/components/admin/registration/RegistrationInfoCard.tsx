import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Save, X } from 'lucide-react';
import type { RegistrationFieldSettings } from '@/types/schema';
import type { ExtendedRegistration, EditFormData } from '@/hooks/useRegistrationDetail';
import { paymentMethodToKorean } from '@/hooks/useRegistrationDetail';

interface RegistrationInfoCardProps {
    data: ExtendedRegistration;
    fieldSettings: RegistrationFieldSettings;
    isEditing: boolean;
    editData: EditFormData;
    setEditData: React.Dispatch<React.SetStateAction<EditFormData>>;
    isSaving: boolean;
    onSave: () => void;
    onCancelEdit: () => void;
    onEdit: () => void;
}

export const RegistrationInfoCard: React.FC<RegistrationInfoCardProps> = ({
    data, fieldSettings, isEditing, editData, setEditData, isSaving, onSave, onCancelEdit, onEdit
}) => {
    return (
        <div className="grid grid-cols-2 gap-8 border p-6 rounded-lg">
            <div>
                <h3 className="text-sm font-bold text-gray-500 mb-1">주문번호 (Order ID)</h3>
                <p className="font-mono text-lg">{data.orderId || data.id}</p>
            </div>
            <div>
                <h3 className="text-sm font-bold text-gray-500 mb-1">등록상태 (Status)</h3>
                <span className={`px-2 py-1 rounded font-bold ${data.status === 'PAID' ? 'bg-green-100 text-green-800' :
                    data.status === 'REFUND_REQUESTED' ? 'bg-yellow-100 text-yellow-800' :
                        data.status === 'REFUNDED' ? 'bg-blue-100 text-blue-800' :
                            data.status === 'CANCELED' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                    }`}>
                    {data.status === 'PAID' ? '결제완료' :
                        data.status === 'REFUND_REQUESTED' ? '환불요청' :
                            data.status === 'REFUNDED' ? '환불완료' :
                                data.status === 'CANCELED' ? '취소됨' : data.status}
                </span>
            </div>

            <div className="col-span-2 flex justify-between items-center border-t py-2 my-2">
                <h2 className="text-lg font-bold">기본 정보 (Basic Information)</h2>
                {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={onEdit}>
                        <Edit className="w-4 h-4 mr-2" /> 수정하기
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={onCancelEdit} disabled={isSaving}>
                            <X className="w-4 h-4 mr-2" /> 취소
                        </Button>
                        <Button variant="default" size="sm" onClick={onSave} disabled={isSaving}>
                            {isSaving ? '저장중...' : <><Save className="w-4 h-4 mr-2" /> 저장</>}
                        </Button>
                    </div>
                )}
            </div>

            {fieldSettings.name.visible && (
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">이름 (Name)</h3>
                    {isEditing ? (
                        <input
                            type="text"
                            className="border p-2 rounded w-full border-blue-400 bg-blue-50"
                            value={editData.userName}
                            onChange={(e) => setEditData({ ...editData, userName: e.target.value })}
                        />
                    ) : (
                        <p className="text-lg">{data.userName}</p>
                    )}
                </div>
            )}
            {fieldSettings.affiliation.visible && (
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">소속 (Affiliation)</h3>
                    {isEditing ? (
                        <input
                            type="text"
                            className="border p-2 rounded w-full border-blue-400 bg-blue-50"
                            value={editData.userOrg}
                            onChange={(e) => setEditData({ ...editData, userOrg: e.target.value })}
                        />
                    ) : (
                        <p className="text-lg">{data.userOrg || data.affiliation || '-'}</p>
                    )}
                </div>
            )}
            {fieldSettings.position.visible && (
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">직급 (Position)</h3>
                    {isEditing ? (
                        <input
                            type="text"
                            className="border p-2 rounded w-full border-blue-400 bg-blue-50"
                            value={editData.position}
                            onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                        />
                    ) : (
                        <p className="text-lg">{data.position || '-'}</p>
                    )}
                </div>
            )}

            {fieldSettings.email.visible && (
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">이메일 (Email) <span className="text-xs font-normal">(수정불가)</span></h3>
                    <p className="text-lg text-gray-600">{data.userEmail}</p>
                </div>
            )}
            {fieldSettings.phone.visible && (
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">전화번호 (Phone)</h3>
                    {isEditing ? (
                        <input
                            type="text"
                            className="border p-2 rounded w-full border-blue-400 bg-blue-50"
                            value={editData.userPhone}
                            onChange={(e) => setEditData({ ...editData, userPhone: e.target.value })}
                        />
                    ) : (
                        <p className="text-lg">{data.userPhone}</p>
                    )}
                </div>
            )}

            {fieldSettings.licenseNumber.visible && (
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">면허번호 (License)</h3>
                    {isEditing ? (
                        <input
                            type="text"
                            className="border p-2 rounded w-full border-blue-400 bg-blue-50"
                            value={editData.licenseNumber}
                            onChange={(e) => setEditData({ ...editData, licenseNumber: e.target.value })}
                        />
                    ) : (
                        <p className="text-lg">{data.licenseNumber || data.userInfo?.licenseNumber || (data as Record<string, unknown>).userInfo?.licensenumber || (data as Record<string, unknown>).license || (data as Record<string, unknown>).formData?.licenseNumber || '-'}</p>
                    )}
                </div>
            )}
            <div>
                <h3 className="text-sm font-bold text-gray-500 mb-1">등록등급 (Grade) <span className="text-xs font-normal">(수정불가)</span></h3>
                <p className="text-lg text-gray-600">{data.tier || data.userTier || data.categoryName || data.grade || '-'}</p>
            </div>

            <div className="col-span-2 border-t my-2"></div>

            <div>
                <h3 className="text-sm font-bold text-gray-500 mb-1">결제금액 (Amount)</h3>
                <p className="text-xl font-bold text-blue-600">{Number(data.amount).toLocaleString()}원</p>
            </div>
            <div>
                <h3 className="text-sm font-bold text-gray-500 mb-1">결제수단 (Payment)</h3>
                <p className="text-lg">{paymentMethodToKorean(data.paymentMethod) || data.paymentType || data.method || '-'}</p>
            </div>

            <div className="col-span-2 border-t my-2"></div>

            <div className="col-span-2">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-gray-500">결제 상세 정보 (Payment Detail)</h3>
                    {data.amount !== ((data.baseAmount !== undefined && data.baseAmount !== data.amount ? data.baseAmount : (data.amount - (data.optionsTotal || 0)))) &&
                        !(data.options?.length || data.selectedOptions?.length) && (
                            <span className="text-[10px] bg-red-50 text-red-500 px-2 py-1 rounded border border-red-100 font-bold animate-pulse">
                                [진단] {data.amount.toLocaleString()}원 중 {(data.amount - (data.baseAmount || data.amount)).toLocaleString()}원의 옵션 내역이 데이터베이스에서 누락되었습니다.
                            </span>
                        )}
                </div>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">등록비 (Registration Fee)</span>
                        <span className="font-medium">
                            {(data.baseAmount !== undefined && data.baseAmount !== data.amount
                                ? data.baseAmount
                                : (data.amount - (data.optionsTotal || 0))).toLocaleString()}원
                        </span>
                    </div>

                    {((data.options && data.options.length > 0) || (data.selectedOptions && data.selectedOptions.length > 0)) && (
                        <div className="space-y-2 pt-2 border-t border-gray-200">
                            <p className="text-xs font-bold text-gray-400 uppercase">선택 옵션 (Selected Options)</p>
                            {(data.options || data.selectedOptions || []).map((opt, idx) => (
                                <div key={idx} className="flex justify-between items-start text-sm">
                                    <div className="flex flex-col">
                                        <span className="text-gray-800 font-medium">
                                            {typeof opt.name === 'string' ? opt.name : (opt.name.ko || opt.name.en || 'Option')}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {opt.price.toLocaleString()}원 × {opt.quantity}
                                        </span>
                                    </div>
                                    <span className="font-medium">{(opt.totalPrice || (opt.price * opt.quantity)).toLocaleString()}원</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
                        <span className="font-bold text-gray-900">최종 결제 금액 (Total Amount)</span>
                        <span className="text-xl font-bold text-blue-600">
                            {Number(data.amount).toLocaleString()}원
                        </span>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-bold text-gray-500 mb-1">결제일시 (Paid At)</h3>
                <p className="text-lg">
                    {data.paidAt
                        ? (data.paidAt instanceof Date
                            ? data.paidAt.toLocaleString()
                            : (typeof data.paidAt === 'object' && 'toDate' in data.paidAt
                                ? (data.paidAt as { toDate: () => Date }).toDate().toLocaleString()
                                : String(data.paidAt)))
                        : '-'}
                </p>
            </div>
            <div>
                <h3 className="text-sm font-bold text-gray-500 mb-1">PG 거래번호 (Payment Key)</h3>
                <p className="font-mono text-sm">{data.paymentKey || '-'}</p>
            </div>
        </div>
    );
};
