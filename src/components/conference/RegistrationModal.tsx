import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth as firebaseAuth } from '../../firebase';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useMemberVerification } from '../../hooks/useMemberVerification';
import { useConference } from '../../hooks/useConference';
import { useSocietyGrades } from '../../hooks/useSocietyGrades';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ShieldCheck, User, AlertCircle, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import LegalAgreementModal from './LegalAgreementModal';

interface RegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    societyId: string;
    societyName: string;
    confId: string;
    lang?: 'ko' | 'en';
    initialMode?: 'member-auth' | 'non-member' | 'registration-check';
    redirectUrl?: string;
}

// Excluded grade codes for non-member registration
const EXCLUDED_MEMBER_CODES = ['회원', 'Member', '평생회원', 'LIFETIME', 'Lifetime Member'];

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
    isOpen,
    onClose,
    societyId,
    confId,
    lang = 'ko',
    initialMode = 'member-auth',
    redirectUrl
}) => {
    const navigate = useNavigate();
    const { info, pricing, loading: conferenceLoading } = useConference(confId);
    const { verifyMember, loading: verifyLoading } = useMemberVerification();
    const { getGradeLabel, getGradeCodeByName, gradesList } = useSocietyGrades(societyId);

    // Modal mode: 'member-auth' | 'non-member' | 'registration-check'
    const [mode, setMode] = useState<'member-auth' | 'non-member' | 'registration-check'>(initialMode || 'member-auth');

    // Sync mode with initialMode prop
    useEffect(() => {
        if (initialMode) {
            setMode(initialMode);
        }
    }, [initialMode]);

    // Non-member selection
    const [selectedNonMemberType, setSelectedNonMemberType] = useState<string>('');

    // Member verification form
    const [memberName, setMemberName] = useState('');
    const [memberCode, setMemberCode] = useState('');
    const [consent, setConsent] = useState(false);

    // Registration Check (Login) form
    const [checkEmail, setCheckEmail] = useState('');
    const [checkPassword, setCheckPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Verification result
    const [isVerified, setIsVerified] = useState(false);
    interface VerifiedMemberData {
        id?: string;
        memberDocId?: string;
        name?: string;
        grade?: string;
        code?: string;
        licenseNumber?: string;
        expiry?: string;
    }
    const [verifiedMemberData, setVerifiedMemberData] = useState<VerifiedMemberData | null>(null);
    const [showTermsModal, setShowTermsModal] = useState(false);

    // Get active period and prices - find the period that includes current date
    const activePeriod = pricing?.find(period => {
        if (!period.startDate || !period.endDate) return false;
        const now = new Date();
        const start = period.startDate.toDate();
        const end = period.endDate.toDate();
        return now >= start && now <= end;
    }) || pricing?.[0]; // Fallback to first period if no active period found

    // Set initial non-member type when gradesList is loaded
    useEffect(() => {
        if (gradesList.length > 0 && !selectedNonMemberType && activePeriod) {
            const firstValidGrade = gradesList.find(grade => {
                const isExcluded = EXCLUDED_MEMBER_CODES.some(excluded =>
                    grade.code.toLowerCase() === excluded.toLowerCase() ||
                    grade.name.ko === excluded ||
                    grade.name.en === excluded
                );
                return !isExcluded && activePeriod?.prices && (
                    activePeriod.prices[grade.code] !== undefined ||
                    Object.keys(activePeriod.prices).some(k => k.toLowerCase() === grade.code.toLowerCase())
                );
            });
            if (firstValidGrade) {
                setSelectedNonMemberType(firstValidGrade.code);
            }
        }
    }, [gradesList, activePeriod, selectedNonMemberType]);

    const getGradePrice = (grade: string): number => {
        console.log('[RegistrationModal] getGradePrice called with grade:', grade);
        console.log('[RegistrationModal] getGradeCodeByName function:', typeof getGradeCodeByName, getGradeCodeByName);

        if (!activePeriod?.prices || !grade) {
            console.log('[RegistrationModal] No active period or prices found, returning 0');
            return 0;
        }

        const priceObj = activePeriod.prices as Record<string, number>;
        console.log('[RegistrationModal] priceObj keys:', Object.keys(priceObj));

        // Try exact match first
        if (priceObj[grade] !== undefined) {
            console.log('[RegistrationModal] Exact match found:', grade, priceObj[grade]);
            return priceObj[grade];
        }

        // Try reverse lookup: Korean name → code
        console.log('[RegistrationModal] Calling getGradeCodeByName with:', grade);
        const codeFromName = getGradeCodeByName(grade);
        console.log('[RegistrationModal] getGradeCodeByName returned:', codeFromName);

        if (codeFromName && priceObj[codeFromName] !== undefined) {
            console.log('[RegistrationModal] Name-to-code match found:', codeFromName, priceObj[codeFromName]);
            return priceObj[codeFromName];
        }

        // Try case-insensitive match
        const lowerGrade = grade.toLowerCase();
        for (const [key, price] of Object.entries(priceObj)) {
            if (key.toLowerCase() === lowerGrade) {
                console.log('[RegistrationModal] Case-insensitive match found:', key, price);
                return price;
            }
        }

        // Try normalized match (remove spaces, hyphens)
        const normalizedGrade = lowerGrade.replace(/\s+/g, '').replace(/-/g, '');
        for (const [key, price] of Object.entries(priceObj)) {
            const normalizedKey = key.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
            if (normalizedKey === normalizedGrade) {
                console.log('[RegistrationModal] Normalized match found:', key, price);
                return price;
            }
        }

        console.log('[RegistrationModal] No match found for grade:', grade, 'returning 0');
        return 0; // Not found
    };

    const handleMemberVerification = async () => {
        if (!consent) {
            toast.error(lang === 'ko' ? '개인정보 제공에 동의해주세요.' : 'Please agree to privacy policy.');
            return;
        }
        if (!memberName || !memberCode) {
            toast.error(lang === 'ko' ? '이름과 회원번호를 입력해주세요.' : 'Please enter name and member code.');
            return;
        }

        try {
            const result = await verifyMember(
                societyId,
                memberName,
                memberCode,
                consent
            );

            if (result.success && result.memberData) {
                setIsVerified(true);
                setVerifiedMemberData(result.memberData);
                toast.success(lang === 'ko' ? '회원 인증이 완료되었습니다.' : 'Member verification successful.');
            } else {
                toast.error(result.message || (lang === 'ko' ? '회원 정보를 찾을 수 없습니다.' : 'Member not found.'));
            }
        } catch (error: unknown) {
            console.error('[RegistrationModal] Verification error:', error);
            const message = error instanceof Error ? error.message : (lang === 'ko' ? '인증에 실패했습니다.' : 'Verification failed.');
            toast.error(message);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!checkEmail || !checkPassword) {
            toast.error(lang === 'ko' ? '이메일과 비밀번호를 입력해주세요.' : 'Please enter email and password.');
            return;
        }

        setIsLoggingIn(true);
        try {
            await signInWithEmailAndPassword(firebaseAuth, checkEmail, checkPassword);
            toast.success(lang === 'ko' ? '로그인되었습니다.' : 'Logged in successfully.');

            // Redirect logic
            const destination = redirectUrl || `/${confId.split('_')[1]}/mypage`;
            onClose();
            setTimeout(() => {
                navigate(destination);
            }, 500);

        } catch (error: unknown) {
            console.error('[RegistrationModal] Login failed:', error);
            if (error instanceof Error && 'code' in error && (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password')) {
                toast.error(lang === 'ko' ? '이메일 또는 비밀번호가 일치하지 않습니다.' : 'Invalid email or password.');
            } else {
                toast.error(lang === 'ko' ? '로그인에 실패했습니다.' : 'Login failed.');
            }
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleRegisterClick = () => {
        // Open Terms Modal instead of direct navigation
        setShowTermsModal(true);
    };

    const handleTermsAgree = () => {
        // Calculate the price before navigating
        let calculatedPrice = 0;
        let calculatedGradeCode = '';

        if (mode === 'member-auth' && isVerified && verifiedMemberData) {
            // Member authenticated - calculate price for their grade
            calculatedGradeCode = verifiedMemberData.grade || '';
            calculatedPrice = getGradePrice(calculatedGradeCode);
            console.log('[RegistrationModal] Member auth price calculation:', { grade: calculatedGradeCode, price: calculatedPrice });
        } else if (mode === 'non-member') {
            // Non-member - calculate price for selected type
            calculatedGradeCode = selectedNonMemberType;
            calculatedPrice = getGradePrice(calculatedGradeCode);
            console.log('[RegistrationModal] Non-member price calculation:', { grade: calculatedGradeCode, price: calculatedPrice });
        }

        // Build registration state for RegistrationPage
        const registrationState: {
            memberVerified: boolean;
            memberName: string;
            memberGrade: string;
            memberCode: string;
            memberVerificationId?: string;
            calculatedPrice?: number; // Add calculated price
        } = {
            memberVerified: false,
            memberName: '',
            memberGrade: '',
            memberCode: ''
        };

        if (mode === 'member-auth' && isVerified && verifiedMemberData) {
            registrationState.memberVerified = true;
            registrationState.memberName = verifiedMemberData.name || memberName;
            registrationState.memberGrade = verifiedMemberData.grade || '';
            registrationState.memberCode = verifiedMemberData.code || verifiedMemberData.licenseNumber || '';
            registrationState.memberVerificationId = verifiedMemberData.id || verifiedMemberData.memberDocId || '';
            registrationState.calculatedPrice = calculatedPrice;

            // sessionStorage에도 저장하여 페이지 새로고침 시에도 인증 정보 유지
            const storageKey = `member_verification_${confId}`;
            sessionStorage.setItem(storageKey, JSON.stringify({
                id: verifiedMemberData.id || verifiedMemberData.memberDocId || '',
                societyId: societyId,
                grade: verifiedMemberData.grade || '',
                name: verifiedMemberData.name || memberName,
                code: verifiedMemberData.code || verifiedMemberData.licenseNumber || '',
                expiry: verifiedMemberData.expiry || '',
                calculatedPrice: calculatedPrice
            }));
            console.log('[RegistrationModal] Saved member verification data to sessionStorage:', storageKey);
        } else if (mode === 'non-member') {
            // Pass selected non-member type as grade
            registrationState.memberGrade = selectedNonMemberType;
            registrationState.calculatedPrice = calculatedPrice;

            // Save non-member selection to sessionStorage as well
            const storageKey = `non_member_selection_${confId}`;
            sessionStorage.setItem(storageKey, JSON.stringify({
                grade: selectedNonMemberType,
                calculatedPrice: calculatedPrice
            }));
            console.log('[RegistrationModal] Saved non-member selection to sessionStorage:', storageKey);
        }

        // Navigate to registration page with state (clean URL)
        navigate(`/${confId.split('_')[1]}/register`, { state: registrationState });
        setShowTermsModal(false);
        onClose();
    };

    const getGradeLabelByCode = (code: string): string => {
        return getGradeLabel(code, lang);
    };

    const formatPrice = (amount: number) => {
        return `₩${amount.toLocaleString()}`;
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-md md:max-w-lg max-w-[calc(100vw-2rem)] w-full mx-4 md:mx-0">
                    {conferenceLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-900 pr-8">
                                    {lang === 'ko' ? '학술대회 등록' : 'Conference Registration'}
                                </DialogTitle>
                                <DialogDescription className="text-sm sm:text-base">
                                    {lang === 'ko' ? '회원 인증 또는 비회원으로 등록을 진행합니다.' : 'Register as a member or non-member.'}
                                </DialogDescription>
                            </DialogHeader>

                            {/* Mode Selection Tabs - Mobile Optimized */}
                            <div className="bg-slate-100 p-1 sm:p-1.5 rounded-xl flex gap-1 mb-4 sm:mb-6 overflow-x-auto scrollbar-hide w-full">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode('member-auth');
                                        setIsVerified(false);
                                        setVerifiedMemberData(null);
                                    }}
                                    className={`flex-1 flex-shrink-0 px-2 py-2.5 sm:py-3 text-[11px] sm:text-sm font-medium transition-all duration-200 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${mode === 'member-auth'
                                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                        }`}
                                >
                                    <ShieldCheck className="w-4 h-4 sm:w-4 sm:h-4 mb-0.5 sm:mb-0" />
                                    <span className="leading-none">{lang === 'ko' ? '회원 인증' : 'Member Auth'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode('non-member');
                                        setIsVerified(false);
                                        setVerifiedMemberData(null);
                                    }}
                                    className={`flex-1 flex-shrink-0 px-2 py-2.5 sm:py-3 text-[11px] sm:text-sm font-medium transition-all duration-200 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${mode === 'non-member'
                                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                        }`}
                                >
                                    <User className="w-4 h-4 sm:w-4 sm:h-4 mb-0.5 sm:mb-0" />
                                    <span className="leading-none">{lang === 'ko' ? '비회원 등록' : 'Non-Member'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('registration-check')}
                                    className={`flex-1 flex-shrink-0 px-2 py-2.5 sm:py-3 text-[11px] sm:text-sm font-medium transition-all duration-200 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${mode === 'registration-check'
                                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                        }`}
                                >
                                    <LogIn className="w-4 h-4 sm:w-4 sm:h-4 mb-0.5 sm:mb-0" />
                                    <span className="leading-none">{lang === 'ko' ? '등록확인' : 'Check'}</span>
                                </button>
                            </div>

                            {/* Member Authentication Form */}
                            {mode === 'member-auth' && !isVerified && (
                                <div className="space-y-3 sm:space-y-4">
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 sm:p-4">
                                        <div className="flex items-start gap-2 sm:gap-3">
                                            <AlertCircle className="w-4 h-4 sm:w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <div className="text-xs sm:text-sm text-blue-800">
                                                <p className="font-medium mb-0.5">
                                                    {lang === 'ko' ? '회원 인증 안내' : 'Verification Guide'}
                                                </p>
                                                <p className="text-blue-600 text-xs sm:text-sm leading-relaxed">
                                                    {lang === 'ko' ? (
                                                        <>
                                                            학회 회원명과 면허번호를 입력하여 인증받으세요.
                                                            <br />
                                                            <span className="text-[11px] opacity-90">*면허번호가 없을경우 학회 홈페이지 ID를 입력하세요</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            Enter your name and license number for verification.
                                                            <br />
                                                            <span className="text-[11px] opacity-90">*If you don't have a license number, enter your society website ID</span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="memberName" className="text-xs sm:text-sm font-medium text-slate-700">
                                            {lang === 'ko' ? '이름' : 'Name'}
                                        </Label>
                                        <Input
                                            id="memberName"
                                            type="text"
                                            value={memberName}
                                            onChange={(e) => setMemberName(e.target.value)}
                                            placeholder={lang === 'ko' ? '실명 입력' : 'Enter real name'}
                                            className="mt-1 min-h-[44px]"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="memberCode" className="text-xs sm:text-sm font-medium text-slate-700">
                                            {lang === 'ko' ? '면허번호' : 'License Number'}
                                        </Label>
                                        <Input
                                            id="memberCode"
                                            type="text"
                                            value={memberCode}
                                            onChange={(e) => setMemberCode(e.target.value)}
                                            placeholder={lang === 'ko' ? '면허번호 입력' : 'Enter license number'}
                                            className="mt-1 min-h-[44px]"
                                        />
                                    </div>

                                    <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <Checkbox
                                            id="privacyConsent"
                                            checked={consent}
                                            onCheckedChange={setConsent}
                                            className="mt-0.5"
                                        />
                                        <Label
                                            htmlFor="privacyConsent"
                                            className="text-xs text-slate-600 leading-relaxed cursor-pointer"
                                        >
                                            {lang === 'ko'
                                                ? '개인정보 제공에 동의 (필수)'
                                                : 'Agree to privacy policy (Required)'}
                                        </Label>
                                    </div>

                                    <Button
                                        onClick={handleMemberVerification}
                                        disabled={verifyLoading || !consent || !memberName || !memberCode}
                                        className="w-full bg-blue-600 hover:bg-blue-700 min-h-[44px] flex items-center justify-center"
                                    >
                                        {verifyLoading ? (
                                            <span className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                {lang === 'ko' ? '인증 중...' : 'Verifying...'}
                                            </span>
                                        ) : (
                                            lang === 'ko' ? '회원 인증하기' : 'Verify Member'
                                        )}
                                    </Button>
                                </div>
                            )}

                            {/* Member Verification Result */}
                            {mode === 'member-auth' && isVerified && verifiedMemberData && (
                                <div className="space-y-3 sm:space-y-4">
                                    <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4 sm:p-6">
                                        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                                            <CheckCircle className="w-6 h-6 sm:w-8 h-6 sm:h-8 text-green-600 flex-shrink-0" />
                                            <div>
                                                <h3 className="font-bold text-green-800 text-sm sm:text-base">
                                                    {lang === 'ko' ? '회원 인증 완료' : 'Verified'}
                                                </h3>
                                                <p className="text-green-700 text-xs sm:text-sm">
                                                    {verifiedMemberData.name || memberName}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 sm:space-y-3 bg-white rounded-lg p-3 sm:p-4">
                                            <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-green-100">
                                                <span className="text-xs text-slate-600">
                                                    {lang === 'ko' ? '회원 등급' : 'Grade'}
                                                </span>
                                                <span className="font-bold text-sm sm:text-base text-slate-900">
                                                    {getGradeLabelByCode(verifiedMemberData.grade)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-green-100">
                                                <span className="text-xs text-slate-600">
                                                    {lang === 'ko' ? '등록금액' : 'Fee'}
                                                </span>
                                                <span className="font-bold text-xl sm:text-2xl text-blue-600">
                                                    {formatPrice(getGradePrice(verifiedMemberData.grade))}
                                                </span>
                                            </div>
                                            {verifiedMemberData.expiry && (
                                                <div className="flex justify-between items-center py-1.5">
                                                    <span className="text-xs text-slate-600">
                                                        {lang === 'ko' ? '유효기간' : 'Valid Until'}
                                                    </span>
                                                    <span className="font-medium text-xs sm:text-sm text-slate-900">
                                                        {verifiedMemberData.expiry}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleRegisterClick}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold min-h-[44px] flex items-center justify-center"
                                    >
                                        {lang === 'ko' ? '등록하기' : 'Register Now'}
                                    </Button>
                                </div>
                            )}



                            {/* Registration Check (Login) Check Flow */}
                            {mode === 'registration-check' && (
                                <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 sm:p-4">
                                        <div className="flex items-start gap-2 sm:gap-3">
                                            <LogIn className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <div className="text-xs sm:text-sm text-blue-800">
                                                <p className="font-medium mb-0.5">
                                                    {lang === 'ko' ? '등록 내역 확인' : 'Check Registration'}
                                                </p>
                                                <p className="text-blue-600 text-xs sm:text-sm">
                                                    {lang === 'ko'
                                                        ? '등록 시 사용한 계정으로 로그인하여 내역을 확인합니다.'
                                                        : 'Log in with your account to check registration status.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="checkEmail" className="text-xs sm:text-sm font-medium text-slate-700">
                                            {lang === 'ko' ? '이메일' : 'Email'}
                                        </Label>
                                        <Input
                                            id="checkEmail"
                                            type="email"
                                            value={checkEmail}
                                            onChange={(e) => setCheckEmail(e.target.value)}
                                            placeholder="example@email.com"
                                            className="min-h-[44px]"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="checkPassword" className="text-xs sm:text-sm font-medium text-slate-700">
                                            {lang === 'ko' ? '비밀번호' : 'Password'}
                                        </Label>
                                        <Input
                                            id="checkPassword"
                                            type="password"
                                            value={checkPassword}
                                            onChange={(e) => setCheckPassword(e.target.value)}
                                            placeholder={lang === 'ko' ? '비밀번호 입력' : 'Enter password'}
                                            className="min-h-[44px]"
                                            required
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={isLoggingIn || !checkEmail || !checkPassword}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold min-h-[44px] flex items-center justify-center"
                                    >
                                        {isLoggingIn ? (
                                            <span className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                {lang === 'ko' ? '확인 중...' : 'Checking...'}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <LogIn className="w-4 h-4" />
                                                {lang === 'ko' ? '확인하기' : 'Check Status'}
                                            </span>
                                        )}
                                    </Button>
                                </form>
                            )}

                            {/* Non-Member Flow */}
                            {mode === 'non-member' && (
                                <div className="space-y-3 sm:space-y-4">
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6">
                                        <div className="flex items-start gap-2 sm:gap-3">
                                            <User className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                                            <div className="text-xs sm:text-sm text-slate-700">
                                                <p className="font-medium mb-0.5">
                                                    {lang === 'ko' ? '비회원 등록' : 'Non-Member'}
                                                </p>
                                                <p className="text-slate-600 text-xs sm:text-sm">
                                                    {lang === 'ko'
                                                        ? '학회 회원이 아니라면 비회원으로 등록할 수 있습니다.'
                                                        : 'Register as a non-member if not a society member.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Non-member Type Selection */}
                                    <div className="space-y-2 sm:space-y-3">
                                        <Label className="text-xs sm:text-sm font-medium text-slate-700">
                                            {lang === 'ko' ? '등록 구분' : 'Type'}
                                        </Label>
                                        <RadioGroup
                                            value={selectedNonMemberType}
                                            onValueChange={setSelectedNonMemberType}
                                            className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"
                                        >
                                            {gradesList
                                                .filter(grade => {
                                                    // Exclude "회원" and "평생회원"
                                                    const isExcluded = EXCLUDED_MEMBER_CODES.some(excluded =>
                                                        grade.code.toLowerCase() === excluded.toLowerCase() ||
                                                        grade.name.ko === excluded ||
                                                        grade.name.en === excluded
                                                    );
                                                    if (isExcluded) return false;

                                                    // Show option if price exists in active period
                                                    return activePeriod?.prices && (
                                                        activePeriod.prices[grade.code] !== undefined ||
                                                        Object.keys(activePeriod.prices).some(k => k.toLowerCase() === grade.code.toLowerCase())
                                                    );
                                                })
                                                .map((grade) => {
                                                    const gradeCode = grade.code;
                                                    return (
                                                        <div
                                                            key={gradeCode}
                                                            onClick={() => setSelectedNonMemberType(gradeCode)}
                                                            onKeyUp={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    setSelectedNonMemberType(gradeCode);
                                                                }
                                                            }}
                                                            role="button"
                                                            tabIndex={0}
                                                            aria-pressed={selectedNonMemberType === gradeCode}
                                                            className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 sm:p-3 rounded-lg border cursor-pointer transition-all h-full min-h-[56px] sm:min-h-[48px] ${selectedNonMemberType === gradeCode ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}
                                                        >
                                                            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-0">
                                                                <RadioGroupItem value={gradeCode} id={`nm-${gradeCode}`} />
                                                                <Label htmlFor={`nm-${gradeCode}`} className="cursor-pointer text-sm sm:text-base font-medium text-slate-900 leading-tight">
                                                                    {getGradeLabel(gradeCode, lang)}
                                                                </Label>
                                                            </div>
                                                            <span className="text-sm sm:text-base font-bold text-slate-600 pl-7 sm:pl-0">
                                                                {formatPrice(getGradePrice(gradeCode))}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                        </RadioGroup>
                                    </div>

                                    <div className="bg-white border-2 border-slate-200 rounded-xl p-4 text-center">
                                        <div>
                                            <span className="text-xs sm:text-sm text-slate-600 mb-1">
                                                {lang === 'ko' ? '선택된 금액' : 'Selected Fee'}
                                            </span>
                                            <div className="text-2xl sm:text-3xl font-black text-slate-900">
                                                {formatPrice(getGradePrice(selectedNonMemberType))}
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleRegisterClick}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold min-h-[44px] flex items-center justify-center"
                                    >
                                        {lang === 'ko' ? '등록하기' : 'Register Now'}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Terms Agreement Modal - Rendered outside the main dialog but controlled by state */}
            {
                showTermsModal && (
                    <LegalAgreementModal
                        isOpen={showTermsModal}
                        onClose={() => setShowTermsModal(false)}
                        onAgree={handleTermsAgree}
                        lang={lang}
                        terms={info as { infoConsentText?: string; infoConsentText_en?: string; marketingConsentText?: string; marketingConsentText_en?: string; privacyPolicy?: string; privacyPolicy_en?: string; termsOfService?: string; termsOfService_en?: string } | undefined}
                    />
                )
            }
        </>
    );
};
