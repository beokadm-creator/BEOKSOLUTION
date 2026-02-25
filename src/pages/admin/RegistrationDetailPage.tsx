import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Printer, XCircle, CheckCircle, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { Registration } from '../../types/schema';

// Extended type for flattened data in UI
// Extended type for flattened data in UI
interface ExtendedRegistration extends Omit<Registration, 'baseAmount' | 'optionsTotal' | 'selectedOptions'> {
    tier?: string;
    grade?: string;
    categoryName?: string;
    userOrg?: string;
    paymentKey?: string;
    paidAt?: { seconds: number; nanoseconds?: number } | Date | string;
    orderId?: string;
    paymentType?: string;
    method?: string;
    userInfo?: {
        licenseNumber?: string;
        grade?: string;
        [key: string]: unknown;
    };
    license?: string; // For explicit fallback
    baseAmount?: number;
    optionsTotal?: number;
    options?: Array<{
        optionId: string;
        name: { ko: string; en?: string } | string;
        price: number;
        quantity: number;
        totalPrice: number;
    }>;
    selectedOptions?: Array<{
        optionId: string;
        name: { ko: string; en?: string } | string;
        price: number;
        quantity: number;
        totalPrice: number;
    }>;
}

const getConferenceIdByDomain = () => {
    const hostname = window.location.hostname;
    if (hostname.includes('kap.eregi')) {
        return 'kap_2026spring';
    }
    if (hostname.includes('kadd.eregi')) {
        return 'kadd_2026spring';
    }
    return 'kadd_2026spring';
};

const paymentMethodToKorean = (method: string | undefined): string => {
    if (!method) return '-';
    switch (method) {
        case 'CARD': return '카드';
        case 'TRANSFER': return '계좌이체';
        case 'VIRTUAL': return '가상계좌';
        case 'CASH': return '현금';
        case 'ADMIN_FREE': return '관리자 무료 등록';
        default: return method;
    }
};

const RegistrationDetailPage: React.FC = () => {
    const { cid, regId } = useParams<{ cid: string; regId: string }>();
    const id = regId;
    const navigate = useNavigate();
    const [data, setData] = useState<ExtendedRegistration | null>(null);
    const [loading, setLoading] = useState(true);
    const [canceling, setCanceling] = useState(false);
    const [effectiveCid, setEffectiveCid] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            let targetCid = cid;

            if (!targetCid) {
                targetCid = getConferenceIdByDomain();
                setEffectiveCid(targetCid);
            } else {
                setEffectiveCid(targetCid);
            }

            if (!id || !targetCid) return;
            try {
                const ref = doc(db, 'conferences', targetCid, 'registrations', id);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const docData = snap.data();
                    const flattened = { id: snap.id, ...docData } as ExtendedRegistration;

                    // Flatten userInfo fields to top level for display
                    if (docData.userInfo) {
                        flattened.userName = docData.userInfo.name || docData.userName;
                        flattened.userEmail = docData.userInfo.email || docData.userEmail;
                        flattened.userPhone = docData.userInfo.phone || docData.userPhone;
                        flattened.affiliation = docData.userInfo.affiliation || docData.affiliation;
                        flattened.licenseNumber = docData.userInfo.licenseNumber || docData.licenseNumber;

                        // [Fix] Map grade/tier from userInfo if available
                        if (!flattened.tier && docData.userInfo.grade) {
                            flattened.tier = docData.userInfo.grade;
                        }
                    }

                    // [Fix] Ensure optionsTotal is accurate by calculating from array if missing/zero
                    const optionsList = flattened.options || flattened.selectedOptions || [];
                    const calculatedOptionsTotal = optionsList.reduce((sum: number, opt: unknown) => sum + ((opt as Record<string, unknown>).totalPrice || ((opt as Record<string, unknown>).price as number | undefined) * ((opt as Record<string, unknown>).quantity as number | undefined) || 0), 0);

                    if (calculatedOptionsTotal > 0 && (!flattened.optionsTotal || flattened.optionsTotal === 0)) {
                        console.log('[RegistrationDetailPage] Correcting optionsTotal from array:', calculatedOptionsTotal);
                        flattened.optionsTotal = calculatedOptionsTotal;
                    }

                    // [Fix] Map schema-defined userTier to tier if tier is missing
                    if (!flattened.tier && docData.userTier) {
                        // @ts-expect-error - Dynamic key injection from Firestore
                        (flattened as Record<string, unknown>).tier = docData.userTier;
                    }

                    // [Fix] Fallback for licenseNumber
                    if (!flattened.licenseNumber && docData.license) {
                        flattened.licenseNumber = docData.license;
                    }

                    // [Fix] Extract payment details from nested object if available
                    if (docData.paymentDetails) {
                        if (!flattened.paymentKey && docData.paymentDetails.paymentKey) {
                            flattened.paymentKey = docData.paymentDetails.paymentKey;
                        }
                        if (!flattened.paymentMethod && docData.paymentDetails.method) {
                            flattened.paymentMethod = docData.paymentDetails.method;
                        }
                        // Handle paidAt / approvedAt
                        if (!flattened.paidAt && docData.paymentDetails.approvedAt) {
                            // approvedAt is ISO string, convert to Date object for consistent handling
                            flattened.paidAt = new Date(docData.paymentDetails.approvedAt);
                        }
                    }

                    setData(flattened);
                } else {
                    toast.error('등록 정보를 찾을 수 없습니다.');
                    navigate(-1);
                }
            } catch (error) {
                console.error('Fetch error:', error);
                toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [cid, id, navigate]);

    const handlePaymentCancel = async () => {
        if (!effectiveCid || !id || !data) return;
        if (!confirm('정말로 결제를 취소하시겠습니까? PG 승인 취소가 진행되며, 이 작업은 되돌릴 수 없습니다.')) return;

        setCanceling(true);
        try {
            // [Modified] Call Cloud Function to Cancel Payment via PG API
            const { httpsCallable } = await import('firebase/functions');
            const { functions } = await import('../../firebase'); // Dynamic import to ensure init

            const cancelFn = httpsCallable(functions, 'cancelTossPayment');

            await cancelFn({
                paymentKey: data.paymentKey,
                cancelReason: 'Admin Manual Cancel',
                confId: effectiveCid,
                regId: id
            });

            // DB Updates are handled by Cloud Function now (or we can double check/refresh here)
            // But for UI feedback:
            toast.success('결제가 취소되었습니다.');
            setData((prev) => prev ? { ...prev, status: 'CANCELED' as const } : null);
        } catch (error) {
            console.error('Cancel error:', error);
            toast.error('취소 실패: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setCanceling(false);
        }
    };

    const handleRefundRequest = async () => {
        if (!effectiveCid || !id || !data) return;
        if (!confirm('환불 요청 상태로 변경하시겠습니까?')) return;

        try {
            const regRef = doc(db, 'conferences', effectiveCid, 'registrations', id);
            await updateDoc(regRef, {
                status: 'REFUND_REQUESTED',
                refundRequestedAt: Timestamp.now()
            });

            await addDoc(collection(db, `conferences/${effectiveCid}/registrations/${id}/logs`), {
                type: 'REFUND_REQUESTED',
                timestamp: Timestamp.now(),
                method: 'ADMIN_MANUAL'
            });

            toast.success('환불 요청 상태로 변경되었습니다.');
            setData((prev) => prev ? { ...prev, status: 'REFUND_REQUESTED' as const } : null);
        } catch (error) {
            console.error('Refund request error:', error);
            toast.error('상태 변경 실패');
        }
    };

    const handleManualApprove = async () => {
        if (!effectiveCid || !id || !data) return;
        if (!confirm('수동으로 결제 완료 처리하시겠습니까? (시스템 오류로 결제되었으나 반영되지 않은 경우 등)')) return;

        try {
            const regRef = doc(db, 'conferences', effectiveCid, 'registrations', id);
            await updateDoc(regRef, {
                status: 'PAID',
                paidAt: Timestamp.now(),
                paymentMethod: 'ADMIN_MANUAL'
            });

            await addDoc(collection(db, `conferences/${effectiveCid}/registrations/${id}/logs`), {
                type: 'MANUAL_APPROVE',
                timestamp: Timestamp.now(),
                method: 'ADMIN_MANUAL'
            });

            toast.success('결제 완료 처리되었습니다.');
            setData((prev) => prev ? { ...prev, status: 'PAID' as const } : null);
        } catch (error) {
            console.error('Manual approve error:', error);
            toast.error('처리 실패');
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;
    if (!data) return <div className="p-8">데이터가 없습니다.</div>;

    const canCancel = data.status === 'PAID' && data.paymentKey;
    const canRequestRefund = data.status === 'PAID';
    const canManualApprove = data.status === 'PENDING' || data.status === 'FAILED';

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

                <div className="col-span-2 border-t my-2"></div>

                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">이름 (Name)</h3>
                    <p className="text-lg">{data.userName}</p>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">소속 (Affiliation)</h3>
                    <p className="text-lg">{data.userOrg || data.affiliation || '-'}</p>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">이메일 (Email)</h3>
                    <p className="text-lg">{data.userEmail}</p>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">전화번호 (Phone)</h3>
                    <p className="text-lg">{data.userPhone}</p>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">면허번호 (License)</h3>
                    <p className="text-lg">{data.licenseNumber || data.userInfo?.licenseNumber || (data as Record<string, unknown>).userInfo?.licensenumber || (data as Record<string, unknown>).license || (data as Record<string, unknown>).formData?.licenseNumber || '-'}</p>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">등록등급 (Grade)</h3>
                    <p className="text-lg">{data.tier || data.userTier || data.categoryName || data.grade || '-'}</p>
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

                {/* Registration Fee Detail */}
                <div className="col-span-2">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-gray-500">결제 상세 정보 (Payment Detail)</h3>
                        {/* Diagnostic check: If amount is different from baseAmount but options list is empty */}
                        {data.amount !== ((data.baseAmount !== undefined && data.baseAmount !== data.amount ? data.baseAmount : (data.amount - (data.optionsTotal || 0)))) &&
                            !(data.options?.length || data.selectedOptions?.length) && (
                                <span className="text-[10px] bg-red-50 text-red-500 px-2 py-1 rounded border border-red-100 font-bold animate-pulse">
                                    [진단] {data.amount.toLocaleString()}원 중 {(data.amount - (data.baseAmount || data.amount)).toLocaleString()}원의 옵션 내역이 데이터베이스에서 누락되었습니다.
                                </span>
                            )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        {/* Base Price */}
                        {/* Base Price */}
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">등록비 (Registration Fee)</span>
                            <span className="font-medium">
                                {(data.baseAmount !== undefined && data.baseAmount !== data.amount
                                    ? data.baseAmount
                                    : (data.amount - (data.optionsTotal || 0))).toLocaleString()}원
                            </span>
                        </div>

                        {/* Options */}
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

                        {/* Total */}
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
                            수동 결제 완료 처리 (Force Approve)
                        </Button>
                        <p className="text-sm text-blue-600 ml-2">
                            * 실제 결제가 되었으나 시스템 오류로 대기 상태인 경우 사용하세요.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RegistrationDetailPage;
