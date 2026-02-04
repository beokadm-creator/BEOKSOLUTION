import React, { useEffect, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

interface NicePaymentFormProps {
    amount: number;
    buyerName: string;
    buyerEmail: string;
    buyerTel: string;
    goodsName: string;
    mid: string;
    merchantKey: string;
    onSuccess: (result: Record<string, unknown>) => void;
    onFail: (error: string) => void;
}

declare global {
    interface Window {
        goPay: (form: HTMLFormElement) => void;
        nicepaySubmit: () => void;
        nicepayClose: () => void;
    }
}

export default function NicePaymentForm({
    amount,
    buyerName,
    buyerEmail,
    buyerTel,
    goodsName,
    mid,
    merchantKey,
    onSuccess,
    onFail
}: NicePaymentFormProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const [moid] = useState(() => `ORDER_${Date.now()}`);

    useEffect(() => {
        // 1. Load Script
        const script = document.createElement('script');
        script.src = "https://pay.nicepay.co.kr/v1/js/nicepay-3.0.js";
        script.async = true;
        document.body.appendChild(script);

        // 2. Prepare Payment (Get SignData)
        const prepare = async () => {
            try {
                const prepareFn = httpsCallable(functions, 'prepareNicePayment');
                const result = await prepareFn({ amt: amount, mid, key: merchantKey });
                const { ediDate, signData } = result.data as { ediDate: string, signData: string };

                if (formRef.current) {
                    (formRef.current.elements.namedItem('EdiDate') as HTMLInputElement).value = ediDate;
                    (formRef.current.elements.namedItem('SignData') as HTMLInputElement).value = signData;
                    
                    // Auto-open if ready? Or let user click button?
                    // User expects to click "Pay" button in parent. 
                    // But here we might need to expose a trigger.
                    // For now, let's auto-trigger when script loads + data ready?
                    // Better: Let the parent control the trigger, but NicePay requires form submission.
                    // Implementation: We render the form, and when parent says "GO", we call goPay(form).
                    // Actually, the parent "Pay" button calls `handlePayment` which should trigger this.
                    // BUT: Since we are inside a component, maybe we can expose a ref or just trigger immediately if mounted?
                    // Let's assume this component is mounted ONLY when payment is requested.
                    // So trigger immediately after data is ready.
                    
                    if (window.goPay) {
                        window.goPay(formRef.current);
                    } else {
                        script.onload = () => {
                            window.goPay(formRef.current!);
                        };
                    }
                }
            } catch (error) {
                console.error("NicePay Prepare Error:", error);
                onFail("Payment preparation failed.");
            }
        };

        prepare();

        // 3. Define Callback
        window.nicepaySubmit = () => {
            if (formRef.current) {
                const result = {
                    AuthResultCode: (formRef.current.elements.namedItem('AuthResultCode') as HTMLInputElement).value,
                    AuthResultMsg: (formRef.current.elements.namedItem('AuthResultMsg') as HTMLInputElement).value,
                    TxTid: (formRef.current.elements.namedItem('TxTid') as HTMLInputElement).value,
                    AuthToken: (formRef.current.elements.namedItem('AuthToken') as HTMLInputElement).value,
                    PayMethod: (formRef.current.elements.namedItem('PayMethod') as HTMLInputElement).value,
                    Mid: (formRef.current.elements.namedItem('MID') as HTMLInputElement).value,
                    Amt: (formRef.current.elements.namedItem('Amt') as HTMLInputElement).value,
                    NextAppURL: (formRef.current.elements.namedItem('NextAppURL') as HTMLInputElement).value,
                    NetCancelURL: (formRef.current.elements.namedItem('NetCancelURL') as HTMLInputElement).value,
                };
                
                // If success code (usually implicit in submit callback, but check code)
                // Actually nicepaySubmit is called AFTER auth. We need to call "approve" API now.
                // We pass this result to parent onSuccess, which will call `confirmNicePayment`.
                onSuccess(result);
            }
        };

        window.nicepayClose = () => {
            onFail("Payment window closed.");
        };

        return () => {
            // Cleanup
            document.body.removeChild(script);
            // delete window.nicepaySubmit; // Maybe keep it
        };
    }, [amount, merchantKey, mid, onFail, onSuccess]);

    return (
        <div className="hidden">
            <form name="payForm" ref={formRef}>
                <input type="hidden" name="PayMethod" value="CARD" />
                <input type="hidden" name="GoodsName" value={goodsName} />
                <input type="hidden" name="Amt" value={amount} />
                <input type="hidden" name="MID" value={mid} />
                <input type="hidden" name="Moid" value={moid} />
                <input type="hidden" name="BuyerName" value={buyerName} />
                <input type="hidden" name="BuyerEmail" value={buyerEmail} />
                <input type="hidden" name="BuyerTel" value={buyerTel} />
                
                {/* Dynamic Fields */}
                <input type="hidden" name="EdiDate" value="" />
                <input type="hidden" name="SignData" value="" />
                
                {/* Return Fields (Populated by NicePay) */}
                <input type="hidden" name="AuthResultCode" value="" />
                <input type="hidden" name="AuthResultMsg" value="" />
                <input type="hidden" name="TxTid" value="" />
                <input type="hidden" name="AuthToken" value="" />
                <input type="hidden" name="NextAppURL" value="" />
                <input type="hidden" name="NetCancelURL" value="" />
            </form>
        </div>
    );
}
