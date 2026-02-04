import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { ShieldCheck, FileText } from 'lucide-react';

interface LegalAgreementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAgree: () => void;
    lang?: 'ko' | 'en';
    terms?: {
        infoConsentText?: string;
        infoConsentText_en?: string;
        marketingConsentText?: string;
        marketingConsentText_en?: string;
        privacyPolicy?: string;
        privacyPolicy_en?: string;
        refundPolicy?: string;
        refundPolicy_en?: string;
        termsOfService?: string;
        termsOfService_en?: string;
        thirdPartyConsent?: string;
        thirdPartyConsent_en?: string;
    };
}

export default function LegalAgreementModal({
    isOpen,
    onClose,
    onAgree,
    lang = 'ko',
    terms
}: LegalAgreementModalProps) {
    const [agreements, setAgreements] = React.useState({
        termsOfService: false,
        thirdPartySystem: false,
        thirdPartyPG: false,
        infoConsent: false,
        marketingConsent: false,
        refundPolicy: false
    });

    const [viewingTerm, setViewingTerm] = React.useState<{ title: string; content: string } | null>(null);
    const [viewAllTerms, setViewAllTerms] = React.useState(false);

    // Use Firestore terms only - no hardcoded fallback
    const termsContent = terms ? {
        termsOfService: lang === 'ko' ? (terms.termsOfService || terms.termsOfService_en || '') : (terms.termsOfService_en || terms.termsOfService || ''),
        thirdPartySystem: lang === 'ko' ? (terms.thirdPartyConsent || terms.thirdPartyConsent_en || '') : (terms.thirdPartyConsent_en || terms.thirdPartyConsent || ''),
        thirdPartyPG: lang === 'ko' ? (terms.privacyPolicy || terms.privacyPolicy_en || '') : (terms.privacyPolicy_en || terms.privacyPolicy || ''),
        infoConsent: lang === 'ko' ? (terms.infoConsentText || terms.infoConsentText_en || '') : (terms.infoConsentText_en || terms.infoConsentText || ''),
        marketingConsent: lang === 'ko' ? (terms.marketingConsentText || terms.marketingConsentText_en || '') : (terms.marketingConsentText_en || terms.marketingConsentText || ''),
        refundPolicy: lang === 'ko' ? (terms.refundPolicy || terms.refundPolicy_en || '') : (terms.refundPolicy_en || terms.refundPolicy || '')
    } : {
        termsOfService: '',
        thirdPartySystem: '',
        thirdPartyPG: '',
        infoConsent: '',
        marketingConsent: '',
        refundPolicy: ''
    };

    // Required agreements: termsOfService, thirdPartySystem, thirdPartyPG (always shown)
    // Conditional requirements: infoConsent, refundPolicy (only if content exists)
    // Optional: marketingConsent
    const requiredAgreed = agreements.termsOfService &&
                             agreements.thirdPartySystem &&
                             agreements.thirdPartyPG &&
                             (!termsContent.infoConsent || agreements.infoConsent) &&
                             (!termsContent.refundPolicy || agreements.refundPolicy);
    const canProceed = requiredAgreed;

    // Check if any terms exist
    const hasAnyTerms =
        termsContent.termsOfService ||
        termsContent.thirdPartySystem ||
        termsContent.thirdPartyPG ||
        termsContent.infoConsent ||
        termsContent.refundPolicy ||
        termsContent.marketingConsent;

    const handleAgree = () => {
        if (!canProceed) return;
        onAgree();
    };

    const handleAllAgree = (checked: boolean) => {
        setAgreements({
            termsOfService: checked,
            thirdPartySystem: checked,
            thirdPartyPG: checked,
            infoConsent: checked,
            marketingConsent: checked,
            refundPolicy: checked
        });
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:p-0">
                    <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
                            <div>
                                <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-900">
                                    {lang === 'ko' ? '이용약관 동의' : 'Terms Agreement'}
                                </DialogTitle>
                                <DialogDescription className="text-xs sm:text-sm">
                                    {lang === 'ko'
                                        ? '학술대회 등록을 위한 필수 약관에 동의해 주세요.'
                                        : 'Please agree to all required terms for conference registration.'}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 space-y-2 sm:space-y-3 pb-24 md:pb-0">
                        {/* No Terms Error */}
                        {!terms && !hasAnyTerms && (
                            <div className="text-center py-12">
                                <ShieldCheck className="w-16 h-16 mx-auto text-red-500 mb-4" />
                                <h3 className="text-xl font-bold text-red-700 mb-2">
                                    {lang === 'ko' ? '약관 정보를 찾을 수 없습니다' : 'Terms Not Found'}
                                </h3>
                                <p className="text-slate-600 mb-4">
                                    {lang === 'ko'
                                        ? '서버에서 약관 데이터를 불러올 수 없습니다. 관리자에게 문의해주세요.'
                                        : 'Could not load terms data from server. Please contact administrator.'}
                                </p>
                            </div>
                        )}

                        {/* Terms List - Only show if terms exist */}
                        {terms && (
                            <>
                                {/* All Agree Checkbox - Mobile Optimized */}
                                <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-blue-50 rounded-xl border border-blue-200">
                                    <Checkbox
                                        id="allAgree"
                                        checked={Object.values(agreements).every(Boolean)}
                                        onCheckedChange={(checked) => handleAllAgree(checked as boolean)}
                                        className="mt-0.5 sm:mt-1 w-5 h-5 sm:w-4 sm:h-4"
                                    />
                                    <div className="flex-1">
                                        <Label htmlFor="allAgree" className="text-base sm:text-lg font-bold cursor-pointer text-blue-900 block">
                                            {lang === 'ko' ? '모든 약관에 동의합니다' : 'I agree to all terms'}
                                        </Label>
                                        <p className="text-xs sm:text-sm text-blue-700 mt-0.5 sm:mt-1">
                                            {lang === 'ko'
                                                ? '필수 및 선택 정보 수집에 대해 일괄 동의합니다.'
                                                : 'Agree to all required and optional terms.'}
                                        </p>
                                    </div>
                                </div>

                                {/* 1. 개인정보 수집 및 이용 동의 (필수) - Mobile Optimized */}
                                <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <Checkbox
                                        id="termsOfService"
                                        checked={agreements.termsOfService}
                                        onCheckedChange={(checked) => setAgreements(prev => ({ ...prev, termsOfService: checked as boolean }))}
                                        className="mt-0.5 sm:mt-1 w-5 h-5 sm:w-4 sm:h-4"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <Label htmlFor="termsOfService" className="text-sm sm:text-base font-medium cursor-pointer mb-1 sm:mb-2 block pr-6">
                                            <span className="hidden sm:inline">
                                                {lang === 'ko' ? '개인정보 수집 및 이용에 동의합니다 (필수)' : 'Consent to Collection and Use of Personal Information (Required)'}
                                            </span>
                                            <span className="sm:hidden">
                                                {lang === 'ko' ? '개인정보 수집 및 이용 동의 (필수)' : 'Personal Information (Required)'}
                                            </span>
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={() => setViewingTerm({ title: lang === 'ko' ? '개인정보 수집 및 이용 동의' : 'Consent to Collection and Use', content: termsContent.termsOfService })}
                                            className="text-blue-600 text-xs sm:text-sm underline hover:text-blue-700 flex items-center gap-1 flex-shrink-0"
                                        >
                                            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            <span>{lang === 'ko' ? '보기' : 'View'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* 2. 개인정보 제3자 제공 동의 (시스템 이용) (필수) */}
                                <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <Checkbox
                                        id="thirdPartySystem"
                                        checked={agreements.thirdPartySystem}
                                        onCheckedChange={(checked) => setAgreements(prev => ({ ...prev, thirdPartySystem: checked as boolean }))}
                                        className="mt-0.5 sm:mt-1 w-5 h-5 sm:w-4 sm:h-4"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <Label htmlFor="thirdPartySystem" className="text-sm sm:text-base font-medium cursor-pointer mb-1 sm:mb-2 block pr-6">
                                            <span className="hidden sm:inline">
                                                {lang === 'ko' ? '개인정보 제3자 제공 동의 (시스템 이용) (필수)' : 'Consent to Provision of Personal Information to Third Parties (System Use) (Required)'}
                                            </span>
                                            <span className="sm:hidden">
                                                {lang === 'ko' ? '제3자 제공 동의 - 시스템 이용 (필수)' : 'Third Party (System) (Required)'}
                                            </span>
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={() => setViewingTerm({ title: lang === 'ko' ? '개인정보 제3자 제공 (시스템)' : 'Third Party Provision (System Use)', content: termsContent.thirdPartySystem })}
                                            className="text-blue-600 text-xs sm:text-sm underline hover:text-blue-700 flex items-center gap-1 flex-shrink-0"
                                        >
                                            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            <span>{lang === 'ko' ? '보기' : 'View'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* 3. 개인정보 제3자 제공 동의 (결제) (필수) */}
                                <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <Checkbox
                                        id="thirdPartyPG"
                                        checked={agreements.thirdPartyPG}
                                        onCheckedChange={(checked) => setAgreements(prev => ({ ...prev, thirdPartyPG: checked as boolean }))}
                                        className="mt-0.5 sm:mt-1 w-5 h-5 sm:w-4 sm:h-4"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <Label htmlFor="thirdPartyPG" className="text-sm sm:text-base font-medium cursor-pointer mb-1 sm:mb-2 block pr-6">
                                            <span className="hidden sm:inline">
                                                {lang === 'ko' ? '개인정보 제3자 제공 동의 (결제) (필수)' : 'Consent to Provision of Personal Information to Third Parties (Payment) (Required)'}
                                            </span>
                                            <span className="sm:hidden">
                                                {lang === 'ko' ? '제3자 제공 동의 - 결제 (필수)' : 'Third Party (Payment) (Required)'}
                                            </span>
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={() => setViewingTerm({ title: lang === 'ko' ? '개인정보 제3자 제공 (결제)' : 'Third Party Provision (Payment)', content: termsContent.thirdPartyPG })}
                                            className="text-blue-600 text-xs sm:text-sm underline hover:text-blue-700 flex items-center gap-1 flex-shrink-0"
                                        >
                                            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            <span>{lang === 'ko' ? '보기' : 'View'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* 4. 정보성 정보 수신 안내 (필수) */}
                                {termsContent.infoConsent && (
                                    <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <Checkbox
                                            id="infoConsent"
                                            checked={agreements.infoConsent}
                                            onCheckedChange={(checked) => setAgreements(prev => ({ ...prev, infoConsent: checked as boolean }))}
                                            className="mt-0.5 sm:mt-1 w-5 h-5 sm:w-4 sm:h-4"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <Label htmlFor="infoConsent" className="text-sm sm:text-base font-medium cursor-pointer mb-1 sm:mb-2 block pr-6">
                                                <span className="hidden sm:inline">
                                                    {lang === 'ko' ? '정보성 정보 수신 안내에 동의합니다 (필수)' : 'Consent to Receive Informational Notifications (Required)'}
                                                </span>
                                                <span className="sm:hidden">
                                                    {lang === 'ko' ? '정보성 정보 수신 안내 (필수)' : 'Informational Notifications (Required)'}
                                                </span>
                                            </Label>
                                            <button
                                                type="button"
                                                onClick={() => setViewingTerm({ title: lang === 'ko' ? '정보성 정보 수신 안내' : 'Informational Notifications', content: termsContent.infoConsent })}
                                                className="text-blue-600 text-xs sm:text-sm underline hover:text-blue-700 flex items-center gap-1 flex-shrink-0"
                                            >
                                                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                <span>{lang === 'ko' ? '보기' : 'View'}</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 5. 환불 규정 (필수) */}
                                {termsContent.refundPolicy && (
                                    <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <Checkbox
                                            id="refundPolicy"
                                            checked={agreements.refundPolicy}
                                            onCheckedChange={(checked) => setAgreements(prev => ({ ...prev, refundPolicy: checked as boolean }))}
                                            className="mt-0.5 sm:mt-1 w-5 h-5 sm:w-4 sm:h-4"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <Label htmlFor="refundPolicy" className="text-sm sm:text-base font-medium cursor-pointer mb-1 sm:mb-2 block pr-6">
                                                <span className="hidden sm:inline">
                                                    {lang === 'ko' ? '대한디지털치의학회 학술대회 환불 규정에 동의합니다 (필수)' : 'Consent to Refund Policy (Required)'}
                                                </span>
                                                <span className="sm:hidden">
                                                    {lang === 'ko' ? '환불 규정 동의 (필수)' : 'Refund Policy (Required)'}
                                                </span>
                                            </Label>
                                            <button
                                                type="button"
                                                onClick={() => setViewingTerm({ title: lang === 'ko' ? '환불 규정' : 'Refund Policy', content: termsContent.refundPolicy })}
                                                className="text-blue-600 text-xs sm:text-sm underline hover:text-blue-700 flex items-center gap-1 flex-shrink-0"
                                            >
                                                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                <span>{lang === 'ko' ? '보기' : 'View'}</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 6. 마케팅 활용 (선택) */}
                                {termsContent.marketingConsent && (
                                    <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-amber-50 rounded-xl border border-amber-200">
                                        <Checkbox
                                            id="marketingConsent"
                                            checked={agreements.marketingConsent}
                                            onCheckedChange={(checked) => setAgreements(prev => ({ ...prev, marketingConsent: checked as boolean }))}
                                            className="mt-0.5 sm:mt-1 w-5 h-5 sm:w-4 sm:h-4"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <Label htmlFor="marketingConsent" className="text-sm sm:text-base font-medium cursor-pointer mb-1 sm:mb-2 block pr-6 text-amber-900">
                                                <span className="hidden sm:inline">
                                                    {lang === 'ko' ? '마케팅 활용 및 광고성 정보 수신에 동의합니다 (선택)' : 'Marketing Consent (Optional)'}
                                                </span>
                                                <span className="sm:hidden">
                                                    {lang === 'ko' ? '마케팅 활용 동의 (선택)' : 'Marketing (Optional)'}
                                                </span>
                                            </Label>
                                            <button
                                                type="button"
                                                onClick={() => setViewingTerm({ title: lang === 'ko' ? '마케팅 활용' : 'Marketing Consent', content: termsContent.marketingConsent })}
                                                className="text-blue-600 text-xs sm:text-sm underline hover:text-blue-700 flex items-center gap-1 flex-shrink-0"
                                            >
                                                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                <span>{lang === 'ko' ? '보기' : 'View'}</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer Buttons - Mobile Fixed Bottom */}
                    {terms && (
                        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-6 border-t bg-white shadow-lg md:shadow-none md:static md:bg-slate-50 flex flex-col gap-2 sm:gap-3 z-10">
                            <div className="hidden md:block text-sm text-slate-500">
                                <p>
                                    {lang === 'ko'
                                        ? '* 모든 필수 약관에 동의해야 다음 단계로 진행할 수 있습니다.'
                                        : '* You must agree to all required terms to proceed.'}
                                </p>
                                <p className="text-amber-600">
                                    {lang === 'ko'
                                        ? '* 마케팅 동의(선택)는 체크하지 않아도 등록이 가능합니다.'
                                        : '* Marketing consent (optional) can be unchecked.'}
                                </p>
                            </div>
                            <div className="flex gap-2 sm:gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setViewAllTerms(true)}
                                    disabled={!terms}
                                    className="flex-1 sm:flex-none px-3 sm:px-6 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FileText className="w-4 h-4 mr-1 sm:mr-2" />
                                    <span className="hidden sm:inline">{lang === 'ko' ? '전체 약관 보기' : 'View All Terms'}</span>
                                    <span className="sm:hidden">{lang === 'ko' ? '전체보기' : 'View All'}</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onClose}
                                    className="flex-1 sm:flex-none px-3 sm:px-6 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px]"
                                >
                                    {lang === 'ko' ? '취소' : 'Cancel'}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleAgree}
                                    disabled={!canProceed}
                                    className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-8 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                                >
                                    {lang === 'ko' ? '약관동의' : 'Agree'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Individual Term Viewer Modal - Nested Dialog */}
            <Dialog open={!!viewingTerm} onOpenChange={(open) => !open && setViewingTerm(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-4 sm:p-6 border-b">
                        <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 text-left">
                            {viewingTerm?.title}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-4 sm:p-8 overflow-y-auto flex-1 text-slate-700 leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                        {viewingTerm?.content || (lang === 'ko' ? '내용이 없습니다.' : 'No content available.')}
                    </div>
                    <div className="p-3 sm:p-4 border-t text-right bg-slate-50">
                        <Button
                            type="button"
                            onClick={() => setViewingTerm(null)}
                            className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px] px-6 sm:px-8"
                        >
                            {lang === 'ko' ? '닫기' : 'Close'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* All Terms Viewer Modal - Nested Dialog */}
            <Dialog open={viewAllTerms} onOpenChange={setViewAllTerms}>
                <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-4 sm:p-6 border-b">
                        <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 text-left">
                            {lang === 'ko' ? '전체 약관' : 'All Terms'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-4 sm:p-8 overflow-y-auto flex-1 text-slate-700 leading-relaxed space-y-4 sm:space-y-6 text-sm sm:text-base">
                        {!terms && (
                            <div className="text-center py-12 text-slate-500">
                                {lang === 'ko'
                                    ? '약관 정보를 찾을 수 없습니다.'
                                    : 'Terms information not found.'}
                            </div>
                        )}

                        {/* 1. 개인정보 수집 및 이용 동의 */}
                        {terms && termsContent.termsOfService && (
                            <div>
                                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3 text-slate-900">1. {termsContent.termsOfService.split('\n')[0]}</h3>
                                <div className="whitespace-pre-wrap text-xs sm:text-sm">{termsContent.termsOfService}</div>
                            </div>
                        )}

                        {/* 2. 개인정보 제3자 제공 동의 (시스템 이용) */}
                        {terms && termsContent.thirdPartySystem && (
                            <div>
                                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3 text-slate-900">2. {termsContent.thirdPartySystem.split('\n')[0]}</h3>
                                <div className="whitespace-pre-wrap text-xs sm:text-sm">{termsContent.thirdPartySystem}</div>
                            </div>
                        )}

                        {/* 3. 개인정보 제3자 제공 동의 (결제) */}
                        {terms && termsContent.thirdPartyPG && (
                            <div>
                                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3 text-slate-900">3. {termsContent.thirdPartyPG.split('\n')[0]}</h3>
                                <div className="whitespace-pre-wrap text-xs sm:text-sm">{termsContent.thirdPartyPG}</div>
                            </div>
                        )}

                        {/* 4. 정보성 정보 수신 안내 */}
                        {terms && termsContent.infoConsent && (
                            <div>
                                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3 text-slate-900">4. {termsContent.infoConsent.split('\n')[0]}</h3>
                                <div className="whitespace-pre-wrap text-xs sm:text-sm">{termsContent.infoConsent}</div>
                            </div>
                        )}

                        {/* 5. 환불 규정 */}
                        {terms && termsContent.refundPolicy && (
                            <div>
                                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3 text-slate-900">5. {termsContent.refundPolicy.split('\n')[0]}</h3>
                                <div className="whitespace-pre-wrap text-xs sm:text-sm">{termsContent.refundPolicy}</div>
                            </div>
                        )}

                        {/* 6. 마케팅 활용 (선택) */}
                        {terms && termsContent.marketingConsent && (
                            <div>
                                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3 text-slate-900">6. {termsContent.marketingConsent.split('\n')[0]}</h3>
                                <div className="whitespace-pre-wrap text-xs sm:text-sm">{termsContent.marketingConsent}</div>
                            </div>
                        )}
                    </div>
                    <div className="p-3 sm:p-4 border-t text-right bg-slate-50">
                        <Button
                            type="button"
                            onClick={() => setViewAllTerms(false)}
                            className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px] px-6 sm:px-8"
                        >
                            {lang === 'ko' ? '닫기' : 'Close'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
