import React from 'react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { WideFooterPreview } from '@/components/conference/wide-preview/WideFooterPreview';
import { AddonSelector } from '@/components/eregi/AddonSelector';
import type { ConferenceOption } from '@/types/schema';
import { useRegistrationState } from '@/features/registration/hooks/useRegistrationState';
import { RegistrationHeader } from '@/features/registration/components/RegistrationHeader';
import { BasicInfoForm } from '@/features/registration/components/BasicInfoForm';
import { PaymentSection } from '@/features/registration/components/PaymentSection';
import { RefundPolicyModal } from '@/features/registration/components/RefundPolicyModal';

function AddonSelectorWrapper({
    conferenceId,
    language,
    toggleOption,
    isOptionSelected,
}: {
    conferenceId: string;
    language: 'ko' | 'en';
    toggleOption: (option: ConferenceOption) => void;
    isOptionSelected: (optionId: string) => boolean;
}) {
    const addonsEnabled = true;

    const isDev = window.location.hostname.includes('--dev-') ||
        window.location.hostname === 'localhost' ||
        new URLSearchParams(window.location.search).get('debug_addons') === 'true';

    if (!addonsEnabled && !isDev) {
        return null;
    }

    return (
        <AddonSelector
            conferenceId={conferenceId}
            language={language}
            toggleOption={toggleOption}
            isOptionSelected={isOptionSelected}
        />
    );
}

export default function RegistrationPage() {
    const state = useRegistrationState();

    if (state.confLoading || state.isInitializing) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><LoadingSpinner /></div>;
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <RegistrationHeader
                societyId={state.info?.societyId}
                societyName={state.societyName}
                language={state.language}
                setLanguage={state.setLanguage}
                info={state.info}
                slug={state.slug}
                navigate={state.navigate}
            />

            <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 relative">
                {state.isProcessing && (
                    <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex items-center justify-center">
                        <LoadingSpinner />
                    </div>
                )}

                <div className="max-w-3xl mx-auto space-y-8">
                    <BasicInfoForm
                        language={state.language}
                        formData={state.formData}
                        setFormData={state.setFormData}
                        isInfoSaved={state.isInfoSaved}
                        setIsInfoSaved={state.setIsInfoSaved}
                        memberVerified={state.memberVerified}
                        paramMemberCode={state.paramMemberCode}
                        auth={state.auth}
                        isProcessing={state.isProcessing}
                        handleLoginAndLoad={state.handleLoginAndLoad}
                        handleSaveBasicInfo={state.handleSaveBasicInfo}
                    />

                    {state.confId && (
                        <AddonSelectorWrapper
                            conferenceId={state.confId}
                            language={state.language}
                            toggleOption={state.pricing.toggleOption}
                            isOptionSelected={state.pricing.isOptionSelected}
                        />
                    )}

                    <PaymentSection
                        language={state.language}
                        isInfoSaved={state.isInfoSaved}
                        finalCategory={state.finalCategory}
                        basePrice={state.pricing.basePrice}
                        optionsTotal={state.pricing.optionsTotal}
                        selectedOptions={state.pricing.selectedOptions}
                        totalPrice={state.pricing.totalPrice}
                        paymentMethodsWidgetRef={state.paymentMethodsWidgetRef}
                        handlePayment={state.handlePayment}
                        isProcessing={state.isProcessing}
                        paymentWidgetReady={!!state.paymentWidget}
                    />
                </div>
            </main>

            <WideFooterPreview
                society={state.footerInfo ? {
                    name: state.societyName || state.info?.societyId || '',
                    footerInfo: state.footerInfo
                } : undefined}
                language={state.language}
            />

            <RefundPolicyModal
                language={state.language}
                showRefundModal={state.showRefundModal}
                setShowRefundModal={state.setShowRefundModal}
                regSettings={state.regSettings}
                info={state.info}
            />
        </div>
    );
}
