import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { EregiInput, EregiButton } from '../../components/eregi/EregiForm';
import EregiNavigation from '../../components/eregi/EregiNavigation';
import toast from 'react-hot-toast';
import { LogIn, UserPlus, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { ConferenceUser } from '../../types/schema';
import { useSystemSettings } from '../../hooks/useSystemSettings';

type AuthMode = 'login' | 'signup';

const AuthPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings: systemSettings } = useSystemSettings();
    const [mode, setMode] = useState<AuthMode>('login');
    const [isAllowedDomain, setIsAllowedDomain] = useState(false);
    const [loading, setLoading] = useState(false);

    // Terms agreement state
    const [termsAgreed, setTermsAgreed] = useState(false);
    const [privacyAgreed, setPrivacyAgreed] = useState(false);
    const [thirdPartyAgreed, setThirdPartyAgreed] = useState(false);
    const [marketingAgreed, setMarketingAgreed] = useState(false);
    const [adInfoAgreed, setAdInfoAgreed] = useState(false);
    const [showTermsDetails, setShowTermsDetails] = useState(false);

    // Login form state
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Signup form state
    const [signupName, setSignupName] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPhone, setSignupPhone] = useState('');
    const [signupOrganization, setSignupOrganization] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

    // Check if signup is allowed (eregi.co.kr only)
    useEffect(() => {
        const hostname = window.location.hostname;
        // Allow eregi.co.kr, www.eregi.co.kr, and localhost for development
        const allowed = hostname === 'eregi.co.kr' ||
                      hostname === 'www.eregi.co.kr' ||
                      hostname.includes('localhost');
        setIsAllowedDomain(allowed);
    }, []);

    // Domain check helper
    const isEregiDomain = (): boolean => {
        const hostname = window.location.hostname;
        return hostname === 'eregi.co.kr' ||
               hostname === 'www.eregi.co.kr' ||
               hostname.includes('localhost');
    };

    // Email validation
    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Phone validation (Korean format)
    const isValidPhone = (phone: string): boolean => {
        const phoneRegex = /^01[0-9]-?\d{3,4}-?\d{4}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    };

    // Handle login
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!loginEmail || !loginPassword) {
            toast.error('이메일과 비밀번호를 입력해주세요.');
            return;
        }

        if (!isValidEmail(loginEmail)) {
            toast.error('올바른 이메일 형식이 아닙니다.');
            return;
        }

        setLoading(true);

        try {
            // Firebase Auth login
            const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            const user = userCredential.user;

            toast.success('로그인 성공!');

            // Check if user document exists
            const userDoc = await getDoc(doc(db, 'users', user.uid));

            // Redirect based on whether user has profile
            if (userDoc.exists()) {
                navigate('/mypage');
            } else {
                // No profile yet, redirect to create profile
                navigate('/mypage');
            }
        } catch (error) {
            console.error('Login error:', error);
            let errorMessage = '로그인에 실패했습니다.';

            if (error instanceof Error && 'code' in error) {
                const err = error as { code: string };
                if (err.code === 'auth/user-not-found') {
                    errorMessage = '존재하지 않는 이메일입니다.';
                } else if (err.code === 'auth/wrong-password') {
                    errorMessage = '비밀번호가 일치하지 않습니다.';
                } else if (err.code === 'auth/invalid-credential') {
                    errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
                } else if (err.code === 'auth/invalid-email') {
                    errorMessage = '올바르지 않은 이메일 형식입니다.';
                } else if (err.code === 'auth/too-many-requests') {
                    errorMessage = '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
                }
            }

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Handle signup
    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        // Domain restriction
        if (!isAllowedDomain) {
            toast.error('회원가입은 eregi.co.kr에서만 가능합니다.');
            return;
        }

        // Validation
        if (!signupName || !signupEmail || !signupPhone || !signupOrganization || !signupPassword) {
            toast.error('모든 필수 정보를 입력해주세요.');
            return;
        }

        if (!isValidEmail(signupEmail)) {
            toast.error('올바른 이메일 형식이 아닙니다.');
            return;
        }

        if (!isValidPhone(signupPhone)) {
            toast.error('올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)');
            return;
        }

        if (signupPassword.length < 6) {
            toast.error('비밀번호는 6자 이상이어야 합니다.');
            return;
        }

        if (signupPassword !== signupConfirmPassword) {
            toast.error('비밀번호가 일치하지 않습니다.');
            return;
        }

        // Terms agreement validation
        if (!termsAgreed) {
            toast.error('서비스 이용약관에 동의해주세요.');
            return;
        }

        if (!privacyAgreed) {
            toast.error('개인정보 처리방침에 동의해주세요.');
            return;
        }

        if (!thirdPartyAgreed) {
            toast.error('제3자 정보 제공에 동의해주세요.');
            return;
        }

        setLoading(true);

        try {
            // Create user with Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
            const user = userCredential.user;

            // Update profile with name
            await updateProfile(user, {
                displayName: signupName
            });

            // Create user document in Firestore
            const userData: Partial<ConferenceUser> = {
                uid: user.uid,
                id: user.uid,
                name: signupName,
                email: signupEmail,
                phone: signupPhone.replace(/\s/g, ''),
                country: 'KR',
                isForeigner: false,
                organization: signupOrganization,
                tier: 'NON_MEMBER',
                authStatus: {
                    emailVerified: user.emailVerified,
                    phoneVerified: false
                },
                marketingAgreed: marketingAgreed,
                infoAgreed: adInfoAgreed,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await setDoc(doc(db, 'users', user.uid), userData);

            toast.success('회원가입이 완료되었습니다!');

            // Redirect to mypage
            setTimeout(() => {
                navigate('/mypage');
            }, 1000);
        } catch (error) {
            console.error('Signup error:', error);
            let errorMessage = '회원가입에 실패했습니다.';

            if (error instanceof Error && 'code' in error) {
                const err = error as { code: string };
                if (err.code === 'auth/email-already-in-use') {
                    errorMessage = '이미 사용 중인 이메일입니다.';
                } else if (err.code === 'auth/invalid-email') {
                    errorMessage = '올바르지 않은 이메일 형식입니다.';
                } else if (err.code === 'auth/weak-password') {
                    errorMessage = '비밀번호가 너무 약합니다.';
                }
            }

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            <EregiNavigation />

            <div className="max-w-md mx-auto px-4 py-16">
                {/* Auth Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Tab Switcher */}
                    <div className="flex mb-8 bg-gray-100 rounded-xl p-1">
                        <button
                            onClick={() => setMode('login')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
                                mode === 'login'
                                    ? 'bg-white text-[#003366] shadow-md'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <LogIn size={18} />
                            <span>Log In</span>
                        </button>
                        {isEregiDomain() && (
                            <button
                                onClick={() => setMode('signup')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
                                    mode === 'signup'
                                        ? 'bg-white text-[#003366] shadow-md'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <UserPlus size={18} />
                                <span>Sign Up</span>
                            </button>
                        )}
                    </div>

                    {/* Login Form */}
                    {mode === 'login' && (
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                    로그인
                                </h2>
                                <p className="text-gray-600 text-sm">
                                    계정에 로그인하여 서비스를 이용하세요.
                                </p>
                            </div>

                            <EregiInput
                                type="email"
                                label="이메일"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                placeholder="example@email.com"
                                requiredMark
                            />

                            <EregiInput
                                type="password"
                                label="비밀번호"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder="••••••••"
                                requiredMark
                            />

                            <EregiButton
                                type="submit"
                                className="w-full"
                                isLoading={loading}
                            >
                                로그인 <ArrowRight size={18} className="ml-2" />
                            </EregiButton>

                            <div className="text-center pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => setMode('signup')}
                                    className="text-[#24669e] hover:text-[#003366] font-medium text-sm"
                                >
                                    계정이 없으신가요? 회원가입
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Signup Form */}
                    {mode === 'signup' && (
                        <form onSubmit={handleSignup} className="space-y-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                    회원가입
                                </h2>
                                <p className="text-gray-600 text-sm">
                                    새 계정을 만들어 서비스를 시작하세요.
                                </p>
                            </div>

                            {/* Domain restriction warning */}
                            {!isAllowedDomain && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                    <p className="text-yellow-800 text-sm font-medium">
                                        ⚠️ 회원가입은 eregi.co.kr 도메인에서만 가능합니다.
                                    </p>
                                </div>
                            )}

                            <EregiInput
                                type="text"
                                label="이름"
                                value={signupName}
                                onChange={(e) => setSignupName(e.target.value)}
                                placeholder="홍길동"
                                requiredMark
                                disabled={!isAllowedDomain}
                            />

                            <EregiInput
                                type="email"
                                label="이메일"
                                value={signupEmail}
                                onChange={(e) => setSignupEmail(e.target.value)}
                                placeholder="example@email.com"
                                requiredMark
                                disabled={!isAllowedDomain}
                            />

                            <EregiInput
                                type="tel"
                                label="전화번호"
                                value={signupPhone}
                                onChange={(e) => setSignupPhone(e.target.value)}
                                placeholder="010-1234-5678"
                                requiredMark
                                disabled={!isAllowedDomain}
                            />

                            <EregiInput
                                type="text"
                                label="소속"
                                value={signupOrganization}
                                onChange={(e) => setSignupOrganization(e.target.value)}
                                placeholder="병원/학교/기관명"
                                requiredMark
                                disabled={!isAllowedDomain}
                            />

                            <EregiInput
                                type="password"
                                label="비밀번호"
                                value={signupPassword}
                                onChange={(e) => setSignupPassword(e.target.value)}
                                placeholder="6자 이상"
                                requiredMark
                                disabled={!isAllowedDomain}
                            />

                            <EregiInput
                                type="password"
                                label="비밀번호 확인"
                                value={signupConfirmPassword}
                                onChange={(e) => setSignupConfirmPassword(e.target.value)}
                                placeholder="비밀번호 재입력"
                                requiredMark
                                disabled={!isAllowedDomain}
                            />

                            {/* Terms Agreement Section */}
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-700">약관 동의</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowTermsDetails(!showTermsDetails)}
                                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        {showTermsDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        {showTermsDetails ? '접기' : '펼쳐보기'}
                                    </button>
                                </div>

                                {/* Required Terms */}
                                <div className="space-y-2">
                                    <label className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={termsAgreed}
                                            onChange={(e) => setTermsAgreed(e.target.checked)}
                                            disabled={!isAllowedDomain}
                                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm text-gray-700">
                                                <span className="text-red-500 font-medium">[필수]</span> 서비스 이용약관 동의
                                            </span>
                                            {showTermsDetails && systemSettings?.termsService && (
                                                <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 max-h-32 overflow-y-auto">
                                                    {systemSettings.termsService}
                                                </div>
                                            )}
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={privacyAgreed}
                                            onChange={(e) => setPrivacyAgreed(e.target.checked)}
                                            disabled={!isAllowedDomain}
                                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm text-gray-700">
                                                <span className="text-red-500 font-medium">[필수]</span> 개인정보 처리방침 동의
                                            </span>
                                            {showTermsDetails && systemSettings?.privacy && (
                                                <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 max-h-32 overflow-y-auto">
                                                    {systemSettings.privacy}
                                                </div>
                                            )}
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={thirdPartyAgreed}
                                            onChange={(e) => setThirdPartyAgreed(e.target.checked)}
                                            disabled={!isAllowedDomain}
                                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm text-gray-700">
                                                <span className="text-red-500 font-medium">[필수]</span> 제3자 정보 제공 동의
                                            </span>
                                            {showTermsDetails && systemSettings?.thirdParty && (
                                                <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 max-h-32 overflow-y-auto">
                                                    {systemSettings.thirdParty}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                </div>

                                {/* Optional Terms */}
                                <div className="space-y-2 pt-1 border-t">
                                    <label className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={marketingAgreed}
                                            onChange={(e) => setMarketingAgreed(e.target.checked)}
                                            disabled={!isAllowedDomain}
                                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm text-gray-700">
                                                <span className="text-blue-500 font-medium">[선택]</span> 마케팅 정보 수신 동의
                                            </span>
                                            {showTermsDetails && systemSettings?.termsMarketing && (
                                                <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 max-h-32 overflow-y-auto">
                                                    {systemSettings.termsMarketing}
                                                </div>
                                            )}
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={adInfoAgreed}
                                            onChange={(e) => setAdInfoAgreed(e.target.checked)}
                                            disabled={!isAllowedDomain}
                                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm text-gray-700">
                                                <span className="text-blue-500 font-medium">[선택]</span> 광고성 정보 수신 동의
                                            </span>
                                            {showTermsDetails && systemSettings?.termsAdInfo && (
                                                <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 max-h-32 overflow-y-auto">
                                                    {systemSettings.termsAdInfo}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                </div>

                                {/* Select All */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const allRequired = !termsAgreed || !privacyAgreed || !thirdPartyAgreed;
                                        setTermsAgreed(allRequired);
                                        setPrivacyAgreed(allRequired);
                                        setThirdPartyAgreed(allRequired);
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2"
                                    disabled={!isAllowedDomain}
                                >
                                    {termsAgreed && privacyAgreed && thirdPartyAgreed ? '필수 약관 모두 해제' : '필수 약관 모두 동의'}
                                </button>
                            </div>

                            <EregiButton
                                type="submit"
                                className="w-full"
                                isLoading={loading}
                                disabled={!isAllowedDomain}
                            >
                                회원가입 <ArrowRight size={18} className="ml-2" />
                            </EregiButton>

                            <div className="text-center pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => setMode('login')}
                                    className="text-[#24669e] hover:text-[#003366] font-medium text-sm"
                                >
                                    이미 계정이 있으신가요? 로그인
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer Info */}
                <div className="mt-8 text-center text-gray-500 text-sm">
                    <p>
                        회원가입 시{' '}
                        <a href="/terms" className="text-[#24669e] hover:underline">
                            이용약관
                        </a>
                        ,{' '}
                        <a href="/privacy" className="text-[#24669e] hover:underline">
                            개인정보처리방침
                        </a>
                        {' '}및{' '}
                        <span className="text-gray-700">제3자 정보 제공</span>
                        에 동의해야 합니다.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
