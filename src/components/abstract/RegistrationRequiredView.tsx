import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { EregiButton } from '@/components/eregi/EregiForm';

interface RegistrationRequiredViewProps {
    slug: string;
    lang: string;
}

export const RegistrationRequiredView: React.FC<RegistrationRequiredViewProps> = ({ slug, lang }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {lang === 'ko' ? '등록이 필요합니다' : 'Registration Required'}
                </h2>
                <p className="text-gray-500 mb-8">
                    {lang === 'ko'
                        ? '초록 제출을 위해서는 학술대회 등록과 결제가 완료되어야 합니다.'
                        : 'You must complete conference registration and payment to submit an abstract.'}
                </p>

                <div className="space-y-3">
                    <EregiButton
                        className="w-full justify-center"
                        onClick={() => navigate(`/${slug}/register?lang=${lang}`)}
                    >
                        {lang === 'ko' ? '등록하기 (Register)' : 'Register Now'}
                    </EregiButton>
                    <EregiButton
                        variant="secondary"
                        className="w-full justify-center"
                        onClick={() => navigate(`/${slug}`)}
                    >
                        {lang === 'ko' ? '홈으로 이동' : 'Go to Home'}
                    </EregiButton>
                </div>
            </div>
        </div>
    );
};
