import React, { useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { XCircle, Home, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useUserStore } from '../store/userStore';

const RegistrationFailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { language } = useUserStore();

    // Get error details from URL params
    const regId = searchParams.get('regId');
    const code = searchParams.get('code') || 'PAYMENT_FAILED';
    const message = searchParams.get('message') || (language === 'ko' ? '결제 처리 중 오류가 발생했습니다.' : 'An error occurred during payment processing.');

    // Auto-scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const handleRetry = () => {
        // Redirect back to registration page
        if (slug) {
            navigate(`/${slug}/register`, { replace: true });
        } else {
            navigate('/', { replace: true });
        }
    };

    const handleGoHome = () => {
        if (slug) {
            navigate(`/${slug}`, { replace: true });
        } else {
            navigate('/', { replace: true });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#fef2f2] via-[#fee2e2] to-[#fecaca]">
            <Card className="w-full max-w-2xl shadow-2xl bg-white border border-red-100 rounded-[32px] overflow-hidden animate-in fade-in zoom-in duration-500 relative">
                {/* Top Decor */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-red-500"></div>

                <CardHeader className="text-center pb-2 pt-12 px-8 md:px-12">
                    <div className="relative mx-auto w-24 h-24 mb-8">
                        {/* Pulse Effect */}
                        <div className="absolute inset-0 bg-[#fecaca] rounded-full animate-ping opacity-30"></div>
                        <div className="relative w-full h-full bg-[#fecaca] rounded-full flex items-center justify-center shadow-lg">
                            <XCircle className="w-12 h-12 text-red-600" />
                        </div>
                    </div>

                    <CardTitle className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                        {code === 'PAY_PROCESS_CANCELED'
                            ? (language === 'ko' ? '결제가 취소되었습니다' : 'Payment Canceled')
                            : (language === 'ko' ? '결제 실패' : 'Payment Failed')
                        }
                    </CardTitle>
                    <p className="text-lg text-gray-600 leading-relaxed max-w-lg mx-auto">
                        {code === 'PAY_PROCESS_CANCELED'
                            ? (language === 'ko' ? '결제 진행 중 취소하셨습니다.' : 'You canceled the payment.')
                            : (decodeURIComponent(message))
                        }
                    </p>
                </CardHeader>

                <CardContent className="space-y-8 px-8 md:px-12 pb-8">
                    <div className="bg-red-50/80 p-8 rounded-3xl border border-red-200 mt-6 shadow-sm">
                        <div className="flex flex-col space-y-4">
                            {code && (
                                <div className="flex justify-between items-center border-b border-red-200 pb-3">
                                    <span className="text-red-600 font-medium text-sm md:text-base">
                                        {language === 'ko' ? '에러 코드' : 'Error Code'}
                                    </span>
                                    <span className="font-mono font-bold text-red-700 text-base md:text-lg">{code}</span>
                                </div>
                            )}
                            {regId && (
                                <div className="flex justify-between items-center">
                                    <span className="text-red-600 font-medium text-sm md:text-base">
                                        {language === 'ko' ? '등록 ID' : 'Registration ID'}
                                    </span>
                                    <span className="font-mono font-bold text-red-700 text-base md:text-lg truncate max-w-[200px]">{regId}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-blue-50/80 p-6 rounded-2xl border border-blue-200">
                        <p className="text-sm text-blue-900 text-center leading-relaxed">
                            {language === 'ko'
                                ? '다시 시도하시거나, 문제가 지속되면 관리자에게 문의해주세요.'
                                : 'Please try again or contact support if the problem persists.'
                            }
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                            onClick={handleRetry}
                            className="bg-[#003366] hover:bg-[#002244] h-14 text-lg font-bold rounded-2xl shadow-lg shadow-blue-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all text-white"
                        >
                            <RotateCcw className="w-5 h-5 mr-2" />
                            {language === 'ko' ? '다시 시도하기' : 'Try Again'}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handleGoHome}
                            className="h-14 border-2 border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50 font-bold rounded-2xl text-lg transition-all"
                        >
                            <Home className="w-5 h-5 mr-2" />
                            {language === 'ko' ? '메인 화면' : 'Go Home'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default RegistrationFailPage;
