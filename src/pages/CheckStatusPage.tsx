import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Search, Home, FileText, Download, QrCode } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useConference } from '../hooks/useConference';
import toast from 'react-hot-toast';

interface LookupResult {
    id: string;
    status: string;
    paymentStatus: string;
    userName: string;
    createdAt: { _seconds: number; _nanoseconds: number } | string;
    confirmationQr?: string;
    slug: string;
}

const CheckStatusPage: React.FC = () => {
    const navigate = useNavigate();
    const { language } = useUserStore();
    const conference = useConference();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<LookupResult | null>(null);

    const finalSlug = (() => {
        if (conference.slug) return conference.slug;
        if (conference.id) {
            const parts = conference.id.split('_');
            if (parts.length > 1) return parts.slice(1).join('_');
        }
        return 'home';
    })();

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error(language === 'ko' ? '이메일과 비밀번호를 모두 입력해주세요.' : 'Please enter both email and password.');
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const response = await fetch('https://us-central1-eregi-8fc1e.cloudfunctions.net/lookupRegistrationByEmail', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password,
                    confId: conference.id
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Lookup failed');
            }

            if (data.found && data.registration) {
                setResult(data.registration);
                toast.success(language === 'ko' ? '등록 내역을 찾았습니다.' : 'Registration found.');
            } else {
                throw new Error('Registration not found');
            }
        } catch (error: any) {
            console.error('Lookup error:', error);
            toast.error(error.message === 'Registration not found' || error.message === 'User account not found' || error.message === 'Incorrect password' 
                ? (language === 'ko' ? '일치하는 등록 내역이 없습니다. 정보를 확인해주세요.' : 'No matching registration found. Please check your info.')
                : (language === 'ko' ? '조회 중 오류가 발생했습니다.' : 'An error occurred during lookup.'));
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateObj: any) => {
        if (!dateObj) return '';
        let date;
        if (typeof dateObj === 'string') {
            date = new Date(dateObj);
        } else if (dateObj._seconds) {
            date = new Date(dateObj._seconds * 1000);
        } else {
            return '';
        }
        return date.toLocaleDateString();
    };

    const getStatusText = (status: string, paymentStatus: string) => {
        if (status === 'CANCELED' || paymentStatus === 'REFUNDED') return language === 'ko' ? '취소/환불됨' : 'Canceled/Refunded';
        if (paymentStatus === 'PENDING') return language === 'ko' ? '결제 대기중' : 'Payment Pending';
        return language === 'ko' ? '등록 완료' : 'Registration Complete';
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#f0f5fa] via-[#dbeafe] to-[#d1fae5]">
            <Card className="w-full max-w-lg shadow-2xl bg-white border border-gray-100 rounded-[32px] overflow-hidden animate-in fade-in zoom-in duration-500 relative">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#003366] to-[#24669e]"></div>

                <CardHeader className="text-center pb-6 pt-12 px-8">
                    <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                        <Search className="w-8 h-8 text-[#003366]" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                        {language === 'ko' ? '등록 내역 조회' : 'Check Registration Status'}
                    </CardTitle>
                    <CardDescription className="text-gray-500">
                        {language === 'ko' 
                            ? '등록 시 입력한 이메일과 설정한 비밀번호를 입력해주세요.' 
                            : 'Please enter the email and password you used during registration.'}
                    </CardDescription>
                </CardHeader>

                <CardContent className="px-8 pb-10 space-y-6">
                    {!result ? (
                        <form onSubmit={handleLookup} className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-gray-700 font-medium">
                                        {language === 'ko' ? '이메일 주소' : 'Email Address'}
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={language === 'ko' ? '등록된 이메일을 입력하세요' : 'Enter registered email'}
                                        className="h-12 border-gray-200 rounded-xl px-4"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-gray-700 font-medium">
                                        {language === 'ko' ? '등록 비밀번호' : 'Registration Password'}
                                    </Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={language === 'ko' ? '등록 시 설정한 비밀번호' : 'Password set during registration'}
                                        className="h-12 border-gray-200 rounded-xl px-4"
                                        required
                                    />
                                </div>
                            </div>

                            <Button 
                                type="submit" 
                                disabled={isLoading}
                                className="w-full bg-[#003366] hover:bg-[#002244] h-14 text-lg font-bold rounded-xl text-white transition-all shadow-md"
                            >
                                {isLoading 
                                    ? (language === 'ko' ? '조회 중...' : 'Looking up...') 
                                    : (language === 'ko' ? '조회하기' : 'Check Status')
                                }
                            </Button>
                        </form>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
                                <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                                    <span className="text-gray-500 font-medium">{language === 'ko' ? '등록자명' : 'Name'}</span>
                                    <span className="font-bold text-gray-900">{result.userName}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                                    <span className="text-gray-500 font-medium">{language === 'ko' ? '등록상태' : 'Status'}</span>
                                    <span className={`font-bold ${result.status === 'CANCELED' || result.paymentStatus === 'REFUNDED' ? 'text-red-600' : 'text-green-600'}`}>
                                        {getStatusText(result.status, result.paymentStatus)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                                    <span className="text-gray-500 font-medium">{language === 'ko' ? '접수번호' : 'Registration ID'}</span>
                                    <span className="font-mono text-gray-700">{result.id}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">{language === 'ko' ? '등록일' : 'Date'}</span>
                                    <span className="text-gray-900">{formatDate(result.createdAt)}</span>
                                </div>
                            </div>

                            {result.confirmationQr && (
                                <div className="flex flex-col items-center justify-center p-6 bg-white border-2 border-blue-50 rounded-2xl">
                                    <div className="text-[#003366] font-bold mb-4 flex items-center">
                                        <QrCode className="w-5 h-5 mr-2" />
                                        {language === 'ko' ? '입장용 QR 코드' : 'Entry QR Code'}
                                    </div>
                                    <img 
                                        src={result.confirmationQr} 
                                        alt="QR Code" 
                                        className="w-48 h-48 border border-gray-100 p-2 rounded-xl bg-white shadow-sm"
                                    />
                                    <p className="text-xs text-gray-400 mt-4 text-center">
                                        {language === 'ko' ? '현장 등록데스크에서 이 QR코드를 제시해주세요.' : 'Please present this QR code at the registration desk.'}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setResult(null)}
                                    className="flex-1 h-12 rounded-xl font-bold text-gray-600 border-gray-200"
                                >
                                    {language === 'ko' ? '다시 조회' : 'Check Another'}
                                </Button>
                                <Button 
                                    onClick={() => window.print()}
                                    className="flex-1 h-12 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-bold"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    {language === 'ko' ? '저장/출력' : 'Save/Print'}
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <Button 
                            variant="ghost" 
                            onClick={() => navigate(`/${finalSlug}`)} 
                            className="text-gray-500 hover:text-gray-800 font-medium"
                        >
                            <Home className="w-4 h-4 mr-2" />
                            {language === 'ko' ? '메인 화면으로' : 'Home'}
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={() => navigate(`/${finalSlug}/register`)} 
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-medium"
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            {language === 'ko' ? '신규 등록하기' : 'New Registration'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default CheckStatusPage;
