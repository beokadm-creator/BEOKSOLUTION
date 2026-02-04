import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { FileText, CheckCircle2 } from 'lucide-react';

interface TermItem {
  key: string;
  labelKo: string;
  labelEn: string;
  required: boolean;
}

interface TermsAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
  lang?: 'ko' | 'en';
  isLoading?: boolean;
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

const TERMS_LIST: TermItem[] = [
  { key: 'termsOfService', labelKo: '이용약관 동의 (필수)', labelEn: 'Terms of Service (Required)', required: true },
  { key: 'privacyPolicy', labelKo: '개인정보 처리방침 동의 (필수)', labelEn: 'Privacy Policy (Required)', required: true },
  { key: 'refundPolicy', labelKo: '환불 규정 동의 (필수)', labelEn: 'Refund Policy (Required)', required: true },
  { key: 'thirdPartyConsent', labelKo: '제3자 정보 제공 동의 (필수)', labelEn: 'Third Party Consent (Required)', required: true },
  { key: 'infoConsentText', labelKo: '정보성 수신 동의 (필수)', labelEn: 'Informational Consent (Required)', required: true },
  { key: 'marketingConsentText', labelKo: '마케팅 정보 수신 동의 (선택)', labelEn: 'Marketing Consent (Optional)', required: false }
];

export default function TermsAgreementModal({
  isOpen,
  onClose,
  onAgree,
  lang = 'ko',
  isLoading = false,
  terms
}: TermsAgreementModalProps) {
  // Debug: Log when terms prop changes
  React.useEffect(() => {
    console.log('[TermsAgreementModal] Terms prop received:', terms);
    console.log('[TermsAgreementModal] Terms keys:', terms ? Object.keys(terms) : 'No terms');
  }, [terms]);

  const [agreements, setAgreements] = React.useState<Record<string, boolean>>({});
  const [viewingTerm, setViewingTerm] = React.useState<{ title: string; content: string } | null>(null);

  // Get localized term content
  const getTermContent = (key: string): string => {
    if (!terms) return '';

    // Debug: Log term lookup
    const hasEn = terms[`${key}_en` as keyof typeof terms];
    const hasKo = terms[key as keyof typeof terms];

    if (lang === 'en') {
      const content = (hasEn || hasKo || '') as string;
      console.log(`[TermsAgreementModal] EN term '${key}': hasEn=${!!hasEn}, hasKo=${!!hasKo}, contentLength=${content?.length}`);
      return content;
    }
    const content = (hasKo || hasEn || '') as string;
    console.log(`[TermsAgreementModal] KO term '${key}': hasKo=${!!hasKo}, hasEn=${!!hasEn}, contentLength=${content?.length}`);
    return content;
  };

  // Check if term exists (has content)
  const termExists = (key: string): boolean => {
    const content = getTermContent(key);
    const exists = content && typeof content === 'string' && content.trim().length > 0;
    console.log(`[TermsAgreementModal] Term '${key}' exists=${exists}`);
    return exists;
  };

  // Get terms that actually have content
  const availableTerms = TERMS_LIST.filter(term => termExists(term.key));

  // Calculate if all required terms are agreed
  const canProceed = availableTerms
    .filter(term => term.required)
    .every(term => agreements[term.key]);

  const handleAgree = () => {
    if (!canProceed) return;
    onAgree();
  };

  const handleSelectAll = () => {
    const allAgreed = availableTerms.every(term => agreements[term.key]);
    const newValue = !allAgreed;

    setAgreements(
      availableTerms.reduce((acc, term) => {
        acc[term.key] = newValue;
        return acc;
      }, {} as Record<string, boolean>)
    );
  };

  const allSelected = availableTerms.length > 0 && availableTerms.every(term => agreements[term.key]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {lang === 'ko' ? '약관 동의' : 'Terms Agreement'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ko'
                ? '학술대회 등록을 위해 필수 약관에 동의해주세요.'
                : 'Please agree to the required terms for conference registration.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {/* Select All */}
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Checkbox
                id="selectAll"
                checked={allSelected}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="selectAll" className="font-bold text-blue-900 cursor-pointer">
                {lang === 'ko' ? '전체 동의' : 'Select All'}
              </Label>
            </div>

            {/* Terms List */}
            {availableTerms.map(term => {
              const content = getTermContent(term.key);
              return (
                <div
                  key={term.key}
                  className={`flex items-start gap-3 p-4 border rounded-lg ${
                    term.required ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <Checkbox
                    id={term.key}
                    checked={agreements[term.key] || false}
                    onCheckedChange={(checked) =>
                      setAgreements(prev => ({ ...prev, [term.key]: checked as boolean }))
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={term.key}
                      className={`font-medium cursor-pointer ${
                        term.required ? 'text-slate-900' : 'text-amber-900'
                      }`}
                    >
                      {lang === 'ko' ? term.labelKo : term.labelEn}
                    </Label>
                    <button
                      type="button"
                      onClick={() => setViewingTerm({
                        title: lang === 'ko' ? term.labelKo : term.labelEn,
                        content
                      })}
                      className="mt-2 text-blue-600 text-sm flex items-center gap-1 hover:underline"
                    >
                      <FileText className="w-4 h-4" />
                      {lang === 'ko' ? '내용 보기' : 'View Content'}
                    </button>
                  </div>
                </div>
              );
            })}

            {availableTerms.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                {isLoading || terms === null
                  ? (lang === 'ko'
                      ? '약관 정보를 불러오는 중입니다...'
                      : 'Loading terms information...')
                  : (lang === 'ko'
                      ? '⚠️ 약관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.'
                      : '⚠️ Terms information not found. Please contact administrator.')
                }
              </div>
            )}
          </div>

          <div className="p-4 border-t flex gap-3 justify-between items-center">
            <div className="text-sm text-slate-500">
              <p>
                {lang === 'ko'
                  ? '* 필수 항목에 모두 동의하시면 「약관동의」 버튼을 눌러 진행하세요.'
                  : '* Agree to all required items, then click 「Agree」 to proceed.'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                {lang === 'ko' ? '취소' : 'Cancel'}
              </Button>
              <Button
                onClick={handleAgree}
                disabled={!canProceed}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {lang === 'ko' ? '약관동의' : 'Agree'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Term Viewer Modal */}
      {viewingTerm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setViewingTerm(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">{viewingTerm.title}</h2>
              <button
                type="button"
                onClick={() => setViewingTerm(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-8 overflow-y-auto flex-1 text-slate-700 leading-relaxed whitespace-pre-wrap">
              {viewingTerm.content}
            </div>
            <div className="p-4 border-t text-right">
              <button
                type="button"
                onClick={() => setViewingTerm(null)}
                className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
              >
                {lang === 'ko' ? '닫기' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
