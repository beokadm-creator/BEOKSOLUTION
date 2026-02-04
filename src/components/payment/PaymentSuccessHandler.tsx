import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        // Prevent double execution using sessionStorage (persists across remounts)
        const processingKey = `payment_processing_${searchParams.get('paymentKey')}`;
        if (sessionStorage.getItem(processingKey)) {
            console.log("Payment already being processed, skipping duplicate call");
            return;
        }
        sessionStorage.setItem(processingKey, 'true');

        const processPayment = async () => {
            const paymentKey = searchParams.get('paymentKey');
            const orderId = searchParams.get('orderId');
            const amount = Number(searchParams.get('amount'));

            // Context Params passed from RegistrationPage
            const slug = searchParams.get('slug');
            const societyId = searchParams.get('societyId');
            const confId = searchParams.get('confId');
            const regId = searchParams.get('regId');

            if (!paymentKey || !orderId || !amount || !slug || !confId || !regId) {
                console.error("Missing params:", { paymentKey, orderId, amount, slug, confId, regId });
                toast.error("Invalid payment callback parameters.");
                setIsProcessing(false);
                return;
            }

            try {
                console.log("Processing Payment Success...", { orderId, amount, confId });

                // Fetch registration data to get user information
                const regDoc = await getDoc(doc(db, 'conferences', confId, 'registrations', regId));
                if (!regDoc.exists()) {
                    console.error("Registration not found:", regId);
                    toast.error("등록 정보를 찾을 수 없습니다.");
                    setIsProcessing(false);
                    return;
                }

                const regData = regDoc.data();

                // Idempotency check: If already PAID, redirect to success page
                if (regData.paymentStatus === 'PAID') {
                    console.log("Registration already paid, redirecting to success page");
                    const pureSlug = confId.includes('_') ? confId.split('_').slice(1).join('_') : confId;
                    const userName = regData.userInfo?.name || regData.name || '';
                    sessionStorage.removeItem(`payment_processing_${paymentKey}`); // Cleanup
                    window.location.href = `/${pureSlug}/register/success?orderId=${orderId}&name=${encodeURIComponent(userName)}`;
                    return;
                }

                const userData = {
                    name: regData.userInfo.name,
                    email: regData.userInfo.email,
                    phone: regData.userInfo.phone,
                    affiliation: regData.userInfo.affiliation,
                    userId: regData.userId || 'GUEST',
                    tier: regData.tier,
                    categoryName: regData.categoryName,
                    licenseNumber: regData.userInfo.licenseNumber || '',
                    // 회원 인증 정보가 있으면 포함하여 Cloud Function으로 전달
                    memberVerificationData: regData.memberVerificationData || null
                };

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
                    sessionStorage.removeItem(`payment_processing_${paymentKey}`); // Cleanup
                    window.location.href = `/${pureSlug}/register/success?orderId=${orderId}&name=${encodeURIComponent(userData.name)}`;
                } else {
                    console.error("Payment Confirmation Failed:", resData);
                    toast.error("결제 확인에 실패했습니다. 관리자에게 문의해주세요.");
                    sessionStorage.removeItem(`payment_processing_${paymentKey}`); // Cleanup
                    setIsProcessing(false);
                }

            } catch (error: unknown) {
                console.error("Payment Processing Error:", error);
                toast.error("결제 처리 중 오류가 발생했습니다: " + (error instanceof Error ? error.message : "Unknown error"));
                sessionStorage.removeItem(`payment_processing_${paymentKey}`); // Cleanup
                setIsProcessing(false);
            }
        };

        processPayment();
    }, [searchParams]);

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
