import React, { useRef } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { CheckCircle2, Download, Home, FileText } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { useUserStore } from '../store/userStore';

const RegistrationSuccessPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { language } = useUserStore();

    const orderId = searchParams.get('orderId');
    const userName = searchParams.get('name');

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg shadow-xl bg-white animate-in fade-in zoom-in duration-500">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">
                        {language === 'ko' ? '등록이 완료되었습니다!' : 'Registration Completed!'}
                    </CardTitle>
                    <p className="text-gray-500 mt-2">
                        {language === 'ko' ? '학회 등록 및 결제가 성공적으로 처리되었습니다.' : 'Your registration and payment have been successfully processed.'}
                    </p>
                </CardHeader>

                <CardContent className="space-y-6 pt-6">
                    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">Registration ID (Order ID)</span>
                            <span className="font-mono font-medium text-gray-800">{orderId || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">Name</span>
                            <span className="font-medium text-gray-800">{userName || 'Guest'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">Date</span>
                            <span className="font-medium text-gray-800">{new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4 pb-8">
                    <div className="w-full space-y-3">
                        <p className="text-sm font-bold text-gray-900 mb-2">
                            {language === 'ko' ? '다음 단계' : 'Next Steps'}
                        </p>
                        <Button
                            onClick={handlePrint}
                            className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg shadow-md transition-all hover:-translate-y-0.5"
                        >
                            <Download className="w-5 h-5 mr-2" />
                            {language === 'ko' ? '접수증/영수증 출력' : 'Print Receipt / Confirmation'}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => navigate(`/${slug}/abstracts`)}
                            className="w-full h-12 border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            {language === 'ko' ? '초록 제출하러 가기' : 'Submit Abstract'}
                        </Button>
                    </div>

                    <div className="pt-4 border-t w-full">
                        <Button variant="ghost" onClick={() => navigate(`/${slug}`)} className="w-full text-gray-400 hover:text-gray-600">
                            <Home className="w-4 h-4 mr-2" />
                            {language === 'ko' ? '메인 화면으로 돌아가기' : 'Return to Home'}
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};

export default RegistrationSuccessPage;
