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

    // State for registration data
    const [regData, setRegData] = React.useState<unknown>(null);
    const setLoading = React.useState(true)[1];

    // Determine targetSlug
    const finalSlug = (() => {
        if (conference.slug) return conference.slug;
        if (conference.id) {
            const parts = conference.id.split('_');
            if (parts.length > 1) return parts.slice(1).join('_');
        }
        return 'home';
    })();

    const orderId = searchParams.get('orderId');
    // const userName = searchParams.get('name'); // Use fetched data if available

    // Fetch Registration Data
    React.useEffect(() => {
        const fetchRegistration = async () => {
            if (!conference.id || !orderId) {
                setLoading(false);
                return;
            }

            try {
                // Import firestore dynamically or use from top-level if added
                const { collection, query, where, getDocs } = await import('firebase/firestore');
                const { db } = await import('../firebase');

                const q = query(
                    collection(db, `conferences/${conference.id}/registrations`),
                    where('orderId', '==', orderId)
                );

                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    setRegData(querySnapshot.docs[0].data());
                }
            } catch (error) {
                console.error("Failed to fetch registration:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRegistration();
    }, [conference.id, orderId, setLoading]);
    const handlePrint = () => {
        window.print();
    };

    // const isVirtualAccount = regData?.paymentMethod === 'VIRTUAL_ACCOUNT' || regData?.virtualAccount;
    const isPending = regData?.status === 'PENDING_PAYMENT' || regData?.paymentStatus === 'WAITING_FOR_DEPOSIT' || searchParams.get('status') === 'virtual_account';

    const userName = regData?.name || regData?.userInfo?.name || searchParams.get('name') || 'Guest';

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#f0f5fa] via-[#dbeafe] to-[#d1fae5]">
            <Card className="w-full max-w-2xl shadow-2xl bg-white border border-gray-100 rounded-[32px] overflow-hidden animate-in fade-in zoom-in duration-500 relative">
                {/* Top Decor */}
                <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${isPending ? 'from-orange-400 to-red-500' : 'from-[#003366] to-[#24669e]'}`}></div>

                <CardHeader className="text-center pb-2 pt-12 px-8 md:px-12">
                    <div className="relative mx-auto w-24 h-24 mb-8">
                        {/* Pulse Effect */}
                        <div className={`absolute inset-0 rounded-full animate-ping opacity-30 ${isPending ? 'bg-orange-200' : 'bg-[#d1fae5]'}`}></div>
                        <div className={`relative w-full h-full rounded-full flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300 ${isPending ? 'bg-orange-100' : 'bg-[#d1fae5]'}`}>
                            {isPending ? (
                                <FileText className="w-12 h-12 text-orange-600" />
                            ) : (
                                <CheckCircle2 className="w-12 h-12 text-[#065f46]" />
                            )}
                        </div>
                    </div>

                    <CardTitle className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                        {isPending
                            ? (language === 'ko' ? '가상계좌 발급이 완료되었습니다' : 'Virtual Account Issued')
                            : (language === 'ko' ? '등록이 완료되었습니다!' : 'Registration Completed!')
                        }
                    </CardTitle>
                    <p className="text-lg text-gray-600 leading-relaxed max-w-lg mx-auto">
                        {isPending
                            ? (language === 'ko' ? '아래 계좌로 입금을 완료해주시면 등록이 확정됩니다.' : 'Please transfer to the account below to complete your registration.')
                            : (language === 'ko' ? '학회 등록 및 결제가 성공적으로 처리되었습니다.' : 'Your registration and payment have been successfully processed.')
                        }
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
                                <span className="font-bold text-gray-900 text-base md:text-lg">{userName}</span>
                            </div>

                            {/* Virtual Account Info */}
                            {isPending && regData?.virtualAccount && (
                                <div className="mt-4 bg-white p-4 rounded-xl border border-orange-200 shadow-sm">
                                    <h3 className="text-lg font-bold text-orange-800 mb-3 border-b border-orange-100 pb-2">
                                        {language === 'ko' ? '입금 계좌 정보' : 'Deposit Information'}
                                    </h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">{language === 'ko' ? '은행' : 'Bank'}</span>
                                            <span className="font-bold">{regData.virtualAccount.bank}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">{language === 'ko' ? '계좌번호' : 'Account Number'}</span>
                                            <span className="font-bold text-lg text-blue-600">{regData.virtualAccount.accountNumber}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">{language === 'ko' ? '예금주' : 'Account Holder'}</span>
                                            <span className="font-medium">{regData.virtualAccount.customerName || 'Toss Payments'}</span>
                                        </div>
                                        {regData.virtualAccount.dueDate && (
                                            <div className="flex justify-between text-red-500">
                                                <span className="font-medium">{language === 'ko' ? '입금기한' : 'Due Date'}</span>
                                                <span className="font-bold">
                                                    {new Date(regData.virtualAccount.dueDate).toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!isPending && (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium text-sm md:text-base">Date</span>
                                    <span className="font-medium text-gray-900 text-base md:text-lg">{new Date().toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {!isPending && (
                            <Button
                                onClick={handlePrint}
                                className="bg-[#003366] hover:bg-[#002244] h-14 text-lg font-bold rounded-2xl shadow-lg shadow-blue-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all text-white"
                            >
                                <Download className="w-5 h-5 mr-2" />
                                {language === 'ko' ? '접수증 출력' : 'Print Receipt'}
                            </Button>
                        )}

                        {isPending && (
                            <Button
                                variant="outline"
                                onClick={handlePrint}
                                className="h-14 border-2 border-gray-200 bg-white text-gray-700 font-bold rounded-2xl text-lg transition-all"
                            >
                                <Download className="w-5 h-5 mr-2" />
                                {language === 'ko' ? '정보 저장/출력' : 'Save Info'}
                            </Button>
                        )}

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
