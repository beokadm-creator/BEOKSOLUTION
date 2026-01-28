import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getRootCookie } from '../../utils/cookie';
import LoadingSpinner from './LoadingSpinner';
import { Skeleton } from '../ui/skeleton';

export const ConferenceMyPageRedirect: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();

    useEffect(() => {
        const timer = setTimeout(() => {
            // [Step 416-Dev] Smart Redirect with Context
            // We redirect to the main MyPage (UserHub)
            // Ideally, we should stay on the same domain if possible, or go to kadd.eregi.co.kr

            const targetDomain = 'kadd.eregi.co.kr'; // Primary Domain
            const currentHost = window.location.hostname;
            const token = getRootCookie('eregi_session');

            let targetUrl = '/mypage';

            if (currentHost !== targetDomain && !currentHost.includes('localhost')) {
                // Cross-domain redirect
                targetUrl = `https://${targetDomain}/mypage`;
                if (token) {
                    // Pass token for seamless bridge if needed (though session cookie is usually root)
                    // If root cookie is set on .eregi.co.kr, it should be fine.
                    // But if not, we might need to pass it.
                }
            }

            // We can append ?highlight=slug to maybe auto-filter or highlight the conference in the future
            if (slug) {
                targetUrl += `?highlight=${slug}`;
            }

            window.location.href = targetUrl;
        }, 2000);

        return () => clearTimeout(timer);
    }, [slug]);

    return (
        <div className="min-h-screen bg-gray-50 relative flex items-center justify-center overflow-hidden">
            {/* Background Skeleton Layer (Visual Context) */}
            <div className="absolute inset-0 p-8 max-w-5xl mx-auto space-y-8 opacity-40 blur-[2px] pointer-events-none">
                <div className="flex justify-between items-center mb-8">
                    <Skeleton className="h-10 w-64" />
                    <div className="flex gap-4">
                        <Skeleton className="h-10 w-32" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                </div>

                {/* 3-Col Grid Mock */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-40 rounded-xl w-full" />
                    <Skeleton className="h-40 rounded-xl w-full" />
                    <Skeleton className="h-40 rounded-xl w-full" />
                </div>

                {/* Tab Mock */}
                <div className="flex gap-4 border-b border-gray-200 pb-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                </div>

                {/* List Mock */}
                <div className="space-y-4">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                </div>
            </div>

            {/* Foreground Status Card */}
            <div className="relative z-10 bg-white/90 backdrop-blur-md p-10 rounded-3xl shadow-2xl border border-white/50 text-center max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-700">
                <div className="w-20 h-20 bg-blue-50 text-[#003366] rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner relative">
                    {/* Inner Pulse */}
                    <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-20"></div>
                    <LoadingSpinner className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-[#003366] mb-3 tracking-tight">
                    학술대회 정보를<br />불러오는 중입니다
                </h2>
                <p className="text-gray-500 font-medium">
                    잠시만 기다려주세요...<br />
                    <span className="text-sm text-gray-400 mt-2 block font-normal">통합 데이터베이스와 동기화 중</span>
                </p>

                {/* Progress Bar */}
                <div className="mt-8 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#003366] h-full w-1/3 animate-[loading_2s_ease-in-out_infinite] w-full origin-left"></div>
                </div>
            </div>
        </div>
    );
};
