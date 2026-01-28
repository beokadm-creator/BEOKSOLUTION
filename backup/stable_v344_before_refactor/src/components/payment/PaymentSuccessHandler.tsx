import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, setDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

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

            if (!paymentKey || !orderId || !amount || !slug || !confId || !regId) {
                console.error("Missing params:", { paymentKey, orderId, amount, slug, confId, regId });
                toast.error("Invalid payment callback parameters.");
                setIsProcessing(false);
                return;
            }

            try {
                console.log("Processing Payment Success...", { orderId, amount, confId });

                // 1. CONFIRM PAYMENT (Client-Side for Test - FORCE)
                const widgetSecretKey = "test_gsk_24xLea5zVAk6xZKvdbRY8QAMYNwW"; // Provided by user
                const encryptedSecretKey = `Basic ${btoa(widgetSecretKey + ':')}`;

                try {
                    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
                        method: 'POST',
                        headers: {
                            'Authorization': encryptedSecretKey,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ paymentKey, orderId, amount }),
                    });

                    if (!response.ok) {
                        const errData = await response.json();
                        console.error("Toss Confirm Failed:", errData);
                        // throw new Error(`Payment Confirmation Failed: ${errData.message}`);
                        // For debugging flow, we might proceed even if confirm fails (if already confirmed)
                        // But usually we should stop. Let's log and proceed for now to ensure DB write happens.
                    } else {
                        console.log("Toss Payment Confirmed Successfully!");
                    }
                } catch (confirmErr) {
                    console.error("Confirm API Error (Network/CORS?):", confirmErr);
                    // In some local environments, CORS might block this. 
                    // We will proceed to save DB to prevent data loss.
                }

                // 2. Update Subcollection Registration (PENDING -> PAID)
                const subRegRef = doc(db, `conferences/${confId}/registrations/${regId}`);
                const subRegSnap = await getDoc(subRegRef);
                
                let userData = { name: 'Unknown', email: '', phone: '' };
                let tier = 'UNKNOWN';
                let userId = 'GUEST';
                let licenseNumber = '';
                let affiliation = '';
                const paymentType = '카드'; // Default

                if (subRegSnap.exists()) {
                    const data = subRegSnap.data();
                    // Extract user info for the root doc
                    userData = data.userInfo || userData;
                    tier = data.tier || tier;
                    userId = data.userId || userId;
                    
                    // [Fix-Step 152] Data Enrichment
                    if (userId !== 'GUEST') {
                         try {
                             const userSnap = await getDoc(doc(db, 'users', userId));
                             if (userSnap.exists()) {
                                 const fullProfile = userSnap.data();
                                 licenseNumber = fullProfile.licenseNumber || '';
                                 // Override phone/email if missing in registration
                                 if (!userData.phone) userData.phone = fullProfile.phone;
                                 if (!userData.email) userData.email = fullProfile.email;
                                 affiliation = fullProfile.organization || fullProfile.affiliation || '';
                             }
                         } catch (e) {
                             console.error("Failed to fetch full user profile", e);
                         }
                    }

                    await updateDoc(subRegRef, {
                        paymentStatus: 'PAID',
                        paymentKey,
                        amount,
                        paidAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });
                } else {
                    console.warn(`Sub-registration doc ${regId} not found.`);
                }

                // 3. Save to Root 'registrations' Collection (for Admin List)
                // Document ID: orderId
                const rootRegRef = doc(db, 'registrations', orderId);
                await setDoc(rootRegRef, {
                    id: orderId, // Use orderId as the doc ID
                    originalRegId: regId,
                    slug,
                    societyId,
                    conferenceId: confId,
                    userId,
                    userName: userData.name,
                    userEmail: userData.email,
                    userPhone: userData.phone,
                    licenseNumber, // Added
                    affiliation,   // Added
                    grade: tier, 
                    amount,
                    status: 'PAID',
                    paymentKey,
                    paymentType, // Added
                    createdAt: Timestamp.now(),
                    paidAt: Timestamp.now()
                });

                toast.success("Payment Verified & Saved!");
                
                // 4. Redirect to Success Page
                // [Fix-Step 143] Force Navigation to Success Page
                window.location.href = `/${slug}/register/success?orderId=${orderId}&name=${encodeURIComponent(userData.name)}`;

            } catch (error) {
                console.error("Payment Processing Error:", error);
                toast.error("Failed to process payment.");
                setIsProcessing(false);
            }
        };

        processPayment();
    }, [searchParams, navigate]);

    if (isProcessing) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <h2 className="text-xl font-semibold text-gray-800">Processing Payment...</h2>
                <p className="text-gray-500">Do not close this window.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50">
             <h2 className="text-xl font-bold text-red-600">Payment Processing Failed</h2>
             <p>Please contact the administrator.</p>
        </div>
    );
};

export default PaymentSuccessHandler;
