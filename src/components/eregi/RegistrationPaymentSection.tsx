import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { CheckCircle2, Loader2, CreditCard } from 'lucide-react';
import { PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';
import type { ConferenceOption } from '@/types/schema';

interface RegistrationPaymentSectionProps {
    totalPrice: number;
    basePrice: number;
    optionsTotal: number;
    selectedOptions: Array<{ option: ConferenceOption; quantity: number }>;
    finalCategory: string;
    language: 'ko' | 'en';
    paymentWidget: PaymentWidgetInstance | null;
    paymentMethodsWidgetRef: React.RefObject<HTMLDivElement | null>;
    isProcessing: boolean;
    handlePayment: () => Promise<void>;
}

export default function RegistrationPaymentSection({
    totalPrice,
    basePrice,
    optionsTotal,
    selectedOptions,
    finalCategory,
    language,
    paymentWidget,
    paymentMethodsWidgetRef,
    isProcessing,
    handlePayment,
}: RegistrationPaymentSectionProps) {
    return (
        <Card id="payment-section" className="shadow-lg border-blue-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        2
                    </div>
                    {language === 'ko' ? '결제' : 'Payment'}
                </CardTitle>
                <CardDescription>
                    {language === 'ko' ? '결제를 완료하면 등록이 마무리됩니다.' : 'Complete payment to finish registration.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-xl border">
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <p className="text-sm text-gray-500">Registration Type</p>
                            <p className="font-bold text-lg text-slate-900">{finalCategory}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Base Fee</p>
                            <p className="text-lg font-semibold text-slate-700">{basePrice.toLocaleString()}원</p>
                        </div>
                    </div>

                    {/* Options Details - New List */}
                    {optionsTotal > 0 && (
                        <div className="space-y-2 py-3 border-t border-slate-200 mt-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                {language === 'ko' ? '선택 옵션 상세' : 'Selected Options Breakdown'}
                            </p>
                            {selectedOptions.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-start text-sm">
                                    <div className="flex flex-col">
                                        <span className="text-slate-700 font-medium">
                                            {item.option.name[language] || item.option.name.ko}
                                        </span>
                                        <span className="text-[11px] text-slate-500">
                                            {item.option.price.toLocaleString()}원 x {item.quantity}
                                        </span>
                                    </div>
                                    <span className="font-semibold text-slate-800">
                                        {(item.option.price * item.quantity).toLocaleString()}원
                                    </span>
                                </div>
                            ))}
                            <div className="flex justify-between items-center pt-2 mt-1 border-t border-dashed border-slate-200">
                                <span className="text-xs font-bold text-blue-600">
                                    {language === 'ko' ? '옵션 합계' : 'Options Subtotal'}
                                </span>
                                <span className="text-sm font-bold text-blue-600">
                                    + {optionsTotal.toLocaleString()}원
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Total */}
                <div className="flex justify-between items-center py-3 border-t-2 border-slate-300 mt-2">
                    <div>
                        <p className="text-sm font-medium text-slate-700">{language === 'ko' ? '총 결제 금액' : 'Total Amount'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{totalPrice.toLocaleString()}원</p>
                    </div>
                </div>
            </div>

            {/* Payment Widget Area */}
            <div 
                id="payment-widget" 
                ref={paymentMethodsWidgetRef} 
                className={totalPrice === 0 ? "hidden" : "min-h-[300px]"} 
            />
        </CardContent>
        <CardFooter>
                <Button
                    className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-md"
                    onClick={handlePayment}
                    disabled={isProcessing || (totalPrice > 0 && !paymentWidget)}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            {language === 'ko' ? '처리 중...' : 'Processing...'}
                        </>
                    ) : totalPrice === 0 ? (
                        <>
                            <CheckCircle2 className="w-5 h-5 mr-2" />
                            {language === 'ko' ? '등록 완료' : 'Complete Registration'}
                        </>
                    ) : (
                        <>
                            <CreditCard className="w-5 h-5 mr-2" />
                            {language === 'ko' ? '결제하기' : 'Pay Now'}
                        </>
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
}
