import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, updateProfile, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, sendEmailVerification, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';

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
    const returnUrl = searchParams.get('returnUrl');
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [userType, setUserType] = useState<'local' | 'foreigner'>('local');

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

    // 1. Check Auth State (Only redirect if profile is complete)
    useEffect(() => {
        const auth = getAuth();
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                if (!needsCompletion) {
                    // Check email verification for email login users
                    if (u.providerData[0]?.providerId === 'password' && !u.emailVerified) {
                        // Do not redirect, let them know they need to verify
                        return;
                    }
                    await checkProfileAndRedirect(u);
                }
            }
        });
        return () => unsub();
    }, [returnUrl]);

    // 2. Profile Checker
    const checkProfileAndRedirect = async (user: any) => {
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

        if (returnUrl) window.location.href = returnUrl;
        else window.location.href = '/mypage';
    };

    // 3. Google Login
    const handleGoogleLogin = async () => {
        try {
            const provider = new GoogleAuthProvider();
            const res = await signInWithPopup(getAuth(), provider);
            checkProfileAndRedirect(res.user);
        } catch (e) { console.error(e); setError("구글 로그인 실패"); }
    };

    // Helper: Terms Handlers
    const handleAllCheck = (checked: boolean) => {
        setTerms({ service: checked, privacy: checked, marketing: checked, adInfo: checked });
    };

    const handleSingleCheck = (key: keyof typeof terms) => {
        setTerms(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isAllChecked = terms.service && terms.privacy && terms.marketing && terms.adInfo;

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

                alert("정보가 저장되었습니다.");
                if (returnUrl) window.location.href = returnUrl;
                else window.location.href = '/mypage';

            } else if (mode === 'login') {
                // LOGIN
                const res = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
                if (!res.user.emailVerified) {
                    setError("이메일 인증이 필요합니다. 메일함을 확인해주세요.");
                    await signOut(auth);
                    setLoading(false);
                    return;
                }
                checkProfileAndRedirect(res.user);
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

                // EMAIL VERIFICATION FLOW
                await sendEmailVerification(user);
                await signOut(auth);

                alert("인증 메일이 발송되었습니다. 메일함을 확인하고 다시 로그인해주세요.");
                setMode('login');
                window.location.reload();
            }
        } catch (err: any) {
            console.error(err);
            let msg = err.message;
            if (err.code === 'auth/email-already-in-use') msg = "이미 가입된 이메일입니다.";
            if (err.code === 'auth/invalid-credential') msg = "이메일 또는 비밀번호가 일치하지 않습니다.";
            if (err.code === 'auth/weak-password') msg = "비밀번호는 6자리 이상이어야 합니다.";
            setError(msg);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
            {/* Modals */}
            {showModal === 'service' && <TermsModal isForeigner={userType === 'foreigner'} title={userType === 'foreigner' ? "Terms of Service" : "이용약관"} content={getTermContent('service')} onClose={() => setShowModal(null)} />}
            {showModal === 'privacy' && <TermsModal isForeigner={userType === 'foreigner'} title={userType === 'foreigner' ? "Privacy Policy" : "개인정보 수집 및 이용"} content={getTermContent('privacy')} onClose={() => setShowModal(null)} />}
            {showModal === 'marketing' && <TermsModal isForeigner={userType === 'foreigner'} title={userType === 'foreigner' ? "Marketing Consent" : "마케팅 정보 수신 동의"} content={getTermContent('marketing')} onClose={() => setShowModal(null)} />}
            {showModal === 'adInfo' && <TermsModal isForeigner={userType === 'foreigner'} title={userType === 'foreigner' ? "Ad Info Consent" : "광고성 정보 제공 동의"} content={getTermContent('adInfo')} onClose={() => setShowModal(null)} />}

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
                    {!needsCompletion && (
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
                                <button onClick={() => { if (email) sendPasswordResetEmail(getAuth(), email); else alert('이메일을 입력해주세요'); }} className="text-xs text-slate-400 hover:text-slate-600 font-medium underline-offset-4 hover:underline transition-all">비밀번호 재설정 (Reset Password)</button>
                            </>
                        ) : (
                            <p className="font-medium">이미 계정이 있으신가요? <button onClick={() => setMode('login')} className="text-blue-600 font-extrabold hover:underline transition-all">로그인 (Login)</button></p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
export default NewAuthPortal;
