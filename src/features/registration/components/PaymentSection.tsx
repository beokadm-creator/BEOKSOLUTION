import { Loader2, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PaymentSectionProps {
    language: 'ko' | 'en';
    isInfoSaved: boolean;
    finalCategory: string;
    basePrice: number;
    optionsTotal: number;
    selectedOptions: any[];
    totalPrice: number;
    paymentMethodsWidgetRef: React.RefObject<HTMLDivElement | null>;
    handlePayment: () => void;
    isProcessing: boolean;
    paymentWidgetReady: boolean;
}

export function PaymentSection({
    language,
    isInfoSaved,
    finalCategory,
    basePrice,
    optionsTotal,
    selectedOptions,
    totalPrice,
    paymentMethodsWidgetRef,
    handlePayment,
    isProcessing,
    paymentWidgetReady
}: PaymentSectionProps) {
    if (!isInfoSaved) return null;

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

                    <div className="flex justify-between items-center py-3 border-t-2 border-slate-300 mt-2">
                        <div>
                            <p className="text-sm font-medium text-slate-700">{language === 'ko' ? '총 결제 금액' : 'Total Amount'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-blue-600">{totalPrice.toLocaleString()}원</p>
                        </div>
                    </div>
                </div>

                <div id="payment-widget" ref={paymentMethodsWidgetRef as React.RefObject<HTMLDivElement>} className="min-h-[300px]" />
            </CardContent>
            <CardFooter>
                <Button
                    className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-md"
                    onClick={handlePayment}
                    disabled={isProcessing || !paymentWidgetReady}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            {language === 'ko' ? '결제 진행 중...' : 'Processing...'}
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
