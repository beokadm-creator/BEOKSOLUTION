import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface InfraSettings {
    payment: {
        domestic: {
            secretKey: string;
        };
    };
}

const PaymentSuccessHandler: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        const processPayment = async () => {
            const paymentKey = searchParams.get('paymentKey');
            const orderId = searchParams.get('orderId');
            const amount = Number(searchParams.get('amount'));

            // Context Params passed from RegistrationPage
            const slug = searchParams.get('slug');
            const societyId = searchParams.get('societyId');
            const confId = searchParams.get('confId');
            const regId = searchParams.get('regId');
            const userDataStr = searchParams.get('userData');

            if (!paymentKey || !orderId || !amount || !slug || !confId || !regId) {
                console.error("Missing params:", { paymentKey, orderId, amount, slug, confId, regId });
                toast.error("Invalid payment callback parameters.");
                setIsProcessing(false);
                return;
            }

            if (!userDataStr) {
                console.error("Missing userData parameter");
                toast.error("필요한 사용자 정보가 누락되었습니다.");
                setIsProcessing(false);
                return;
            }

            try {
                console.log("Processing Payment Success...", { orderId, amount, confId });

                // Decode user data from URL parameter
                const userData = JSON.parse(decodeURIComponent(userDataStr));

                // 1. FETCH SOCIETY INFRASTRUCTURE SETTINGS FOR PAYMENT KEYS
                let widgetSecretKey = "";
                if (societyId) {
                    try {
                        const infraRef = doc(db, 'societies', societyId, 'settings', 'infrastructure');
                        const infraSnap = await getDoc(infraRef);
                        if (infraSnap.exists()) {
                            const infraData = infraSnap.data() as InfraSettings;
                            widgetSecretKey = infraData.payment?.domestic?.secretKey || "";
                            console.log("Using society-specific payment key");
                        }
                    } catch (infraErr) {
                        console.warn("Failed to fetch infrastructure settings:", infraErr);
                    }
                }

                if (!widgetSecretKey) {
                    console.error("No payment secret key configured for this society");
                    toast.error("결제 설정이 올바르지 않습니다. 관리자에게 문의해주세요.");
                    setIsProcessing(false);
                    return;
                }

                // 2. CALL CLOUD FUNCTION TO CONFIRM PAYMENT AND CREATE REGISTRATION
                // [FIX-20250124-01] CloudFunction handles both payment confirmation and registration creation
                // [FIX-20250124-CORS] Use HTTP POST endpoint with CORS support instead of callable
                // This ensures only paid registrations are stored in the DB
                const functionUrl = 'https://us-central1-eregi-8fc1e.cloudfunctions.net/confirmTossPaymentHttp';
                const response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        paymentKey,
                        orderId,
                        amount,
                        secretKey: widgetSecretKey,
                        regId,
                        confId,
                        userData
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Payment confirmation failed');
                }

                const resData = result;
                if (resData.success) {
                    toast.success("결제가 완료되었습니다!");
                    // Redirect to Success Page
                    // Use pure slug (extract from confId like "kadd_2026spring" -> "2026spring")
                    const pureSlug = confId.includes('_') ? confId.split('_').slice(1).join('_') : confId;
                    window.location.href = `/${pureSlug}/register/success?orderId=${orderId}&name=${encodeURIComponent(userData.name)}`;
                } else {
                    console.error("Payment Confirmation Failed:", resData);
                    toast.error("결제 확인에 실패했습니다. 관리자에게 문의해주세요.");
                    setIsProcessing(false);
                }

            } catch (error: any) {
                console.error("Payment Processing Error:", error);
                toast.error("결제 처리 중 오류가 발생했습니다: " + (error.message || "Unknown error"));
                setIsProcessing(false);
            }
        };

        processPayment();
    }, [searchParams, navigate]);

    if (isProcessing) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <h2 className="text-xl font-semibold text-gray-800">결제 처리 중...</h2>
                <p className="text-gray-500">창을 닫지 마세요.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50">
             <h2 className="text-xl font-bold text-red-600">결제 처리 실패</h2>
             <p>관리자에게 문의해주세요.</p>
        </div>
    );
};

export default PaymentSuccessHandler;
