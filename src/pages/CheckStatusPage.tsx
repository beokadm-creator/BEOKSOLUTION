import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useConference } from '../hooks/useConference';
import { useNonMemberAuth } from '../hooks/useNonMemberAuth';
import { EregiCard, EregiInput, EregiButton } from '../components/eregi/EregiForm';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Toaster, toast } from 'react-hot-toast';

const CheckStatusPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { id: cid, loading: confLoading, info: confInfo } = useConference();
    const { login, loading: authLoading, nonMember } = useNonMemberAuth(cid);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const hasRedirected = useRef(false);

    const returnUrl = searchParams.get('returnUrl');
    const lang = searchParams.get('lang') === 'en' ? 'en' : 'ko';

    const t = {
        title: lang === 'ko' ? '등록조회' : 'Registration Lookup',
        description: lang === 'ko'
            ? '등록 시 입력한 이메일과 비밀번호를 입력해주세요.'
            : 'Please enter the email and password you used for registration.',
        emailLabel: lang === 'ko' ? '이메일' : 'Email',
        passwordLabel: lang === 'ko' ? '비밀번호' : 'Password',
        passwordPlaceholder: lang === 'ko' ? '등록 시 설정한 비밀번호' : 'Password set during registration',
        submitButton: lang === 'ko' ? '인증하고 계속하기' : 'Authenticate & Continue',
        backButton: lang === 'ko' ? '돌아가기' : 'Go Back',
        loadingError: lang === 'ko' ? '컨퍼런스 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.' : 'Loading conference info. Please try again later.',
        inputError: lang === 'ko' ? '이메일과 비밀번호를 모두 입력해주세요.' : 'Please enter both email and password.',
        success: lang === 'ko' ? '인증되었습니다.' : 'Authenticated successfully.',
        fail: lang === 'ko' ? '인증에 실패했습니다.' : 'Authentication failed.'
    };

    // Redirect if already logged in (only on initial page load, not after manual login)
    useEffect(() => {
        if (!authLoading && nonMember && nonMember.cid === cid && !hasRedirected.current) {
            console.log('[CheckStatusPage] Already logged in, redirecting to hub');
            hasRedirected.current = true;
            if (returnUrl) {
                navigate(returnUrl);
            } else {
                navigate(`/${slug}/abstracts`);
            }
        }
    }, [nonMember, cid, slug, navigate, returnUrl, authLoading]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!cid) {
            toast.error(t.loadingError);
            return;
        }

        if (!email || !password) {
            toast.error(t.inputError);
            return;
        }

        try {
            console.log('[CheckStatusPage] Attempting login:', { email, cid });
            const session = await login(email, password, cid);
            console.log('[CheckStatusPage] Login successful, session created:', session);

            // Show success toast with auto-dismiss
            toast.success(t.success, {
                duration: 3000,  // 3 seconds
                position: 'top-center'
            });

            // Mark redirect flag to prevent the useEffect from triggering
            hasRedirected.current = true;

            // Small delay to let toast display before redirect
            setTimeout(() => {
                if (returnUrl) {
                    navigate(returnUrl);
                } else {
                    navigate(`/${slug}/abstracts`);
                }
            }, 500);  // 500ms delay
        } catch (err) {
            console.error('[CheckStatusPage] Login error:', err);
            const errorMessage = err instanceof Error ? err.message : t.fail;
            toast.error(errorMessage);
        }
    };

    // Only show spinner for initial load, not during login
    if (confLoading && !cid) {
        return <LoadingSpinner />;
    }

    if (!cid) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-800">Conference Not Found</h2>
                    <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:underline">
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
             {/* Background Pattern */}
             <div className="absolute top-0 left-0 w-full h-64 bg-eregi-800 opacity-10 skew-y-3 transform origin-top-left pointer-events-none"></div>
             
            <EregiCard className="max-w-md w-full p-8 shadow-2xl relative z-10 bg-white/95 backdrop-blur-sm">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-eregi-800 mb-2">
                        {t.title}
                    </h1>
                    <p className="text-slate-500 text-sm">
                        {t.description}<br/>
                        <span className="text-xs text-slate-400 mt-1 block">
                            {confInfo?.title?.ko || confInfo?.title?.en}
                        </span>
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <EregiInput
                        label={t.emailLabel}
                        type="email"
                        placeholder="registration@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-slate-50"
                    />
                    
                    <EregiInput
                        label={t.passwordLabel}
                        type="password"
                        placeholder={t.passwordPlaceholder}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-slate-50"
                    />

                    <div className="pt-2">
                        <EregiButton
                            type="submit"
                            className="w-full py-3 text-lg"
                            isLoading={authLoading}
                        >
                            {t.submitButton}
                        </EregiButton>
                    </div>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => navigate(-1)}
                        className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        &larr; {t.backButton}
                    </button>
                </div>
            </EregiCard>
            
            <Toaster />
        </div>
    );
};

export default CheckStatusPage;
