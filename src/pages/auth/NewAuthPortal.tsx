import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, updateProfile, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { CheckCircle2, Mail, UserPlus, Calendar, ArrowRight } from 'lucide-react';

// Terms Modal Component
const TermsModal: React.FC<{ title: string; content: string; onClose: () => void; isForeigner?: boolean }> = ({ title, content, onClose, isForeigner }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-lg">{title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 overflow-y-auto whitespace-pre-wrap text-sm text-gray-600 leading-relaxed flex-1">
                {content || (isForeigner ? "English content is not available." : "내용이 없습니다.")}
            </div>
            <div className="p-4 border-t text-right">
                <button onClick={onClose} className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black">
                    {isForeigner ? "Close" : "닫기"}
                </button>
            </div>
        </div>
    </div>
);

const NewAuthPortal: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const returnUrl = searchParams.get('returnUrl');
    const modeParam = searchParams.get('mode') as 'login' | 'signup' | null;

    // Initialize mode from URL param, sessionStorage (for redirect return), or default to login
    const [mode, setMode] = useState<'login' | 'signup'>(() => {
        const savedMode = sessionStorage.getItem('auth_mode') as 'login' | 'signup' | null;
        return modeParam || savedMode || 'login';
    });
    const [userType, setUserType] = useState<'local' | 'foreigner'>('local');

    // [New] Signup Success State
    const [signupSuccess, setSignupSuccess] = useState(false);
    const justSignedUpRef = useRef(false);

    // I18N Text Dictionary
    const i18n = {
        local: {
            nameLabel: "이름 (Name)",
            namePlace: "이름 (실명)",
            nameWarn: "* 내국인은 반드시 국문 성함을 입력해주세요.",
            affLabel: "소속 (Affiliation)",
            affPlace: "소속 (병원/학교)",
            phoneLabel: "휴대전화 (Phone)",
            phonePlace: "010-0000-0000",
            licLabel: "면허번호 (License No.)",
            licPlace: "면허번호 (선택)",
            emailLabel: "이메일 (Email)",
            pwLabel: "비밀번호 (Password)",
            pwConfirmLabel: "비밀번호 확인 (Confirm Password)",
            agreeAll: "전체 동의하기 (Agree All)",
            req: "(필수)",
            opt: "(선택)",
            term1: "이용약관 동의",
            term2: "개인정보 수집 및 이용 동의",
            term3: "마케팅 정보 수신 동의",
            term4: "광고성 정보 제공 동의",
            submitLogin: "로그인 (Login)",
            submitSignup: "회원가입 (Sign Up)",
            submitComplete: "저장하고 시작하기 (Complete)",
            processing: "처리 중... (Processing)"
        },
        foreigner: {
            nameLabel: "Full Name",
            namePlace: "Full Name (as in Passport)",
            nameWarn: "",
            affLabel: "Affiliation",
            affPlace: "Organization / Hospital",
            phoneLabel: "Phone Number (Optional)",
            phonePlace: "Country Code + Phone Number",
            licLabel: "License No. (Optional)",
            licPlace: "License Number",
            emailLabel: "Email Address",
            pwLabel: "Password",
            pwConfirmLabel: "Confirm Password",
            agreeAll: "Agree to All Terms",
            req: "(Required)",
            opt: "(Optional)",
            term1: "Terms of Service",
            term2: "Privacy Policy",
            term3: "Marketing Consent",
            term4: "Ad Info Consent",
            submitLogin: "Login",
            submitSignup: "Sign Up",
            submitComplete: "Complete Profile",
            processing: "Processing..."
        }
    };

    const text = i18n[userType];
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [affiliation, setAffiliation] = useState('');
    const [license, setLicense] = useState('');

    // Terms State (4 Types)
    const [terms, setTerms] = useState({
        service: false,
        privacy: false,
        marketing: false,
        adInfo: false
    });
    const [showModal, setShowModal] = useState<'service' | 'privacy' | 'marketing' | 'adInfo' | null>(null);
    const [termContents, setTermContents] = useState({
        service: '', service_en: '',
        privacy: '', privacy_en: '',
        marketing: '', marketing_en: '',
        adInfo: '', adInfo_en: ''
    });

    const [needsCompletion, setNeedsCompletion] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentUserEmail, setCurrentUserEmail] = useState('');

    // Debounce for Google login click - prevent multiple simultaneous calls
    const googleLoginInProgress = useRef(false);
    // Fetch Terms Content
    useEffect(() => {
        const fetchTerms = async () => {
            try {
                const db = getFirestore();
                const snap = await getDoc(doc(db, 'system', 'settings'));
                if (snap.exists()) {
                    const d = snap.data();
                    setTermContents({
                        service: d.terms || d.termsService || '약관 내용이 없습니다.',
                        service_en: d.termsEn || 'No terms content.',
                        privacy: d.privacy || d.termsPrivacy || '개인정보 처리방침 내용이 없습니다.',
                        privacy_en: d.privacyEn || 'No privacy policy content.',
                        marketing: d.termsMarketing || '마케팅 약관 내용이 없습니다.',
                        marketing_en: d.termsMarketingEn || 'No marketing content.',
                        adInfo: d.termsAdInfo || '광고성 정보 수신 동의 내용이 없습니다.',
                        adInfo_en: d.termsAdInfoEn || 'No ad info content.'
                    });
                }
            } catch (e) { console.error(e); }
        };
        fetchTerms();
    }, []);

    // Helper to get localized term content
    const getTermContent = (key: 'service' | 'privacy' | 'marketing' | 'adInfo') => {
        if (userType === 'foreigner') {
            const enKey = `${key}_en` as keyof typeof termContents;
            if (termContents[enKey]) return termContents[enKey];
        }
        return termContents[key];
    };

    // 2. Profile Checker
    const checkProfileAndRedirect = useCallback(async (user: User) => {
        if (justSignedUpRef.current) return; // [UX] Don't redirect if just signed up

        console.log(`🚀 [Auth Flow] Mode: ${mode}, NeedsCompletion: false, ModeParam: ${modeParam}`);

        // URL 파라미터 mode=login 이 있거나, 현재 모드가 login인 경우 프로필 체크 건너뜀 (납치 방지)
        if (modeParam === 'login' || mode === 'login') {
            if (returnUrl) {
                window.location.href = returnUrl;
            } else {
                // returnUrl이 없으면 마이페이지로 이동
                window.location.href = '/mypage';
            }
            return;
        }

        const db = getFirestore();
        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            // 회원가입이나 명시적 추가 정보 입력이 필요한 경우에만 작동
            if (!data.phoneNumber || !data.affiliation) {
                setNeedsCompletion(true);
                setName(data.userName || user.displayName || '');
                return;
            }
        } else {
            await setDoc(docRef, {
                email: user.email,
                userName: user.displayName,
                role: 'user',
                createdAt: serverTimestamp()
            });
            setNeedsCompletion(true);
            setName(user.displayName || '');
            return;
        }

        if (returnUrl) {
            window.location.href = returnUrl;
        } else {
            // returnUrl이 없으면 뒤로가기 (이전 페이지로 복귀)
            navigate(-1);
        }
    }, [mode, modeParam, returnUrl, navigate]);

    // 1. Check Auth State (Only redirect if profile is complete)
    useEffect(() => {
        const auth = getAuth();
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setCurrentUserEmail(u.email || '');
                if (!needsCompletion) {
                    // Email verification check removed - users can proceed without verification
                    await checkProfileAndRedirect(u);
                }
            }
        });
        return () => unsub();
    }, [returnUrl, modeParam, needsCompletion]);

    // 3. Google Login - Popup only (COOP headers removed)
    const handleGoogleLogin = async () => {
        // Prevent multiple simultaneous calls
        if (googleLoginInProgress.current) {
            console.log('[Google Login] Login already in progress, ignoring click');
            return;
        }

        googleLoginInProgress.current = true;

        const auth = getAuth();
        const provider = new GoogleAuthProvider();

        console.log('[Google Login] Starting Google login...');
        console.log('[Google Login] Auth domain:', auth.config?.authDomain);
        console.log('[Google Login] Current user:', auth.currentUser);

        // Store current state for redirect return
        if (returnUrl) {
            sessionStorage.setItem('auth_returnUrl', returnUrl);
        }
        sessionStorage.setItem('auth_mode', mode);

        toast.loading('구글 로그인 중...', { id: 'google-login' });

        // Use popup-based authentication only (COOP headers removed)
        try {
            const res = await signInWithPopup(auth, provider);
            console.log('[Google Login] Popup successful, user:', res.user.email);

            // CRITICAL FIX: Clear non-member session on member login
            // Prevents privacy leak from previous non-member session
            try {
                sessionStorage.removeItem('NON_MEMBER');
                console.log('[NewAuthPortal] Cleared non-member session on Google login');
            } catch (err) {
                console.warn('[NewAuthPortal] Failed to clear non-member session:', err);
            }

            toast.success('구글 로그인 성공!', { id: 'google-login' });
            checkProfileAndRedirect(res.user);
            googleLoginInProgress.current = false;
            return;
        } catch (e: any) {
            googleLoginInProgress.current = false;
            console.error('[Google Login] Error:', e);
            console.error('[Google Login] Error code:', e.code);
            console.error('[Google Login] Error message:', e.message);
            toast.dismiss('google-login');

            // Handle errors
            let errorMsg = "구글 로그인 실패";
            if (e.code === 'auth/popup-closed-by-user') {
                errorMsg = "구글 로그인 창이 닫혔습니다. 다시 시도해 주세요.";
            } else if (e.code === 'auth/cancelled-popup-request') {
                errorMsg = "로그인이 취소되었습니다.";
            } else if (e.code === 'auth/popup-blocked') {
                errorMsg = "팝업이 차단되었습니다. 팝업을 허용해 주세요.";
            } else if (e.code === 'auth/account-exists-with-different-credential') {
                errorMsg = "이미 다른 방법으로 가입된 계정입니다.";
            } else if (e.code === 'auth/unauthorized-domain') {
                errorMsg = "도메인 인증이 필요합니다. 관리자에게 문의해주세요.";
            } else if (e.code === 'auth/invalid-credential') {
                errorMsg = "인증 정보가 유효하지 않습니다.";
            }
            setError(errorMsg);
        }
    };

    // Helper: Terms Handlers
    const handleAllCheck = (checked: boolean) => {
        setTerms({ service: checked, privacy: checked, marketing: checked, adInfo: checked });
    };

    const handleSingleCheck = (key: keyof typeof terms) => {
        setTerms(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isAllChecked = terms.service && terms.privacy && terms.marketing && terms.adInfo;

    const handleLogout = async () => {
        try {
            await signOut(getAuth());
            setCurrentUserEmail('');
            setNeedsCompletion(false);
            toast.success("로그아웃되었습니다.");
        } catch (e) {
            console.error(e);
            toast.error("로그아웃 실패");
        }
    };

    const handleContinue = async () => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;

        const db = getFirestore();
        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            if (!data.phoneNumber || !data.affiliation) {
                setNeedsCompletion(true);
                setName(data.userName || user.displayName || '');
                return;
            }
        }

        // [UX-FIX] 비회원 허브로 이동
        if (returnUrl) {
            window.location.href = returnUrl;
        } else {
            // returnUrl이 없으면 현재 도메인에서 societyId를 추출하여 비회원 허브로 이동
            const hostname = window.location.hostname;
            let societyId = 'kadd';
            const parts = hostname.split('.');
            if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
                societyId = parts[0];
            }

            // Firestore에서 활성화된 컨퍼런스 조회
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const confsRef = collection(db, 'conferences');
            const q = query(confsRef, where('societyId', '==', societyId), where('status', '==', 'ACTIVE'));
            const confsSnap = await getDocs(q);

            let targetSlug = 'kadd_2026spring'; // 기본값
            if (!confsSnap.empty) {
                // 가장 최근의 컨퍼런스 선택 (createdAt 기준 내림차순)
                const sortedConfs = confsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
                    .sort((a: any, b: any) => {
                        const aTime = a.createdAt?.seconds || 0;
                        const bTime = b.createdAt?.seconds || 0;
                        return bTime - aTime;
                    });
                const latestConf = sortedConfs[0] as any;
                targetSlug = latestConf.slug || latestConf.id || targetSlug;
            }

            window.location.href = `/${targetSlug}/non-member/hub`;
        }
    };

    // 4. Form Submit (Login / Signup / Completion)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const auth = getAuth();
        const db = getFirestore();

        try {
            if (needsCompletion) {
                // PROFILE COMPLETION
                if (!terms.service || !terms.privacy) throw new Error("필수 약관에 동의해야 합니다.");
                if (!name || !affiliation) throw new Error("필수 정보를 입력해주세요.");
                if (userType === 'local' && !phone) throw new Error("내국인은 휴대전화 번호가 필수입니다.");

                const user = auth.currentUser;
                if (!user) throw new Error("로그인 세션이 만료되었습니다.");

                if (name !== user.displayName) await updateProfile(user, { displayName: name });

                await updateDoc(doc(db, 'users', user.uid), {
                    userName: name,
                    phoneNumber: phone,
                    affiliation: affiliation,
                    licenseNumber: license,
                    userType,
                    termsAgreed: true,
                    privacyAgreed: true,
                    marketingAgreed: terms.marketing,
                    adInfoAgreed: terms.adInfo,
                    agreedAt: serverTimestamp(),
                    provider: 'google'
                });

                toast.success("정보가 저장되었습니다.");

                // [New Logic] If this was a completion step after signup (or just completion), show success page
                // But wait, needsCompletion can happen for existing users too.
                // Let's treat completion as success too.
                justSignedUpRef.current = true;
                setSignupSuccess(true);
                setLoading(false);

            } else if (mode === 'login') {
                // LOGIN
                const res = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
                // Email verification check removed - users can login without verification

                // CRITICAL FIX: Clear non-member session on member login
                // Prevents privacy leak from previous non-member session
                try {
                    sessionStorage.removeItem('NON_MEMBER');
                    console.log('[NewAuthPortal] Cleared non-member session on member login');
                } catch (err) {
                    console.warn('[NewAuthPortal] Failed to clear non-member session:', err);
                }

                // Lazy Check: mode=login인 경우 프로필 체크를 하지 않고 returnUrl로 이동
                if (modeParam === 'login' || mode === 'login') {
                    if (returnUrl) window.location.href = returnUrl;
                    else window.location.href = '/mypage';
                } else {
                    checkProfileAndRedirect(res.user);
                }
            } else {
                // SIGNUP
                if (!terms.service || !terms.privacy) throw new Error("필수 약관에 동의해야 합니다.");
                if (!name || !affiliation) throw new Error("필수 정보를 입력해주세요.");
                if (userType === 'local' && !phone) throw new Error("내국인은 휴대전화 번호가 필수입니다.");
                if (password !== confirmPassword) throw new Error("비밀번호가 일치하지 않습니다.");

                const res = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
                const user = res.user;

                await updateProfile(user, { displayName: name });

                await setDoc(doc(db, 'users', user.uid), {
                    email: user.email,
                    userName: name,
                    phoneNumber: phone,
                    affiliation: affiliation,
                    licenseNumber: license,
                    userType,
                    createdAt: serverTimestamp(),
                    role: 'user',
                    termsAgreed: true,
                    privacyAgreed: true,
                    marketingAgreed: terms.marketing,
                    adInfoAgreed: terms.adInfo,
                    agreedAt: serverTimestamp(),
                    provider: 'email'
                });

                // No email verification required - user is already logged in, redirect immediately
                toast.success("회원가입이 완료되었습니다.");

                // CRITICAL FIX: Clear non-member session on member signup
                try {
                    sessionStorage.removeItem('NON_MEMBER');
                    console.log('[NewAuthPortal] Cleared non-member session on email signup');
                } catch (err) {
                    console.warn('[NewAuthPortal] Failed to clear non-member session:', err);
                }

                // [New Logic] Show Success Page
                justSignedUpRef.current = true;
                setSignupSuccess(true);
                setLoading(false);
            }
        } catch (err: unknown) {
            console.error(err);
            let msg = '에러가 발생했습니다.';
            if (err instanceof Error) {
                msg = err.message;
                const authError = err as { code?: string };
                if (authError.code === 'auth/email-already-in-use') msg = "이미 가입된 이메일입니다.";
                if (authError.code === 'auth/invalid-credential') msg = "이메일 또는 비밀번호가 일치하지 않습니다.";
                if (authError.code === 'auth/weak-password') msg = "비밀번호는 6자리 이상이어야 합니다.";
            }
            setError(msg);
            setLoading(false);
        }
    };

    if (signupSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#dbeafe] to-[#d1fae5] flex items-center justify-center p-4">
                <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-2xl w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-center border border-white/50 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#003366] to-[#24669e]"></div>

                    <div className="mx-auto w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-blue-50">
                        <UserPlus className="w-10 h-10 text-[#003366]" />
                    </div>

                    <h1 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">
                        {userType === 'foreigner' ? "Welcome!" : "회원가입 완료!"}
                    </h1>
                    <p className="text-lg text-gray-500 mb-8 font-medium">
                        {userType === 'foreigner'
                            ? "Your account has been successfully created."
                            : "계정이 성공적으로 생성되었습니다."}
                    </p>

                    <div className="bg-gray-50/80 rounded-2xl p-6 text-left border border-gray-100 mb-8 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                            {userType === 'foreigner' ? "Next Steps" : "다음 단계 안내"}
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4 p-3 hover:bg-white rounded-xl transition-colors">
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-700 mt-0.5">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">{userType === 'foreigner' ? "Email Confirmation" : "이메일 확인"}</p>
                                    <p className="text-sm text-gray-500 mt-0.5 leading-snug">
                                        {userType === 'foreigner' ? "Check your email for confirmation." : "가입 확인 이메일이 발송되었습니다."}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-3 hover:bg-white rounded-xl transition-colors">
                                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700 mt-0.5">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">{userType === 'foreigner' ? "Member Verification" : "회원 인증"}</p>
                                    <p className="text-sm text-gray-500 mt-0.5 leading-snug">
                                        {userType === 'foreigner' ? "Verify membership for discounts." : "학회원이라면 등록 시 인증하고 할인받으세요."}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-3 hover:bg-white rounded-xl transition-colors">
                                <div className="p-2 bg-green-100 rounded-lg text-green-700 mt-0.5">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">{userType === 'foreigner' ? "Register for Conference" : "학술대회 등록"}</p>
                                    <p className="text-sm text-gray-500 mt-0.5 leading-snug">
                                        {userType === 'foreigner' ? "Proceed to registration now." : "지금 바로 사전등록을 신청할 수 있습니다."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            if (returnUrl) window.location.href = returnUrl;
                            else window.location.href = '/mypage';
                        }}
                        className="w-full bg-[#003366] hover:bg-[#002244] text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                    >
                        {userType === 'foreigner' ? "Continue to Registration" : "시작하기"}
                        <ArrowRight className="w-5 h-5" />
                    </button>

                    <p className="mt-4 text-xs text-center text-gray-400">
                        {userType === 'foreigner' ? "Redirecting to main service..." : "서비스 메인 화면으로 이동합니다."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
            {/* Modals */}
            {showModal === 'service' && <TermsModal isForeigner={userType === 'foreigner'} title={userType === 'foreigner' ? "Terms of Service" : "이용약관"} content={getTermContent('service')} onClose={() => setShowModal(null)} />}
            {showModal === 'privacy' && <TermsModal isForeigner={userType === 'foreigner'} title={userType === 'foreigner' ? "Privacy Policy" : "개인정보 수집 및 이용"} content={getTermContent('privacy')} onClose={() => setShowModal(null)} />}
            {showModal === 'marketing' && <TermsModal isForeigner={userType === 'foreigner'} title={userType === 'foreigner' ? "Marketing Consent" : "마케팅 정보 수신 동의"} content={getTermContent('marketing')} onClose={() => setShowModal(null)} />}
            {showModal === 'adInfo' && <TermsModal isForeigner={userType === 'foreigner'} title={userType === 'foreigner' ? "Ad Info Consent" : "광고성 정보 제공 동의"} content={getTermContent('adInfo')} onClose={() => setShowModal(null)} />}

            {/* Case 1: 로그인 안 된 경우 또는 회원가입/추가정보 입력 모드 */}
            {(!currentUserEmail || mode !== 'login' || needsCompletion) && (
                <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-2xl w-full max-w-[480px]">
                    <h1 className="text-3xl font-extrabold text-center mb-6 text-slate-900 tracking-tight">
                        {needsCompletion ? '추가 정보 입력' : (mode === 'login' ? '로그인' : '회원가입')}
                    </h1>

                    {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-6 text-sm text-center font-medium border border-red-100">{error}</div>}

                    {/* 1. GOOGLE LOGIN (TOP PRIORITY for BOTH Login & Signup) */}
                    {!needsCompletion && (
                        <div className="mb-6">
                            <button onClick={handleGoogleLogin} className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-3.5 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-3 shadow-sm">
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                                Google 계정으로 로그인
                            </button>
                            <div className="relative my-8">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-slate-400 font-medium tracking-wide">또는 이메일로 계속하기</span></div>
                            </div>
                        </div>
                    )}

                    {/* USER TYPE TABS (For Signup/Completion) */}
                    {(mode === 'signup' || needsCompletion) && (
                        <div className="bg-slate-100 p-1.5 rounded-xl flex gap-1 mb-6">
                            <button
                                type="button"
                                onClick={() => setUserType('local')}
                                className={`flex-1 py-2.5 text-sm transition-all duration-200 rounded-lg ${userType === 'local' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700 font-medium'}`}
                            >
                                내국인 (Local)
                            </button>
                            <button
                                type="button"
                                onClick={() => setUserType('foreigner')}
                                className={`flex-1 py-2.5 text-sm transition-all duration-200 rounded-lg ${userType === 'foreigner' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700 font-medium'}`}
                            >
                                Foreigner
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* SIGNUP / COMPLETION FIELDS */}
                        {(needsCompletion || mode === 'signup') && (
                            <>
                                {needsCompletion && <div className="bg-blue-50/50 p-4 rounded-xl text-sm text-blue-800 mb-6 border border-blue-100 font-medium">서비스 이용을 위해 추가 정보가 필요합니다.</div>}

                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-1.5 ml-1">{text.nameLabel}</label>
                                    <input type="text" placeholder={text.namePlace} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200" value={name} onChange={e => setName(e.target.value)} required />
                                    {userType === 'local' && <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">{text.nameWarn}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-1.5 ml-1">{text.affLabel}</label>
                                    <input type="text" placeholder={text.affPlace} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200" value={affiliation} onChange={e => setAffiliation(e.target.value)} required />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-1.5 ml-1">{text.phoneLabel}</label>
                                    <input
                                        type="text"
                                        placeholder={text.phonePlace}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        required={userType === 'local'}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-1.5 ml-1">{text.licLabel}</label>
                                    <input type="text" placeholder={text.licPlace} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200" value={license} onChange={e => setLicense(e.target.value)} />
                                </div>
                            </>
                        )}

                        {/* LOGIN / EMAIL FIELDS */}
                        {/* [Fix] Always show login fields if mode is login, unless explicitly completing profile in signup mode */}
                        {(!needsCompletion || mode === 'login') && (
                            <div className="space-y-4">
                                <input
                                    type="email" placeholder="이메일 (Email)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                                    value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username"
                                />
                                <input
                                    type="password" placeholder="비밀번호 (Password)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                                    value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                                />
                                {mode === 'signup' && (
                                    <input
                                        type="password" placeholder="비밀번호 확인 (Confirm Password)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                                        value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password"
                                    />
                                )}
                            </div>
                        )}

                        {/* TERMS UI */}
                        {(mode === 'signup' || needsCompletion) && (
                            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3.5 mt-6 shadow-inner">
                                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200">
                                    <input type="checkbox" id="all" checked={isAllChecked} onChange={e => handleAllCheck(e.target.checked)} className="w-4.5 h-4.5 rounded-md text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" />
                                    <label htmlFor="all" className="font-extrabold text-sm text-slate-800 cursor-pointer select-none">{text.agreeAll}</label>
                                </div>
                                <div className="space-y-3 pl-1">
                                    {/* Service */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <input type="checkbox" id="t1" checked={terms.service} onChange={() => handleSingleCheck('service')} className="w-4 h-4 rounded text-blue-600 cursor-pointer" />
                                            <label htmlFor="t1" className="text-xs text-slate-600 cursor-pointer select-none transition-colors hover:text-slate-900"><span className="text-blue-600 font-bold">{text.req}</span> {text.term1}</label>
                                        </div>
                                        <button type="button" onClick={() => setShowModal('service')} className="text-[11px] font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-wider">VIEW</button>
                                    </div>
                                    {/* Privacy */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <input type="checkbox" id="t2" checked={terms.privacy} onChange={() => handleSingleCheck('privacy')} className="w-4 h-4 rounded text-blue-600 cursor-pointer" />
                                            <label htmlFor="t2" className="text-xs text-slate-600 cursor-pointer select-none transition-colors hover:text-slate-900"><span className="text-blue-600 font-bold">{text.req}</span> {text.term2}</label>
                                        </div>
                                        <button type="button" onClick={() => setShowModal('privacy')} className="text-[11px] font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-wider">VIEW</button>
                                    </div>
                                    {/* Marketing */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <input type="checkbox" id="t3" checked={terms.marketing} onChange={() => handleSingleCheck('marketing')} className="w-4 h-4 rounded text-blue-600 cursor-pointer" />
                                            <label htmlFor="t3" className="text-xs text-slate-600 cursor-pointer select-none transition-colors hover:text-slate-900"><span className="text-slate-400 font-bold">{text.opt}</span> {text.term3}</label>
                                        </div>
                                        <button type="button" onClick={() => setShowModal('marketing')} className="text-[11px] font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-wider">VIEW</button>
                                    </div>
                                    {/* Ads */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <input type="checkbox" id="t4" checked={terms.adInfo} onChange={() => handleSingleCheck('adInfo')} className="w-4 h-4 rounded text-blue-600 cursor-pointer" />
                                            <label htmlFor="t4" className="text-xs text-slate-600 cursor-pointer select-none transition-colors hover:text-slate-900"><span className="text-slate-400 font-bold">{text.opt}</span> {text.term4}</label>
                                        </div>
                                        <button type="button" onClick={() => setShowModal('adInfo')} className="text-[11px] font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-wider">VIEW</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transform active:scale-[0.98] transition-all duration-200 disabled:opacity-50 mt-6 shadow-md text-lg">
                            {loading ? text.processing : (needsCompletion ? text.submitComplete : (mode === 'login' ? text.submitLogin : text.submitSignup))}
                        </button>
                    </form>

                    {!needsCompletion && (
                        <div className="mt-8 text-center text-sm text-slate-500 space-y-3">
                            {mode === 'login' ? (
                                <>
                                    <p className="font-medium">계정이 없으신가요? <button onClick={() => setMode('signup')} className="text-blue-600 font-extrabold hover:underline transition-all">회원가입 (Signup)</button></p>
                                    <button onClick={() => { if (email) sendPasswordResetEmail(getAuth(), email); else toast.error('이메일을 입력해주세요'); }} className="text-xs text-slate-400 hover:text-slate-600 font-medium underline-offset-4 hover:underline transition-all">비밀번호 재설정 (Reset Password)</button>
                                </>
                            ) : (
                                <p className="font-medium">이미 계정이 있으신가요? <button onClick={() => setMode('login')} className="text-blue-600 font-extrabold hover:underline transition-all">로그인 (Login)</button></p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
export default NewAuthPortal;
