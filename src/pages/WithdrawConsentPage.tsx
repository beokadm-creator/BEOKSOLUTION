import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { AlertCircle, CheckCircle, Shield, User } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';

export default function WithdrawConsentPage() {
    const [searchParams] = useSearchParams();
    const { auth } = useAuth();
    const [status, setStatus] = useState<'loading' | 'confirm' | 'processing' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');
    const [withdrawnCount, setWithdrawnCount] = useState(0);

    useEffect(() => {
        // Check if user is authenticated
        if (!auth.user) {
            setStatus('error');
            setMessage('로그인이 필요합니다.');
            return;
        }

        setStatus('confirm');
    }, [auth.user]);

    const handleWithdraw = async () => {
        if (!auth.user) return;

        setStatus('processing');
        setMessage('동의 철회 처리 중입니다...');

        try {
            const withdrawConsentFunction = httpsCallable(functions, 'withdrawConsent');
            const result = await withdrawConsentFunction({
                visitorId: auth.user.uid,
                // conferenceId can be passed from URL params if needed
            });

            const data = result.data as { success: boolean; withdrawnCount: number; message: string };

            if (data.success) {
                setStatus('success');
                setWithdrawnCount(data.withdrawnCount);
                setMessage(data.message || '동의가 성공적으로 철회되었습니다.');
            } else {
                setStatus('error');
                setMessage(data.message || '동의 철회에 실패했습니다.');
            }
        } catch (error: any) {
            console.error('Consent withdrawal error:', error);
            setStatus('error');
            setMessage(error.message || '동의 철회 중 오류가 발생했습니다.');
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <LoadingSpinner />
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="p-6">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-2">오류 발생</h2>
                                <p className="text-gray-600">{message}</p>
                            </div>
                            <Button
                                onClick={() => window.history.back()}
                                variant="outline"
                                className="w-full"
                            >
                                돌아가기
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="p-6">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-2">동의 철회 완료</h2>
                                <p className="text-gray-600 mb-2">{message}</p>
                                {withdrawnCount > 0 && (
                                    <p className="text-sm text-gray-500">
                                        총 {withdrawnCount}개의 리드에서 개인정보가 삭제되었습니다.
                                    </p>
                                )}
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-left w-full">
                                <p className="text-blue-900 font-medium mb-2">💡 안내</p>
                                <ul className="text-blue-800 space-y-1 list-disc list-inside">
                                    <li>개인정보(이름, 소속, 연락처)가 즉시 삭제되었습니다.</li>
                                    <li>방문 기록은 "Anonymous(동의 철회)"로 저장됩니다.</li>
                                    <li>이 작업은 되돌릴 수 없습니다.</li>
                                </ul>
                            </div>
                            <Button
                                onClick={() => window.close()}
                                className="w-full bg-indigo-600 hover:bg-indigo-700"
                            >
                                닫기
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="max-w-lg w-full">
                <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                            <Shield className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <CardTitle>개인정보 제3자 제공 동의 철회</CardTitle>
                            <CardDescription>파트너 부스 방문 시 제공한 개인정보 처리에 대한 동의를 철회합니다.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* User Info */}
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                        <User className="w-5 h-5 text-gray-500" />
                        <div className="flex-1">
                            <p className="text-sm text-gray-600">계정</p>
                            <p className="font-medium text-gray-900">{auth.user?.email}</p>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium text-amber-900 mb-2">철회 전 확인하세요</p>
                                <ul className="text-amber-800 space-y-1 list-disc list-inside">
                                    <li>모든 파트너사에 저장된 개인정보가 즉시 삭제됩니다.</li>
                                    <li>이름, 소속, 연락처 등 PII 데이터가 복구 불가능하게 삭제됩니다.</li>
                                    <li>방문 기록은 "Anonymous"로 유지되지만 개인정보는 포함되지 않습니다.</li>
                                    <li>이 작업은 되돌릴 수 없습니다.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={() => window.history.back()}
                            variant="outline"
                            className="flex-1"
                            disabled={status === 'processing'}
                        >
                            취소
                        </Button>
                        <Button
                            onClick={handleWithdraw}
                            disabled={status === 'processing'}
                            className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                            {status === 'processing' ? (
                                <>
                                    <LoadingSpinner className="w-4 h-4 mr-2" />
                                    처리 중...
                                </>
                            ) : (
                                '동의 철회하기'
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
