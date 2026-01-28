import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Printer, XCircle, CheckCircle, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

const getConferenceIdByDomain = () => {
    const hostname = window.location.hostname;
    if (hostname.includes('kap.eregi')) {
        return 'kap_2026Spring';
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
    const { cid, id } = useParams<{ cid: string; id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
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
                    const flattened = { id: snap.id, ...docData } as any;

                    // Flatten userInfo fields to top level for display
                    if (docData.userInfo) {
                        flattened.userName = docData.userInfo.name || docData.userName;
                        flattened.userEmail = docData.userInfo.email || docData.userEmail;
                        flattened.userPhone = docData.userInfo.phone || docData.userPhone;
                        flattened.affiliation = docData.userInfo.affiliation || docData.affiliation;
                        flattened.licenseNumber = docData.userInfo.licenseNumber || docData.licenseNumber;
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
        if (!confirm('정말로 결제를 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

        setCanceling(true);
        try {
            const regRef = doc(db, 'conferences', effectiveCid, 'registrations', id);
            await updateDoc(regRef, {
                status: 'CANCELED',
                canceledAt: Timestamp.now()
            });

            await addDoc(collection(db, `conferences/${effectiveCid}/registrations/${id}/logs`), {
                type: 'PAYMENT_CANCELED',
                timestamp: Timestamp.now(),
                method: 'ADMIN_MANUAL',
                amount: data.amount,
                paymentKey: data.paymentKey
            });

            toast.success('결제가 취소되었습니다.');
            setData((prev: any) => ({ ...prev, status: 'CANCELED' }));
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
            setData((prev: any) => ({ ...prev, status: 'REFUND_REQUESTED' }));
        } catch (error) {
            console.error('Refund request error:', error);
            toast.error('상태 변경 실패');
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;
    if (!data) return <div className="p-8">데이터가 없습니다.</div>;

    const canCancel = data.status === 'PAID' && data.paymentKey;
    const canRequestRefund = data.status === 'PAID';

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
                    <span className={`px-2 py-1 rounded font-bold ${
                        data.status === 'PAID' ? 'bg-green-100 text-green-800' :
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
                    <p className="text-lg">{data.licenseNumber || '-'}</p>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">등록등급 (Grade)</h3>
                    <p className="text-lg">{data.grade}</p>
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

                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">결제일시 (Paid At)</h3>
                    <p className="text-lg">{data.paidAt && typeof data.paidAt === 'object' && 'toDate' in data.paidAt ? (data.paidAt as { toDate: () => Date }).toDate().toLocaleString() : '-'}</p>
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
                        * 결제 취소는 PG사直接 환불 처리됩니다.
                    </p>
                </div>
            )}
        </div>
    );
};

export default RegistrationDetailPage;
