import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { CheckCircle2, Download, Home, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useUserStore } from '../store/userStore';
import { useConference } from '../hooks/useConference';

const RegistrationSuccessPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { language } = useUserStore();
    const conference = useConference();

    // Determine targetSlug: extract pure slug from composite ID like "kadd_2026spring" -> "2026spring"
    // This ensures we redirect to /2026spring not /kadd_2026spring
    const finalSlug = (() => {
        // First try to use conference.slug from document data (cleanest approach)
        if (conference.slug) {
            return conference.slug;
        }
        // Fallback: extract pure slug from composite ID
        if (conference.id) {
            const parts = conference.id.split('_');
            if (parts.length > 1) {
                // parts[0] = societyId, parts[1] onwards = slug
                return parts.slice(1).join('_');
            }
        }
        return 'home';
    })();

    const orderId = searchParams.get('orderId');
    const userName = searchParams.get('name');

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#f0f5fa] via-[#dbeafe] to-[#d1fae5]">
            <Card className="w-full max-w-2xl shadow-2xl bg-white border border-gray-100 rounded-[32px] overflow-hidden animate-in fade-in zoom-in duration-500 relative">
                {/* Top Decor */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#003366] to-[#24669e]"></div>

                <CardHeader className="text-center pb-2 pt-12 px-8 md:px-12">
                    <div className="relative mx-auto w-24 h-24 mb-8">
                        {/* Pulse Effect */}
                        <div className="absolute inset-0 bg-[#d1fae5] rounded-full animate-ping opacity-30"></div>
                        <div className="relative w-full h-full bg-[#d1fae5] rounded-full flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
                            <CheckCircle2 className="w-12 h-12 text-[#065f46]" />
                        </div>
                    </div>

                    <CardTitle className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                        {language === 'ko' ? '등록이 완료되었습니다!' : 'Registration Completed!'}
                    </CardTitle>
                    <p className="text-lg text-gray-600 leading-relaxed max-w-lg mx-auto">
                        {language === 'ko' ? '학회 등록 및 결제가 성공적으로 처리되었습니다.' : 'Your registration and payment have been successfully processed.'}
                    </p>
                </CardHeader>

                <CardContent className="space-y-8 px-8 md:px-12 pb-8">
                    <div className="bg-gray-50/80 p-8 rounded-3xl border border-gray-200 mt-6 shadow-sm">
                        <div className="flex flex-col space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                                <span className="text-gray-500 font-medium text-sm md:text-base">Registration ID</span>
                                <span className="font-mono font-bold text-gray-800 text-base md:text-lg">{orderId || 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                                <span className="text-gray-500 font-medium text-sm md:text-base">Name</span>
                                <span className="font-bold text-gray-900 text-base md:text-lg">{userName || 'Guest'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium text-sm md:text-base">Date</span>
                                <span className="font-medium text-gray-900 text-base md:text-lg">{new Date().toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                            onClick={handlePrint}
                            className="bg-[#003366] hover:bg-[#002244] h-14 text-lg font-bold rounded-2xl shadow-lg shadow-blue-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all text-white"
                        >
                            <Download className="w-5 h-5 mr-2" />
                            {language === 'ko' ? '접수증 출력' : 'Print Receipt'}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => navigate(`/${finalSlug}/abstracts`)}
                            className="h-14 border-2 border-gray-200 hover:border-[#003366]/20 text-[#003366] hover:bg-blue-50 font-bold rounded-2xl text-lg transition-all"
                        >
                            <FileText className="w-5 h-5 mr-2" />
                            {language === 'ko' ? '초록 제출' : 'Submit Abstract'}
                        </Button>
                    </div>

                    <div className="pt-6 border-t border-gray-100 flex justify-center w-full">
                        <Button variant="ghost" onClick={() => navigate(`/${finalSlug}`)} className="text-gray-400 hover:text-gray-600 font-medium">
                            <Home className="w-4 h-4 mr-2" />
                            {language === 'ko' ? '메인 화면으로 돌아가기' : 'Return to Home'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default RegistrationSuccessPage;
