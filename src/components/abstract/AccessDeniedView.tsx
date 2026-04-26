import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { EregiButton } from '@/components/eregi/EregiForm';

interface AccessDeniedViewProps {
    slug: string;
    lang: string;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({ slug, lang }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Lock size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-500 mb-8">
                    {lang === 'ko'
                        ? '초록을 제출하려면 로그인이 필요합니다.'
                        : 'You must be logged in to submit an abstract.'}
                </p>

                <div className="space-y-3">
                    <EregiButton
                        className="w-full justify-center"
                        onClick={() => navigate(`/${slug}/auth?mode=login&returnUrl=/${slug}/abstracts&lang=${lang}`)}
                    >
                        {lang === 'ko' ? '로그인' : 'Login'}
                    </EregiButton>
                </div>
            </div>
        </div>
    );
};
