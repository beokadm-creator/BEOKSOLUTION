import { CheckCircle2 } from 'lucide-react';
import { EregiButton } from '@/components/eregi/EregiForm';

interface SubmissionSuccessViewProps {
    lang: string;
    onViewSubmissions: () => void;
}

export const SubmissionSuccessView: React.FC<SubmissionSuccessViewProps> = ({ lang, onViewSubmissions }) => {
    return (
        <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl p-8 sm:p-12 text-center animate-in fade-in zoom-in-95 duration-500 border border-gray-100 mt-8">
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20"></div>
                <CheckCircle2 className="w-12 h-12 text-green-600 relative z-10" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">
                {lang === 'ko' ? '제출이 완료되었습니다!' : 'Submission Complete!'}
            </h1>
            <p className="text-gray-500 mb-10 text-lg leading-relaxed">
                {lang === 'ko'
                    ? '초록이 성공적으로 접수되었습니다.<br />심사 결과는 추후 마이페이지에서 확인 가능합니다.'
                    : 'Your abstract has been successfully submitted.<br />Review results will be available on My Page.'}
            </p>

            <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
                <EregiButton
                    onClick={onViewSubmissions}
                    className="h-14 bg-[#003366] hover:bg-[#002244] text-white font-bold shadow-lg shadow-blue-900/10 rounded-xl justify-center text-lg"
                >
                    {lang === 'ko' ? '제출 내역 확인하기' : 'View Submissions'}
                </EregiButton>

                <EregiButton
                    onClick={() => window.location.href = '/mypage'}
                    variant="outline"
                    className="h-14 border-2 border-gray-100 hover:border-gray-300 text-gray-600 font-bold rounded-xl justify-center"
                >
                    {lang === 'ko' ? '마이페이지로 이동' : 'Go to My Page'}
                </EregiButton>
            </div>
        </div>
    );
};
