import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { ArrowRight, ShieldCheck } from 'lucide-react';

const NewAuthPortal: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const returnUrl = searchParams.get('returnUrl');
    const slug = searchParams.get('slug');

    // Redirect to appropriate registration page
    useEffect(() => {
        // If there's a specific returnUrl, go there
        if (returnUrl) {
            window.location.href = returnUrl;
            return;
        }

        // Default: Redirect to conference registration
        // Extract society from hostname
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
            // society extracted but not used
        }

        // Navigate to the conference registration
        const conferenceSlug = slug || '2026spring';
        window.location.href = `/${conferenceSlug}`;
    }, [returnUrl, slug, navigate]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
            <div className="text-center">
                <div className="flex items-center justify-center mb-6">
                    <ShieldCheck className="w-16 h-16 text-blue-600 animate-pulse" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                    시스템 이전 중입니다...
                </h1>
                <p className="text-slate-600 mb-6">
                    회원가입 시스템이 변경되었습니다. 학술대회 등록 페이지로 이동합니다.
                </p>
                <Button
                    onClick={() => window.location.reload()}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-lg"
                >
                    바로 이동하기
                    <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
            </div>
        </div>
    );
};

export default NewAuthPortal;
