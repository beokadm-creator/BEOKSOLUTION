import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../hooks/useAdmin';
import { Registration } from '../../types/schema';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { RefreshCw, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

interface PaymentIntegrationCenterProps {
    conferenceId: string;
}

export const PaymentIntegrationCenter: React.FC<PaymentIntegrationCenterProps> = ({ conferenceId }) => {
    const { fetchRefundRequests, processRefund, loading, error } = useAdmin(conferenceId);
    const [requests, setRequests] = useState<Registration[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const loadRequests = async () => {
        try {
            const data = await fetchRefundRequests();
            setRequests(data);
        } catch (e) {
            console.error("Failed to load refund requests", e);
        }
    };

    useEffect(() => {
        if (conferenceId) loadRequests();
    }, [conferenceId]);

    const handleProcess = async (reg: Registration) => {
        const amountStr = prompt(`환불 금액을 입력하세요 (최대: ${reg.amount.toLocaleString()}원)`, reg.amount.toString());
        if (!amountStr) return;
        
        const amount = Number(amountStr);
        if (isNaN(amount) || amount <= 0 || amount > reg.amount) {
            toast.error("유효하지 않은 금액입니다.");
            return;
        }

        if (!confirm(`${amount.toLocaleString()}원을 환불하시겠습니까?`)) return;

        setProcessingId(reg.id);
        try {
            await processRefund(reg.id, amount);
            toast.success('환불 처리가 완료되었습니다.');
            loadRequests();
        } catch (e) {
            toast.error('환불 처리 실패');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    통합 결제/환불 관리 센터
                </CardTitle>
                <Button variant="outline" size="sm" onClick={loadRequests} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    새로고침
                </Button>
            </CardHeader>
            <CardContent>
                {error && <div className="text-red-500 mb-4">{error}</div>}
                
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>접수번호</TableHead>
                                <TableHead>사용자 ID</TableHead>
                                <TableHead>결제 금액</TableHead>
                                <TableHead>상태</TableHead>
                                <TableHead className="text-right">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requests.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                        처리 대기 중인 환불 요청이 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                requests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell className="font-mono">{req.receiptNumber}</TableCell>
                                        <TableCell className="text-xs text-gray-500">{req.userId}</TableCell>
                                        <TableCell>{req.amount.toLocaleString()}원</TableCell>
                                        <TableCell>
                                            <Badge variant={req.paymentStatus === 'REFUND_REQUESTED' ? 'destructive' : 'secondary'}>
                                                {req.paymentStatus}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                size="sm" 
                                                variant="destructive"
                                                onClick={() => handleProcess(req)}
                                                disabled={processingId === req.id}
                                            >
                                                {processingId === req.id ? '처리 중...' : '환불 승인'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};
