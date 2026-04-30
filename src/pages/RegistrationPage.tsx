import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { WideFooterPreview } from '@/components/conference/wide-preview/WideFooterPreview';
import { useRegistrationPage } from '@/hooks/useRegistrationPage';
import { AddonSelector } from '@/components/eregi/AddonSelector';
import RegistrationForm from '@/components/eregi/RegistrationForm';
import RegistrationPaymentSection from '@/components/eregi/RegistrationPaymentSection';
import RegistrationRefundModal from '@/components/eregi/RegistrationRefundModal';
import type { ConferenceOption, ConferenceCtaButton } from '@/types/schema';

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
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();

    const {
        confLoading,
        isInitializing,
        isProcessing,
        confId,
        info,
        language,
        setLanguage,
        auth,
        formData,
        setFormData,
        fieldSettings,
        isInfoSaved,
        setIsInfoSaved,
        toggleOption,
        isOptionSelected,
        basePrice,
        totalPrice,
        optionsTotal,
        selectedOptions,
        finalCategory,
        paymentWidget,
        paymentMethodsWidgetRef,
        footerInfo,
        societyName,
        showRefundModal,
        setShowRefundModal,
        memberVerified,
        paramMemberCode,
        lockNameField,
        handleLoginAndLoad,
        handleSaveBasicInfo,
        handlePayment,
        regSettings,
        ctaButtons,
    } = useRegistrationPage(slug);

    if (confLoading || isInitializing) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><LoadingSpinner /></div>;
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <header className="bg-white shadow-sm py-4 px-6 flex justify-between items-center sticky top-0 z-10">
                <div className="font-bold text-xl text-blue-900">{info?.societyId?.toUpperCase() || 'Academic Society'}</div>
                <button
                    type="button"
                    onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
                    className="px-3 py-1 rounded text-sm font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                >
                    {language === 'ko' ? 'EN' : 'KO'}
                </button>
            </header>

            <main className={`flex-grow py-12 px-4 sm:px-6 lg:px-8 ${ctaButtons?.some(b => b.enabled) ? 'pb-32' : ''}`}>
                {isProcessing && (
                    <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex items-center justify-center">
                        <LoadingSpinner />
                    </div>
                )}

                <div className="max-w-3xl mx-auto space-y-8">
                    <div>
                        <Button variant="ghost" className="pl-0 mb-4" onClick={() => navigate(`/${slug}`)}>
                            <ChevronLeft className="w-5 h-5 mr-1" />
                            {language === 'ko' ? '\uD648\uC73C\uB85C' : 'Home'}
                        </Button>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {language === 'ko' ? societyName + ' \uB4F1\uB85D \uD398\uC774\uC9C0' : societyName + ' Conference Registration Page'}
                        </h1>
                        <p className="mt-2 text-gray-600">
                            {info?.title ? (language === 'ko' ? info.title.ko : info.title.en) : 'Conference'}
                        </p>
                    </div>

                    <RegistrationForm
                        formData={formData}
                        setFormData={setFormData}
                        fieldSettings={fieldSettings}
                        language={language}
                        auth={auth}
                        isInfoSaved={isInfoSaved}
                        setIsInfoSaved={setIsInfoSaved}
                        isProcessing={isProcessing}
                        memberVerified={memberVerified}
                        paramMemberCode={paramMemberCode}
                        lockNameField={lockNameField}
                        showLoadExistingInfo={regSettings?.paymentMode !== 'FREE_ALL'}
                        handleLoginAndLoad={handleLoginAndLoad}
                        handleSaveBasicInfo={handleSaveBasicInfo}
                    />

                    {confId && (
                        <AddonSelectorWrapper
                            conferenceId={confId}
                            language={language}
                            toggleOption={toggleOption}
                            isOptionSelected={isOptionSelected}
                        />
                    )}

                    {isInfoSaved && (
                        <RegistrationPaymentSection
                            totalPrice={totalPrice}
                            basePrice={basePrice}
                            optionsTotal={optionsTotal}
                            selectedOptions={selectedOptions}
                            finalCategory={finalCategory}
                            language={language}
                            paymentWidget={paymentWidget}
                            paymentMethodsWidgetRef={paymentMethodsWidgetRef}
                            isProcessing={isProcessing}
                            handlePayment={handlePayment}
                        />
                    )}
                </div>
            </main>

            <WideFooterPreview
                society={footerInfo ? {
                    name: societyName || info?.societyId,
                    footerInfo
                } : undefined}
                language={language}
            />

            <RegistrationRefundModal
                showRefundModal={showRefundModal}
                setShowRefundModal={setShowRefundModal}
                refundPolicy={regSettings?.refundPolicy}
                language={language}
                hasBottomBar={ctaButtons?.some(b => b.enabled) || false}
            />

            {Array.isArray(ctaButtons) && ctaButtons.filter(b => b.enabled && b.actionValue && (b.label?.ko || b.label?.en)).length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg z-40 safe-area-inset-bottom">
                    <div className="max-w-3xl mx-auto px-4 py-3 flex justify-end gap-2">
                        {ctaButtons
                            .filter(b => b.enabled && b.actionValue && (b.label?.ko || b.label?.en))
                            .slice(0, 2)
                            .map((btn: ConferenceCtaButton, idx: number) => {
                                const label = (language === 'en' ? btn.label.en : btn.label.ko) || btn.label.ko || btn.label.en || '';
                                const handleClick = () => {
                                    if (btn.actionType === 'SCROLL_SECTION') {
                                        const el = document.getElementById(btn.actionValue) || document.getElementById(`section-${btn.actionValue}`);
                                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        return;
                                    }
                                    if (btn.actionType === 'INTERNAL_ROUTE') {
                                        navigate(btn.actionValue);
                                        return;
                                    }
                                    const url = btn.actionValue;
                                    if (!/^https?:\/\//i.test(url)) return;
                                    if (btn.openInNewTab !== false) window.open(url, '_blank', 'noopener,noreferrer');
                                    else window.location.assign(url);
                                };

                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={handleClick}
                                        className={`h-10 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${btn.variant === 'secondary'
                                            ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
}
