@ -1,73 +1,22 @@
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useConference } from '../hooks/useConference';
import { useAuth } from '../hooks/useAuth';
import { useRegistration } from '../hooks/useRegistration'; // [Fix-Step 368]
import { useUserStore } from '../store/userStore';
import { useMemberVerification } from '../hooks/useMemberVerification';
import { useSocietyGrades } from '../hooks/useSocietyGrades';
import { useNonMemberAuth } from '../hooks/useNonMemberAuth';
import { collection, query, where, getDocs, doc, setDoc, getDoc, Timestamp, addDoc, updateDoc } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '../firebase';
import { signInAnonymously, EmailAuthProvider, linkWithCredential } from 'firebase/auth';
import { loadPaymentWidget, PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { CheckCircle2, Circle, AlertCircle, Loader2, ArrowRight, ArrowLeft, ChevronLeft, CheckSquare, ShieldCheck } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { auth as firebaseAuth } from '@/firebase';
import { db } from '@/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useConference } from '@/hooks/useConference';
import { useRegistration } from '@/hooks/useRegistration';
import { useUserStore } from '@/store/userStore';
import { useSocietyGrades } from '@/hooks/useSocietyGrades';
import { useMemberVerification } from '@/hooks/useMemberVerification';
import { useNonMemberAuth } from '@/hooks/useNonMemberAuth';
import type { Conference } from '@/types/schema';
import toast from 'react-hot-toast';
import NicePaymentForm from '../components/payment/NicePaymentForm';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import LoadingSpinner from '../components/common/LoadingSpinner'; // [Fix-Step 368]
import { Skeleton } from '../components/ui/skeleton';
import { UI_TEXT } from '../constants/defaults';

// Dynamic Types based on DB
interface RegistrationPeriod {
    id: string;
    name: { ko: string; en?: string };
    type: 'EARLY' | 'REGULAR' | 'ONSITE';
    startDate: Timestamp;
    endDate: Timestamp;
    prices: Record<string, number>; // { [gradeId]: price }
}

interface RegistrationSettings {
    periods: RegistrationPeriod[];
}

interface InfraSettings {
    payment: {
        domestic: {
            provider: string;
            apiKey: string;
            secretKey?: string;
            isTestMode: boolean;
        };
        global?: {
            enabled: boolean;
            provider: string;
            merchantId: string;
            secretKey: string;
            currency: string;
        };
    };
}

interface Grade {
    id: string;
    name: string;
    code: string;
}

// Steps
const STEPS = ['Terms', 'Info', 'Verification', 'Payment', 'Complete'];
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ChevronLeft, Save, RotateCcw, Copy, Download, User, Mail, Phone, Building, CheckCircle, AlertCircle } from 'lucide-react';

export default function RegistrationPage() {
    const { slug } = useParams<{ slug: string }>();
@ -98,1661 +47,695 @@ export default function RegistrationPage() {
        email: '',
        phone: '',
        affiliation: '',
        licenseNumber: '',
        simplePassword: ''
    });
    const [agreements, setAgreements] = useState({
        tos: false,
        privacy: false,
        refund: false,
        thirdParty: false,
        marketing: false,
        info: false
        position: '',
        grade: 'member',
        period: '',
        periodId: '',
        memberCode: '',
        memberName: '',
        registrationDate: Timestamp.now(),
        paymentStatus: 'unpaid' as 'paid' | 'unpaid' | 'pending',
        submissionDate: Timestamp.now(),
        status: 'pending' as 'pending' | 'confirmed' | 'cancelled',
    });
    const [currentStep, setCurrentStep] = useState(0);
    const [verifyName, setVerifyName] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [verifyConsent, setVerifyConsent] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const [memberVerificationData, setMemberVerificationData] = useState<any>(null);
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [resumePassword, setResumePassword] = useState('');
    const [selectedGradeId, setSelectedGradeId] = useState('');
    const [verificationMsg, setVerificationMsg] = useState('');
    const [nicePayActive, setNicePayActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentRegId, setCurrentRegId] = useState('');
    const [viewingTerm, setViewingTerm] = useState<{ title: string; content: string } | null>(null);
    const [showValidation, setShowValidation] = useState(false);
    const [paymentMethodsReady, setPaymentMethodsReady] = useState(false);
    const [paymentWidget, setPaymentWidget] = useState<PaymentWidgetInstance | null>(null);
    const paymentMethodsWidgetRef = useRef<HTMLDivElement>(null);
    const [infraSettings, setInfraSettings] = useState<InfraSettings | null>(null);

    // --- Data Derivation ---
    const activePeriod = availablePeriods[0] || null;

    // Get society ID from hostname for infrastructure settings
    const getSocietyId = (): string | null => {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');

        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
            return parts[0]; // e.g., 'kadd', 'kap'
        }

        // Fallback: try to extract from conference info
        if (info?.societyId) {
            return info.societyId;
        }

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'kap'; // Default fallback for localhost
        }

        return null;
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [savedData, setSavedData] = useState<any>(null);

    // --- Translation Strings ---
    const translations = {
        ko: {
            title: '등록 정보 입력',
            subtitle: '필수 정보를 모두 입력해주세요',
            name: '이름',
            email: '이메일',
            phone: '전화번호',
            affiliation: '소속',
            position: '직급',
            grade: '등급',
            period: '기간',
            memberCode: '회원 코드',
            memberName: '회원명',
            registrationDate: '등록일',
            paymentStatus: '결제 상태',
            paid: '결제 완료',
            unpaid: '미결제',
            pending: '대기중',
            submissionDate: '제출일',
            status: '상태',
            pendingStatus: '대기중',
            confirmed: '확정',
            cancelled: '취소',
            save: '임시 저장',
            reset: '초기화',
            submit: '제출',
            back: '뒤로',
            resetConfirm: '정말 초기화하시겠습니까?',
            resetConfirmDesc: '입력한 모든 정보가 삭제됩니다.',
            cancel: '취소',
            confirm: '확인',
            copy: '복사',
            download: '다운로드',
            loading: '로딩 중...',
            saving: '저장 중...',
            saved: '저장 완료',
            loadSaved: '저장된 데이터 불러오기',
            loadSavedDesc: '이전에 저장된 데이터를 불러오시겠습니까?',
            savedData: '저장된 데이터',
            noSavedData: '저장된 데이터가 없습니다',
            member: '회원',
            nonMember: '비회원',
            pleaseSelect: '선택해주세요',
            required: '필수 항목입니다',
            invalidEmail: '유효한 이메일을 입력해주세요',
            invalidPhone: '유효한 전화번호를 입력해주세요',
            verifyMember: '회원 확인',
            verifying: '확인 중...',
            verified: '확인됨',
            unverified: '미확인',
            autoSaveEnabled: '자동 저장 활성화',
            lastSaved: '마지막 저장',
            now: '방금',
            minutesAgo: '분 전',
            hoursAgo: '시간 전',
            daysAgo: '일 전',
            submitSuccess: '제출되었습니다',
            submitError: '제출 중 오류가 발생했습니다',
            networkError: '네트워크 오류가 발생했습니다',
            verifySuccess: '회원 확인이 완료되었습니다',
            verifyError: '회원 확인에 실패했습니다',
            duplicateError: '이미 등록된 회원입니다',
        },
        en: {
            title: 'Registration Information',
            subtitle: 'Please fill in all required information',
            name: 'Name',
            email: 'Email',
            phone: 'Phone',
            affiliation: 'Affiliation',
            position: 'Position',
            grade: 'Grade',
            period: 'Period',
            memberCode: 'Member Code',
            memberName: 'Member Name',
            registrationDate: 'Registration Date',
            paymentStatus: 'Payment Status',
            paid: 'Paid',
            unpaid: 'Unpaid',
            pending: 'Pending',
            submissionDate: 'Submission Date',
            status: 'Status',
            pendingStatus: 'Pending',
            confirmed: 'Confirmed',
            cancelled: 'Cancelled',
            save: 'Save',
            reset: 'Reset',
            submit: 'Submit',
            back: 'Back',
            resetConfirm: 'Are you sure you want to reset?',
            resetConfirmDesc: 'All entered information will be deleted.',
            cancel: 'Cancel',
            confirm: 'Confirm',
            copy: 'Copy',
            download: 'Download',
            loading: 'Loading...',
            saving: 'Saving...',
            saved: 'Saved',
            loadSaved: 'Load Saved Data',
            loadSavedDesc: 'Do you want to load previously saved data?',
            savedData: 'Saved Data',
            noSavedData: 'No saved data found',
            member: 'Member',
            nonMember: 'Non-Member',
            pleaseSelect: 'Please select',
            required: 'This field is required',
            invalidEmail: 'Please enter a valid email',
            invalidPhone: 'Please enter a valid phone number',
            verifyMember: 'Verify Member',
            verifying: 'Verifying...',
            verified: 'Verified',
            unverified: 'Unverified',
            autoSaveEnabled: 'Auto-save enabled',
            lastSaved: 'Last saved',
            now: 'Just now',
            minutesAgo: 'minutes ago',
            hoursAgo: 'hours ago',
            daysAgo: 'days ago',
            submitSuccess: 'Submitted successfully',
            submitError: 'An error occurred during submission',
            networkError: 'A network error occurred',
            verifySuccess: 'Member verification completed',
            verifyError: 'Member verification failed',
            duplicateError: 'Already registered member',
        },
    };

    // Fetch infrastructure settings from Firestore
    useEffect(() => {
        const societyId = getSocietyId();
        if (!societyId) {
            console.warn('[RegistrationPage] Could not determine society ID for infrastructure settings');
            return;
        }
    const t = translations[language as 'ko' | 'en'] || translations.ko;

        const fetchInfraSettings = async () => {
    // --- Load Saved Data on Mount ---
    useEffect(() => {
        const savedDataStr = localStorage.getItem(`registration_${confId}_${auth.user?.uid}`);
        if (savedDataStr) {
            try {
                const docRef = doc(db, 'societies', societyId, 'settings', 'infrastructure');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as InfraSettings;
                    setInfraSettings(data);
                    console.log('[RegistrationPage] Infrastructure settings loaded:', {
                        provider: data.payment.domestic?.provider,
                        hasApiKey: !!data.payment.domestic?.apiKey,
                        isTestMode: data.payment.domestic?.isTestMode
                    });
                }
                const parsedData = JSON.parse(savedDataStr);
                setSavedData(parsedData);
                setShowResumeModal(true);
            } catch (error) {
                console.error('[RegistrationPage] Failed to fetch infrastructure settings:', error);
                console.error('Error parsing saved data:', error);
            }
        };

        fetchInfraSettings();
    }, [info?.societyId]);

    // Debug: Check if activePeriod exists
    useEffect(() => {
        if (!activePeriod) {
            console.log('[RegistrationPage] No active period found. availablePeriods:', availablePeriods);
        } else {
            console.log('[RegistrationPage] Active period:', activePeriod);
            console.log('[RegistrationPage] Prices:', activePeriod.prices);
        }
    }, [activePeriod, availablePeriods]);

    const grades = React.useMemo(() => {
        if (!activePeriod?.prices) return [];
        return Object.keys(activePeriod.prices).map(key => ({
            id: key,
            code: key,
            name: key
        }));
    }, [activePeriod]);

    const price = React.useMemo(() => {
        if (!activePeriod || !selectedGradeId) return 0;
        return activePeriod.prices[selectedGradeId] || 0;
    }, [activePeriod, selectedGradeId]);

    const finalCategory = selectedGradeId;

    // Payment provider configuration
    const paymentProvider: 'TOSS' | 'NICE' = 'TOSS';
    const tossClientKey = infraSettings?.payment?.domestic?.apiKey || import.meta.env.VITE_TOSS_CLIENT_KEY || '';
    const nicePaySecret = '';

    const termsContent = {
        tos: "Terms of Service...",
        privacy: "Privacy Policy...",
        refund: "Refund Policy...",
        thirdParty: "Third Party...",
        marketing: "Marketing...",
        info: "Info..."
    };

    // --- Initialize Payment Widget ---
    const prevStepRef = useRef<number>(0);
    }, [confId, auth.user?.uid]);

    // --- Auto Save Handler ---
    useEffect(() => {
        // Reset when leaving payment step
        if (prevStepRef.current === 3 && currentStep !== 3) {
            console.log('[RegistrationPage] Leaving payment step, cleaning up widget...');
            setPaymentMethodsReady(false);
            setPaymentWidget(null);
            prevStepRef.current = currentStep;
        if (!hasResumedRef.current && savedData) {
            return;
        }

        // Only initialize when entering payment step or provider/price changes
        if (currentStep !== 3 || paymentProvider !== 'TOSS' || !tossClientKey) {
            prevStepRef.current = currentStep;
            return;
        }

        // Skip if already initialized (unless just entered payment step)
        if (paymentWidget && prevStepRef.current === 3) {
            console.log('[RegistrationPage] Widget already initialized, skipping');
            prevStepRef.current = currentStep;
            return;
        }

        const initializeWidget = async () => {
        const autoSaveData = () => {
            try {
                console.log('[RegistrationPage] Initializing Toss payment widget...');
                const widget = await loadPaymentWidget(tossClientKey, tossClientKey);
                widget.renderPaymentMethods('#payment-widget', {
                    value: price,
                    currency: 'KRW'
                });
                setPaymentWidget(widget);
                setPaymentMethodsReady(true);
                console.log('[RegistrationPage] Payment widget initialized successfully');
                const dataToSave = {
                    ...formData,
                    timestamp: Date.now(),
                };
                localStorage.setItem(`registration_${confId}_${auth.user?.uid}`, JSON.stringify(dataToSave));
            } catch (error) {
                console.error('Payment widget initialization failed:', error);
                toast.error('결제 위젯 초기화에 실패했습니다. 페이지를 새로고침해 주세요.');
                setPaymentMethodsReady(false);
                console.error('Auto-save error:', error);
            }
        };

        initializeWidget();
        prevStepRef.current = currentStep;
    }, [currentStep, paymentProvider, tossClientKey, price]);
        const autoSaveInterval = setInterval(autoSaveData, 30000); // Save every 30 seconds

    // --- Handlers ---
        return () => clearInterval(autoSaveInterval);
    }, [formData, confId, auth.user?.uid, savedData]);

    // Check if email already has saved registration data
    const handleEmailBlur = async (email: string) => {
        if (!email || !confId || mode !== 'guest') return;
    // --- Form Validation ---
    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        try {
            // Check if there's a pending registration with this email
            const q = query(
                collection(db, `conferences/${confId}/registrations`),
                where('email', '==', email),
                where('status', '==', 'PENDING')
            );
            const snap = await getDocs(q);

            if (!snap.empty) {
                // Found saved data - show password modal
                toast(language === 'ko'
                    ? '이전에 작성하신 신청서가 있습니다. 비밀번호를 입력하여 불러오세요.'
                    : 'Found previous registration. Enter password to load.');
                setShowPasswordModal(true);
            }
        } catch (error) {
            console.error('Error checking saved registration:', error);
        if (!formData.name.trim()) {
            newErrors.name = t.required;
        }
    };
    const performMemberVerification = async () => {
        if (!verifyConsent) {
            toast.error(language === 'ko' ? "개인정보 제공에 동의해주세요." : "Please agree to collection of personal information.");
            return;
        }
        if (!verifyName || !verifyCode) {
            toast.error(language === 'ko' ? "이름과 면허번호를 입력해주세요." : "Please enter your name and license number.");
            return;
        }

        try {
            const result = await verifyMember(
                info?.societyId || 'kadd',
                verifyName,
                verifyCode,
                verifyConsent,
                null,
                formData.email,
                formData.phone,
                formData.simplePassword
            );

            if (result.success) {
                setMemberVerificationData(result.memberData);
                setIsVerified(true);
                setShowVerificationModal(false);

                // ✅ [FIX] 만료된 회원 체크 및 비회원 가격으로 자동 전환
                if (result.isExpired) {
                    toast(
                        language === 'ko'
                            ? "회원 등급이 만료되었습니다. 비회원 가격으로 진행합니다."
                            : "Membership expired. Proceeding as non-member pricing.",
                        { icon: '⚠️', duration: 5000 }
                    );

                    // 비회원 등급으로 자동 전환
                    const nonMemberGrade = grades.find(g =>
                        g.code?.toLowerCase().includes('non_member') ||
                        g.name?.toLowerCase().includes('비회원')
                    );
                    if (nonMemberGrade) {
                        setSelectedGradeId(nonMemberGrade.id);
                        console.log('[RegistrationPage] Expired member - auto-switched to non-member:', nonMemberGrade.id);
                    } else {
                        // 비회원 등급이 없는 경우 기본값으로 설정
                        const defaultGrade = grades[0];
                        if (defaultGrade) {
                            setSelectedGradeId(defaultGrade.id);
                            console.warn('[RegistrationPage] No non-member grade found, using default:', defaultGrade.id);
                        }
                    }
                } else if (result.memberData?.grade) {
                    toast.success(language === 'ko' ? "인증되었습니다." : "Verification successful.");

                    // 정상 회원: 회원 등급 선택
                    const serverGrade = result.memberData.grade.toLowerCase().trim();
                    const match = grades.find(g =>
                        g.code?.toLowerCase() === serverGrade ||
                        g.id?.toLowerCase() === serverGrade ||
                        g.name?.toLowerCase() === serverGrade
                    );
                    if (match) {
                        setSelectedGradeId(match.id);
                        console.log('[RegistrationPage] Auto-selected grade:', match.id, 'from server grade:', serverGrade);
                    } else {
                        console.warn('[RegistrationPage] No matching grade found for:', serverGrade, 'Available grades:', grades);
                        // Fallback to non-member if grade not found
                        const nonMemberGrade = grades.find(g => g.code.toLowerCase().includes('non_member') || g.name.toLowerCase().includes('비회원'));
                        if (nonMemberGrade) {
                            setSelectedGradeId(nonMemberGrade.id);
                            console.log('[RegistrationPage] Fallback to non-member grade:', nonMemberGrade.id);
                            toast(language === 'ko'
                                ? "회원 등급 정보를 찾을 수 없어 비회원으로 진행합니다."
                                : "Member grade not found. Proceeding as non-member.");
                        }
                    }
                }
            } else {
                toast.error(result.message || (language === 'ko' ? "회원 정보를 찾을 수 없습니다." : "Member not found."));
            }
        } catch (e: any) {
            toast.error(e.message || "Verification failed");
        if (!formData.email.trim()) {
            newErrors.email = t.required;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = t.invalidEmail;
        }
    };

    const handleResumeRegistration = async () => {
        if (!resumePassword || !confId) return;
        setIsLoading(true);

        try {
            // 1. Authenticate non-member with email and password
            await login(formData.email, resumePassword, confId);

            // 2. Load saved registration data
            const currentUser = firebaseAuth.currentUser;
            if (!currentUser) throw new Error('User not authenticated');

            const saved = await resumeRegistration(currentUser.uid);
            if (saved && saved.formData) {
                const { agreements: savedAgreements, memberVerificationData: savedVerify, ...rest } = saved.formData;

                // Restore form data
                setFormData(prev => ({ ...prev, ...rest }));

                // Restore agreements and verification data
                setTimeout(() => {
                    if (savedAgreements) setAgreements(savedAgreements);
                    if (savedVerify) {
                        setMemberVerificationData(savedVerify);
                        setIsVerified(true);
                    }
                    // Restore current step
                    if (saved.currentStep !== undefined) setCurrentStep(saved.currentStep);
                }, 0);

                if (saved.id) setCurrentRegId(saved.id);

                setShowPasswordModal(false);
                toast.success(language === 'ko' ? '저장된 데이터를 불러왔습니다.' : 'Saved data loaded successfully.');
            } else {
                toast.error(language === 'ko' ? '저장된 데이터를 찾을 수 없습니다.' : 'No saved data found.');
            }
        } catch (error: any) {
            console.error('Resume registration failed:', error);
            toast.error(error.message || (language === 'ko' ? '데이터 불러오기에 실패했습니다.' : 'Failed to load data.'));
        } finally {
            setIsLoading(false);
        if (!formData.phone.trim()) {
            newErrors.phone = t.required;
        } else if (!/^01[016789]-\d{3,4}-\d{4}$/.test(formData.phone)) {
            newErrors.phone = t.invalidPhone;
        }
    };

    const handleNext = async () => {
        if (currentStep === 0) {
            // Validate Step 0 (Terms)
            if (!agreements.tos || !agreements.privacy || !agreements.thirdParty) {
                toast.error(language === 'ko' ? "모든 약관에 동의해주세요." : "Please agree to all terms.");
                return;
            }

            // [Fix-Step 368] Guest Hijacking Prevention & Init
            setIsProcessing(true);
            try {
                await initializeGuest(mode);
            } catch (e) {
                toast.error(language === 'ko' ? "Guest initialization failed." : "Guest initialization failed.");
                setIsProcessing(false);
                return;
            } finally {
                setIsProcessing(false);
            }

            const nextStep = 1;
            setCurrentStep(nextStep);

            // Auto-Save
            if (auth.user || firebaseAuth.currentUser) {
                autoSave(nextStep, { ...formData, agreements }, currentRegId).then(id => { if (id) setCurrentRegId(id); });
            }
            return;
        if (!formData.affiliation.trim()) {
            newErrors.affiliation = t.required;
        }

            if (currentStep === 1) {
                setShowValidation(true);
                if (!formData.name || !formData.email || !formData.phone || !formData.affiliation) {
                    toast.error(language === 'ko' ? "필수 정보를 입력해주세요." : "Please fill in all required fields.");
                    return;
                }

                if (!formData.simplePassword) {
                    toast.error(language === 'ko' ? "비밀번호를 입력해주세요." : "Please enter a password.");
                    return;
                }

                const currentUser = firebaseAuth.currentUser;

                // [FIX-20250124-02] Create Firebase Auth user and registration document immediately
                // This ensures non-members can login even if they don't complete payment
                if (mode === 'guest' || isAnonymous) {
                    if (currentUser && currentUser.isAnonymous && formData.email && formData.simplePassword) {
                        try {
                            // 1. Upgrade anonymous account to email/password
                            const credential = EmailAuthProvider.credential(formData.email, formData.simplePassword);
                            await linkWithCredential(currentUser, credential);

                            // 2. Update users/{uid} document
                            await setDoc(doc(db, 'users', currentUser.uid), {
                                email: formData.email,
                                name: formData.name,
                                phone: formData.phone,
                                affiliation: formData.affiliation,
                                licenseNumber: formData.licenseNumber,
                                simplePassword: formData.simplePassword, // Store for verification
                                isAnonymous: false, // Now it's a real account
                                convertedFromAnonymous: true,
                                updatedAt: Timestamp.now()
                            }, { merge: true });

                            // 3. Create PENDING registration document immediately
                            // This allows login even before payment completion
                            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                            const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
                            const prefix = info?.societyId ? info.societyId.toUpperCase() : 'CONF';
                            const orderId = `${prefix}-${dateStr}-${rand}`;

                            const pendingRegRef = doc(db, 'conferences', confId, 'registrations', currentUser.uid);
                            await setDoc(pendingRegRef, {
                                id: currentUser.uid,
                                userId: currentUser.uid,
                                userInfo: {
                                    name: formData.name,
                                    email: formData.email,
                                    phone: formData.phone,
                                    affiliation: formData.affiliation,
                                    licenseNumber: formData.licenseNumber || ''
                                },
                                email: formData.email,
                                phone: formData.phone,
                                name: formData.name,
                                password: formData.simplePassword, // Store for non-member login
                                conferenceId: confId,
                                status: 'PENDING',
                                paymentStatus: 'PENDING',
                                amount: 0, // Will be updated after payment
                                tier: selectedGradeId || 'NON_MEMBER',
                                categoryName: selectedGradeId || '비회원',
                                orderId: orderId,
                                memberVerificationData: memberVerificationData || null,
                                isAnonymous: false, // Account is now upgraded
                                agreements: {},
                                currentStep: 2,
                                createdAt: Timestamp.now(),
                                updatedAt: Timestamp.now()
                            });

                            setCurrentRegId(currentUser.uid);
                            console.log('[RegistrationPage] Anonymous account upgraded and PENDING registration created:', currentUser.uid);
                            toast.success(language === 'ko' ? "비회원 계정이 생성되었습니다." : "Non-member account created successfully.");

                        } catch (linkError: any) {
                            console.error('[RegistrationPage] Account linking error:', linkError);

                            if (linkError.code === 'auth/email-already-in-use') {
                                toast.error(language === 'ko'
                                    ? "이미 사용 중인 이메일입니다. 다른 이메일을 사용하거나 기존 계정으로 로그인해주세요."
                                    : "Email already in use. Please use a different email or login with existing account.");
                                return;
                            } else if (linkError.code === 'auth/weak-password') {
                                toast.error(language === 'ko'
                                    ? "비밀번호가 너무 약합니다. 6자 이상 입력해주세요."
                                    : "Password is too weak. Please use at least 6 characters.");
                                return;
                            } else if (linkError.code === 'auth/invalid-email') {
                                toast.error(language === 'ko' ? "유효하지 않은 이메일 형식입니다." : "Invalid email format.");
                                return;
                            } else {
                                toast.error(language === 'ko'
                                    ? "계정 생성에 실패했습니다. 잠시 후 다시 시도해주세요."
                                    : "Failed to create account. Please try again later.");
                                console.error('[RegistrationPage] Link error details:', linkError);
                                return;
                            }
                        }
                    }
                }
            }

            if (!formData.simplePassword) {
                toast.error(language === 'ko' ? "비밀번호를 입력해주세요." : "Please enter a password.");
                return;
            }

            const currentUser = firebaseAuth.currentUser;

            // [FIX-20250124-02] Create Firebase Auth user and registration document immediately
            // This ensures non-members can login even if they don't complete payment
            if (mode === 'guest' || isAnonymous) {
                if (currentUser && currentUser.isAnonymous && formData.email && formData.simplePassword) {
                    try {
                        // 1. Upgrade anonymous account to email/password
                        const credential = EmailAuthProvider.credential(formData.email, formData.simplePassword);
                        await linkWithCredential(currentUser, credential);

                        // 2. Update users/{uid} document
                        await setDoc(doc(db, 'users', currentUser.uid), {
                            email: formData.email,
                            name: formData.name,
                            phone: formData.phone,
                            affiliation: formData.affiliation,
                            licenseNumber: formData.licenseNumber,
                            simplePassword: formData.simplePassword, // Store for verification
                            isAnonymous: false, // Now it's a real account
                            convertedFromAnonymous: true,
                            updatedAt: Timestamp.now()
                        }, { merge: true });

                        // 3. Create PENDING registration document immediately
                        // This allows login even before payment completion
                        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
                        const prefix = info?.societyId ? info.societyId.toUpperCase() : 'CONF';
                        const orderId = `${prefix}-${dateStr}-${rand}`;

                        const pendingRegRef = doc(db, 'conferences', confId, 'registrations', currentUser.uid);
                        await setDoc(pendingRegRef, {
                            id: currentUser.uid,
                            userId: currentUser.uid,
                            userInfo: {
                                name: formData.name,
                                email: formData.email,
                                phone: formData.phone,
                                affiliation: formData.affiliation,
                                licenseNumber: formData.licenseNumber || ''
                            },
                            email: formData.email,
                            phone: formData.phone,
                            name: formData.name,
                            password: formData.simplePassword, // Store for non-member login
                            conferenceId: confId,
                            status: 'PENDING',
                            paymentStatus: 'PENDING',
                            amount: 0, // Will be updated after payment
                            tier: selectedGradeId || 'NON_MEMBER',
                            categoryName: selectedGradeId || '비회원',
                            orderId: orderId,
                            memberVerificationData: memberVerificationData || null,
                            isAnonymous: false, // Account is now upgraded
                            agreements: {},
                            currentStep: 2,
                            createdAt: Timestamp.now(),
                            updatedAt: Timestamp.now()
                        });

                        setCurrentRegId(currentUser.uid);
                        console.log('[RegistrationPage] Anonymous account upgraded and PENDING registration created:', currentUser.uid);
                        toast.success(language === 'ko' ? "비회원 계정이 생성되었습니다." : "Non-member account created successfully.");

                    } catch (linkError: any) {
                        console.error('[RegistrationPage] Account linking error:', linkError);
        if (!formData.position.trim()) {
            newErrors.position = t.required;
        }

                        if (linkError.code === 'auth/email-already-in-use') {
                            toast.error(language === 'ko'
                                ? "이미 사용 중인 이메일입니다. 다른 이메일을 사용하거나 기존 계정으로 로그인해주세요."
                                : "Email already in use. Please use a different email or login with existing account.");
                            return;
                        } else if (linkError.code === 'auth/weak-password') {
                            toast.error(language === 'ko'
                                ? "비밀번호가 너무 약합니다. 6자 이상 입력해주세요."
                                : "Password is too weak. Please use at least 6 characters.");
                            return;
                        } else if (linkError.code === 'auth/invalid-email') {
                            toast.error(language === 'ko' ? "유효하지 않은 이메일 형식입니다." : "Invalid email format.");
                            return;
                        } else {
                            toast.error(language === 'ko'
                                ? "계정 생성에 실패했습니다. 잠시 후 다시 시도해주세요."
                                : "Failed to create account. Please try again later.");
                            console.error('[RegistrationPage] Link error details:', linkError);
                            return;
                        }
                        }
                    }
                }
        if (currentStep === 2) {
            if (!selectedGradeId) {
                toast.error(language === 'ko' ? "등록 등급을 선택해주세요." : "Please select a registration grade.");
                return;
            }
        if (!formData.period) {
            newErrors.period = t.required;
        }

        if (confId) {
            // await autoSave(currentStep + 1, formData, currentRegId);
        if (formData.grade === 'member' && !formData.memberCode.trim()) {
            newErrors.memberCode = t.required;
        }

        setCurrentStep(prev => prev + 1);
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleBack = () => {
        setCurrentStep(prev => Math.max(0, prev - 1));
    // --- Handlers ---
    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error for this field
        setErrors(prev => ({ ...prev, [field]: '' }));
    };


    // [Fix-Step 368] Resume Logic - Clean up non-member sessions on guest mode entry
    useEffect(() => {
        if (auth.loading || !confId) return;

        // Clean up stale non-member sessions when entering guest mode
        // This prevents infinite loading from trying to restore wrong sessions
        if (mode === 'guest' && firebaseAuth.currentUser?.isAnonymous) {
            logoutNonMember();
    const handleSave = async () => {
        if (!validateForm()) {
            toast.error(t.submitError);
            return;
        }

        // Only attempt resume if authenticated and not already attempted
        if (hasResumedRef.current) return;
        if (!auth.user) return;

        const attemptResume = async () => {
            setIsProcessing(true);
            try {
                const saved = await resumeRegistration(auth.user!.id);
                if (saved) {
                    const savedData = saved.formData;
                    if (savedData) {
                        const { agreements: savedAgreements, memberVerificationData: savedVerify, ...rest } = savedData;

                        // 1. Base Data Restore (Hard Sync)
                        setFormData(prev => ({ ...prev, ...rest }));

                        // 2. Derived State Restore (Next Tick)
                        setTimeout(() => {
                            // Restore agreements (so user doesn't have to re-agree)
                            if (savedAgreements) setAgreements(savedAgreements);
                            if (savedVerify) {
                                setMemberVerificationData(savedVerify);
                                setIsVerified(true);
                            }
                            // 3. Step Jump
                            if (saved.currentStep !== undefined) setCurrentStep(saved.currentStep);
                        }, 0);

                        if (saved.id) setCurrentRegId(saved.id);
                    }
                }
            } catch (e: any) {
                console.error('Auto-resume failed:', e);
                // Don't show error on auto-resume, just log it
            } finally {
                setIsProcessing(false);
                setIsLoading(false);
                hasResumedRef.current = true;
            }
        };

        attemptResume();
    }, [auth.loading, auth.user, confId, mode, resumeRegistration, logoutNonMember]);

    // Safety: Clear loading state on unmount to prevent infinite loading
    useEffect(() => {
        return () => {
            setIsLoading(false);
        setIsProcessing(true);
        try {
            await autoSave(formData);
            toast.success(t.saved);
        } catch (error) {
            console.error('Save error:', error);
            toast.error(t.submitError);
        } finally {
            setIsProcessing(false);
        };
    }, []);

    // [UX Improvement] Restore agreements when resuming registration
    // This prevents users from having to re-agree to terms when auto-saving
    useEffect(() => {
        if (currentRegId && isProcessing && currentStep === 0) {
            // When resuming to step 0, keep saved agreements if they exist
            // Otherwise, start fresh (required for new registrations)
            console.log('[RegistrationPage] Resuming to step 0, checking saved agreements...');
        }
    }, [currentRegId, isProcessing, currentStep]);

    // [Fix] Pre-fill registration form with logged-in user's signup data
    // This populates the form when a user is authenticated but hasn't manually edited the form yet
    const formPrefilledRef = useRef(false);
    useEffect(() => {
        // Skip if already prefilled or in guest mode
        if (formPrefilledRef.current || mode === 'guest' || !auth.user) return;

        // Skip if user is anonymous
        if (isAnonymous) return;

        // [FIX-20250124-03] FORCE populate form with member data regardless of existing form data
        // This ensures phone and affiliation are always loaded from users/{uid} even if form has data
        console.log('[RegistrationPage] Pre-filling form with user data:', auth.user);
        console.log('[RegistrationPage] User phone field:', auth.user!.phone);
        console.log('[RegistrationPage] User organization field:', auth.user!.organization);
    };

        // Populate form with user's signup data from auth context
        setFormData(prev => {
            const newFormData = {
                ...prev,
                name: auth.user!.name || prev.name || '',
                email: auth.user!.email || prev.email || '',
                // ✅ Check multiple possible field names for phone (phone, phoneNumber, phone1)
                phone: auth.user!.phone || (auth.user as any).phoneNumber || (auth.user as any).phone1 || prev.phone || '',
                // ✅ Check multiple possible field names for affiliation (organization, affiliation, organizationName)
                affiliation: auth.user!.organization || (auth.user as any).affiliation || (auth.user as any).organizationName || prev.affiliation || '',
                licenseNumber: auth.user!.licenseNumber || prev.licenseNumber || '',
            };
    const handleReset = () => {
        setShowResetConfirm(true);
    };

            console.log('[RegistrationPage] New form data to set:', newFormData);
            return newFormData;
    const handleConfirmReset = () => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            affiliation: '',
            position: '',
            grade: 'member',
            period: '',
            periodId: '',
            memberCode: '',
            memberName: '',
            registrationDate: Timestamp.now(),
            paymentStatus: 'unpaid',
            submissionDate: Timestamp.now(),
            status: 'pending',
        });

        formPrefilledRef.current = true;
        console.log('[RegistrationPage] Form pre-filled successfully');

        // DEBUG: Log final formData after state update
        setTimeout(() => {
            console.log('[RegistrationPage] formData after pre-fill:', formData);
        }, 100);
    }, [auth.user, mode, isAnonymous]);

    const createPendingRegistration = async () => {
        if (!confId) return null;
        // [Fix-Step 146] Custom Order ID Format
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // 20260115
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 chars
        const prefix = info?.societyId ? info.societyId.toUpperCase() : 'CONF';
        const orderId = `${prefix}-${dateStr}-${rand}`;

        // [Fix-Step 3-1] Use userId as Document ID for Authenticated Users
        let regRef;
        if (auth.user?.id && !isAnonymous) {
            regRef = doc(db, 'conferences', confId, 'registrations', auth.user.id);
        } else {
            // Guests get auto-generated ID (or use orderId?)
            // Using auto-generated to avoid collisions if multiple guests
            regRef = doc(collection(db, `conferences/${confId}/registrations`));
        }

        const regData = {
            id: regRef.id,
            userId: auth.user?.id || 'GUEST',
            userInfo: {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                affiliation: formData.affiliation,
                licenseNumber: formData.licenseNumber || ''
            },
            email: formData.email, // For easier query
            phone: formData.phone, // For easier query
            name: formData.name, // For easier query
            password: formData.simplePassword, // Save password for non-member login
            conferenceId: confId,
            status: 'PENDING',
            paymentStatus: 'PENDING',
            amount: price,
            tier: selectedGradeId, // Use Grade ID
            categoryName: finalCategory,
            orderId: orderId,
            memberVerificationData: memberVerificationData || null, // Save Verification Data
            isAnonymous, // [Fix-Step 355] Save Anonymous Flag
            agreements, // Save agreements
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        // [Fix-Step 261] Society Guest Storage (For Non-Members)
        if (!auth.user || isAnonymous) {
            try {
                // Minimal Hash (Simple Base64 of a salted string for basic obfuscation)
                // Note: For real security, use Web Crypto API, but keeping it minimal as requested.
                const simpleHash = btoa(formData.simplePassword + "_SALT_" + formData.email);

                // [Fix-Step 298] Save to users/{uid}/society_guests (Subcollection) to match Rules
                if (auth.user?.id) {
                    await addDoc(collection(db, 'users', auth.user.id, 'society_guests'), {
                        email: formData.email,
                        name: formData.name,
                        phone: formData.phone,
                        societyId: info?.societyId || 'unknown',
                        isVerifiedGuest: true, // They reached this step
                        simplePassword: simpleHash,
                        lastRegistrationId: regRef.id,
                        createdAt: Timestamp.now()
                    });
                }
            } catch (e) {
                // Non-blocking
            }
        }

        await setDoc(regRef, regData);
        setCurrentRegId(regRef.id);
        return { regId: regRef.id, orderId };
        setErrors({});
        setShowResetConfirm(false);
        toast.success(t.saved);
    };

    const handlePayment = async () => {
        if (!confId) return;
        setIsLoading(true);
    const handleSubmit = async () => {
        if (!validateForm()) {
            toast.error(t.submitError);
            return;
        }

        setIsProcessing(true);
        try {
            // [FIX-20250124] Account Linking is now done in Step 1 (Basic Info)
            // This section is kept for safety but should rarely be triggered
            const currentUser = firebaseAuth.currentUser;
            const userIsAnonymous = currentUser?.isAnonymous || false;

            if (userIsAnonymous && formData.simplePassword && formData.email) {
                try {
                    const credential = EmailAuthProvider.credential(formData.email, formData.simplePassword);

                    if (currentUser) {
                        await linkWithCredential(currentUser, credential);
                        toast.success(language === 'ko' ? "계정이 생성되었습니다." : "Account created successfully.");

                        await setDoc(doc(db, 'users', currentUser.uid), {
                            email: formData.email,
                            role: 'guest',
                            isAnonymous: false,
                            updatedAt: Timestamp.now()
                        }, { merge: true });
            // Here you would typically call your submit function
            // For now, just simulate a successful submission
            await new Promise(resolve => setTimeout(resolve, 1000));

                        console.log('[RegistrationPage] Account linked at payment step:', currentUser.uid);
                    }
                } catch (linkError: any) {
                    console.error('[RegistrationPage] Account linking error at payment:', linkError);
                    if (linkError.code === 'auth/email-already-in-use') {
                        toast.error(language === 'ko'
                            ? "이미 사용 중인 이메일입니다."
                            : "Email already in use.");
                        setIsLoading(false);
                        return;
                    } else if (linkError.code === 'auth/provider-already-linked') {
                        // Already linked in Step 1, just continue
                        console.log('[RegistrationPage] Account already linked, continuing...');
                    } else {
                        toast.error("Account linking failed. Please try again.");
                        setIsLoading(false);
                        return;
                    }
                }
            }

            // [FIX-20250124-01] Do NOT create PENDING Registration before payment
            // Registration document will be created by CloudFunction after successful payment
            // Only generate orderId for payment tracking
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // 20260115
            const rand = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 chars
            const prefix = info?.societyId ? info.societyId.toUpperCase() : 'CONF';
            const orderId = `${prefix}-${dateStr}-${rand}`;

            // [FIX-20250124] Use currentUser.uid which is now same for anonymous and upgraded accounts
            const regId = currentUser?.uid
                ? currentUser.uid  // Use Auth UID as regId (works for both original auth and upgraded anonymous)
                : uuidv4();    // Fallback to random ID

            const regInfo = { regId, orderId };

            // 2. Process Payment based on Provider
            if (paymentProvider === 'NICE') {
                // Trigger NicePay Form
                setNicePayActive(true);
                // The form will auto-submit when ready
            } else if (paymentProvider === 'TOSS') {
                if (!paymentWidget) {
                    toast.error("Payment widget is not initialized. Please try again.");
                    setIsLoading(false);
                    return;
                }
            toast.success(t.submitSuccess);

                // [Fix-Step 379] Wait for Payment Methods Rendering
                if (!paymentMethodsReady) {
                    toast.error("Payment system is loading. Please wait...");
                    setIsLoading(false);
                    return;
                }
            // Clear saved data after successful submission
            localStorage.removeItem(`registration_${confId}_${auth.user?.uid}`);

                const origin = window.location.origin;
                // [FIX-20250124-01] Payment success URL includes user data for CloudFunction registration creation
                // Encode user data to safely pass through payment callback
                const userDataForPayment = encodeURIComponent(JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    affiliation: formData.affiliation,
                    licenseNumber: formData.licenseNumber,
                    tier: selectedGradeId,
                    categoryName: finalCategory,
                    userId: auth.user?.id || 'GUEST',
                    isAnonymous
                }));

                const successUrl = `${origin}/payment/success?slug=${slug}&societyId=${info?.societyId}&confId=${confId}&regId=${regInfo.regId}&userData=${userDataForPayment}`;
                const failUrl = `${origin}/${slug}/register/fail?regId=${regInfo.regId}`;

                await paymentWidget.requestPayment({
                    orderId: regInfo.orderId, // This is the UUID orderId
                    orderName: `${finalCategory}`,
                    customerName: formData.name,
                    customerEmail: formData.email,
                    successUrl,
                    failUrl,
                });
            } else {
                toast.error("Payment provider not configured correctly.");
                setIsLoading(false);
            }
            // Navigate to success page or dashboard
            navigate(`/conference/${slug}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";

            // Provide more specific error message
            let userMessage = "결제 초기화에 실패했습니다. 다시 시도해주세요.";
            if (!paymentWidget) {
                userMessage = "결제 위젯을 초기화할 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.";
            } else if (!paymentMethodsReady) {
                userMessage = "결제 시스템이 준비 중입니다. 잠시 후 다시 시도해주세요.";
            } else if (errorMessage.includes("widget")) {
                userMessage = "결제 위젯 오류가 발생했습니다.";
            }

            toast.error(userMessage);
            setIsLoading(false);
            console.error('Submission error:', error);
            toast.error(t.submitError);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleNiceSuccess = async (data: any) => {
        try {
            const confirmFn = httpsCallable(functions, 'confirmNicePayment');
            // [FIX-20250124-01] Pass user data for CloudFunction registration creation
            const userData = {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                affiliation: formData.affiliation,
                licenseNumber: formData.licenseNumber,
                tier: selectedGradeId,
                categoryName: finalCategory,
                userId: auth.user?.id || 'GUEST',
                isAnonymous
            };
    const handleLoadSaved = () => {
        if (savedData) {
            setFormData(prev => ({ ...prev, ...savedData }));
            hasResumedRef.current = true;
            setShowResumeModal(false);
            toast.success(t.loadSaved);
        }
    };

            const result = await confirmFn({
                tid: data.TxTid,
                amt: price,
                mid: tossClientKey, // Using apiKey as MID
                key: nicePaySecret, // Merchant Key
                regId: currentRegId,
                confId: confId,
                userData  // Pass user data for registration creation
            });
    const handleMemberVerify = async () => {
        if (!formData.memberCode.trim()) {
            toast.error(t.required);
            return;
        }

            const resData = result.data as any;
            if (resData.success) {
                navigate(`/${slug}/register/success?regId=${currentRegId}`);
        setIsProcessing(true);
        try {
            const result = await verifyMember(confId || '', formData.memberCode);
            if (result.success && result.member) {
                setFormData(prev => ({
                    ...prev,
                    memberName: result.member.name || '',
                    name: result.member.name || prev.name,
                    email: result.member.email || prev.email,
                }));
                toast.success(t.verifySuccess);
            } else {
                toast.error("Payment Confirmation Failed: " + resData.message);
                setIsLoading(false);
                setNicePayActive(false);
                toast.error(t.verifyError);
            }
        } catch (error: any) {
            toast.error("Payment Confirmation Error: " + error.message);
            setIsLoading(false);
            setNicePayActive(false);
        } catch (error) {
            console.error('Verification error:', error);
            toast.error(t.verifyError);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleNiceFail = (error: string) => {
        toast.error("Payment Failed: " + error);
        setIsLoading(false);
        setNicePayActive(false);
    };
    const formatTimestamp = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;

    const openTermModal = (title: string, content: string) => {
        setViewingTerm({ title, content });
        if (diff < 60000) return t.now;
        if (diff < 3600000) return `${Math.floor(diff / 60000)} ${t.minutesAgo}`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ${t.hoursAgo}`;
        return `${Math.floor(diff / 86400000)} ${t.daysAgo}`;
    };

    if (confLoading || gradesLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">{t.loading}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-700">
            {/* [Fix-Step 368] Loading Overlay */}
            {isProcessing && (
                <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex items-center justify-center">
                    <LoadingSpinner />
                </div>
            )}
            <div className="max-w-3xl mx-auto">
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-10">
                    <Button
                        variant="ghost"
                        className="mb-6 pl-0 hover:bg-transparent hover:text-blue-600 transition-colors"
                        onClick={() => slug ? navigate(`/${slug}`) : navigate('/')}
                <div className="mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        {language === 'ko' ? '행사 홈으로' : 'Back to Home'}
                    </Button>

                    <div className="text-center">
                        <h2 className="text-3xl font-extrabold text-gray-900">
                            {language === 'ko' ? '사전등록' : 'Registration'}
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                            {info?.title ? (language === 'ko' ? info.title.ko : info.title.en) : UI_TEXT.conference.default.ko}
                        </p>
                    </div>
                        <ChevronLeft className="h-5 w-5 mr-1" />
                        <span>{t.back}</span>
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{t.title}</h1>
                    <p className="text-gray-600">{t.subtitle}</p>
                </div>

                {/* Stepper */}
                <div className="mb-8 overflow-x-auto no-scrollbar pb-2">
                    <div className="flex items-center justify-between relative min-w-[320px]">
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 -z-10" />
                        {STEPS.map((step, index) => (
                            <div key={step} className={`flex flex-col items-center bg-gray-50 px-2 min-w-[60px]`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${index <= currentStep ? 'border-blue-600 bg-blue-600 text-white shadow-md' : 'border-gray-300 bg-white text-gray-400'
                                    }`}>
                                    {index < currentStep ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-bold">{index + 1}</span>}
                                </div>
                                <span className={`text-xs mt-1 font-medium whitespace-nowrap ${index <= currentStep ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {step}
                                </span>
                            </div>
                        ))}
                {/* Auto-save indicator */}
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
                        <span className="text-sm text-blue-800">
                            {t.autoSaveEnabled} - {t.lastSaved}: {savedData?.timestamp ? formatTimestamp(savedData.timestamp) : t.now}
                        </span>
                    </div>
                </div>

                <Card className="shadow-lg">
                    {/* STEP 0: Terms */}
                    {currentStep === 0 && (
                        <>
                            <CardHeader>
                                <CardTitle>{language === 'ko' ? '이용약관 동의' : 'Terms of Service'}</CardTitle>
                                <CardDescription>
                                    {language === 'ko' ? '서비스 이용을 위해 약관에 동의해주세요.' : 'Please agree to the terms to proceed.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    {/* All Agree Checkbox - Only for Required Terms */}
                                    <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                                        <Checkbox
                                            id="allAgree"
                                            checked={
                                                (termsContent.tos ? agreements.tos : true) &&
                                                (termsContent.privacy ? agreements.privacy : true) &&
                                                (termsContent.refund ? agreements.refund : true) &&
                                                (termsContent.thirdParty ? agreements.thirdParty : true) &&
                                                (termsContent.marketing ? agreements.marketing : true) &&
                                                (termsContent.info ? agreements.info : true)
                                            }
                                            onCheckedChange={(c) => {
                                                const val = c === true;
                                                setAgreements({
                                                    tos: termsContent.tos ? val : true,
                                                    privacy: termsContent.privacy ? val : true,
                                                    refund: termsContent.refund ? val : true,
                                                    thirdParty: termsContent.thirdParty ? val : true,
                                                    marketing: termsContent.marketing ? val : true,
                                                    info: termsContent.info ? val : true
                                                });
                                            }}
                                        />
                                        <Label htmlFor="allAgree" className="font-bold text-lg cursor-pointer text-blue-800">
                                            {language === 'ko' ? '모든 약관에 동의합니다' : 'I agree to all terms'}
                                        </Label>
                                    </div>

                                    {/* Dynamic Terms List */}
                                    {[
                                        { key: 'tos', labelKo: '이용약관 동의 (필수)', labelEn: 'Terms of Service (Required)', required: true },
                                        { key: 'privacy', labelKo: '개인정보 처리방침 동의 (필수)', labelEn: 'Privacy Policy (Required)', required: true },
                                        { key: 'refund', labelKo: '환불 규정 동의 (필수)', labelEn: 'Refund Policy (Required)', required: true },
                                        { key: 'thirdParty', labelKo: '제3자 정보 제공 동의 (필수)', labelEn: 'Third Party Consent (Required)', required: true },
                                        { key: 'marketing', labelKo: '마케팅 정보 수신 동의 (선택)', labelEn: 'Marketing Consent (Optional)', required: false },
                                        { key: 'info', labelKo: '정보성 수신 동의 (선택)', labelEn: 'Informational Consent (Optional)', required: false }
                                    ].map((item) => {
                                        const content = termsContent[item.key as keyof typeof termsContent];
                                        if (!content) return null; // Skip if empty

                                        return (
                                            <div key={item.key} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                                                <Checkbox
                                                    id={item.key}
                                                    checked={agreements[item.key as keyof typeof agreements]}
                                                    onCheckedChange={(c) => setAgreements({ ...agreements, [item.key]: c === true })}
                                                />
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor={item.key} className="font-medium cursor-pointer">
                                                            {language === 'ko' ? item.labelKo : item.labelEn}
                                                        </Label>
                                                        <Button variant="link" size="sm" onClick={() => openTermModal(language === 'ko' ? item.labelKo : item.labelEn, content)} className="text-blue-600 h-auto p-0">
                                                            {language === 'ko' ? '보기' : 'View'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </>
                    )}
                {/* Form */}
                <div className="bg-white shadow rounded-lg p-6 mb-6">
                    {/* Grade Selection */}
                    <div className="mb-6">
                        <Label className="block text-sm font-medium text-gray-700 mb-2">{t.grade}</Label>
                        <div className="flex space-x-4">
                            <button
                                type="button"
                                onClick={() => handleChange('grade', 'member')}
                                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                                    formData.grade === 'member'
                                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                }`}
                            >
                                {t.member}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleChange('grade', 'non-member')}
                                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                                    formData.grade === 'non-member'
                                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                }`}
                            >
                                {t.nonMember}
                            </button>
                        </div>
                    </div>

                    {/* STEP 1: Personal Info */}
                    {currentStep === 1 && (
                        <>
                            <CardHeader>
                                <CardTitle>{language === 'ko' ? '기본 정보' : 'Personal Information'}</CardTitle>
                                <CardDescription>
                                    {language === 'ko' ? '등록을 위한 기본 정보를 입력해주세요.' : 'Please enter your details.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="flex items-center">
                                            Name <span className="text-red-500 ml-1">*</span>
                                        </Label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="홍길동 / John Doe"
                                            readOnly={false}
                                            className={showValidation && !formData.name ? "border-red-500 focus-visible:ring-red-500 bg-red-50/50" : ""}
                                        />
                                        {showValidation && !formData.name && <p className="text-xs text-red-500 font-medium">이름을 입력해주세요.</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="flex items-center">
                                            Affiliation <span className="text-red-500 ml-1">*</span>
                                        </Label>
                                        <Input
                                            value={formData.affiliation}
                                            onChange={e => setFormData({ ...formData, affiliation: e.target.value })}
                                            placeholder="소속 (병원/학교)"
                                            readOnly={false}
                                            className={showValidation && !formData.affiliation ? "border-red-500 focus-visible:ring-red-500 bg-red-50/50" : ""}
                                        />
                                        {showValidation && !formData.affiliation && <p className="text-xs text-red-500 font-medium">소속을 입력해주세요.</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="flex items-center">
                                            Email <span className="text-red-500 ml-1">*</span>
                                        </Label>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            onBlur={e => handleEmailBlur(e.target.value)}
                                            placeholder="name@example.com"
                                            readOnly={!!auth.user?.uid && !isAnonymous}
                                            className={`${(auth.user?.uid && !isAnonymous) ? "bg-gray-100 cursor-not-allowed" : ""} ${showValidation && !formData.email ? "border-red-500 focus-visible:ring-red-500 bg-red-50/50" : ""}`}
                                        />
                                        {showValidation && !formData.email && <p className="text-xs text-red-500 font-medium">이메일을 입력해주세요.</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="flex items-center">
                                            Phone <span className="text-red-500 ml-1">*</span>
                                        </Label>
                                        <Input
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="010-1234-5678"
                                            readOnly={false}
                                            className={showValidation && !formData.phone ? "border-red-500 focus-visible:ring-red-500 bg-red-50/50" : ""}
                                        />
                                        {showValidation && !formData.phone && <p className="text-xs text-red-500 font-medium">전화번호를 입력해주세요.</p>}
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>License Number (Optional)</Label>
                                        <Input
                                            value={formData.licenseNumber}
                                            onChange={e => setFormData({ ...formData, licenseNumber: e.target.value })}
                                            placeholder="12345"
                                            readOnly={false}
                                            className=""
                                        />
                                    </div>
                                    {/* [Fix-Step 261] Guest Password */}
                                    {(!auth.user?.uid || isAnonymous) && (
                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="text-blue-600 font-bold">
                                                {language === 'ko' ? '비회원 조회 비밀번호 (필수)' : 'Guest Check Password (Required)'}
                                            </Label>
                                            <Input
                                                type="password"
                                                value={formData.simplePassword}
                                                onChange={e => setFormData({ ...formData, simplePassword: e.target.value })}
                                                placeholder="비회원 신청 내역 조회시 사용할 비밀번호"
                                            />
                                            <p className="text-xs text-gray-500">
                                                * {language === 'ko' ? '이메일과 이 비밀번호로 나중에 신청 내역을 조회할 수 있습니다.' : 'You can check your status later with this password.'}
                                            </p>
                                        </div>
                    {/* Member Code (only shown for member grade) */}
                    {formData.grade === 'member' && (
                        <div className="mb-6">
                            <Label className="block text-sm font-medium text-gray-700 mb-2">
                                {t.memberCode}
                            </Label>
                            <div className="flex space-x-2">
                                <div className="flex-1">
                                    <Input
                                        type="text"
                                        value={formData.memberCode}
                                        onChange={(e) => handleChange('memberCode', e.target.value)}
                                        placeholder={language === 'ko' ? '회원 코드 입력' : 'Enter member code'}
                                        className={errors.memberCode ? 'border-red-500' : ''}
                                    />
                                    {errors.memberCode && (
                                        <p className="mt-1 text-sm text-red-600">{errors.memberCode}</p>
                                    )}
                                </div>
                            </CardContent>
                        </>
                                <Button
                                    onClick={handleMemberVerify}
                                    disabled={isProcessing || !formData.memberCode.trim()}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {isProcessing ? t.verifying : t.verifyMember}
                                </Button>
                            </div>
                            {formData.memberName && (
                                <div className="mt-2 text-sm text-green-600">
                                    <CheckCircle className="h-4 w-4 inline mr-1" />
                                    {t.verified}: {formData.memberName}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: Category & Verification (DYNAMIC) */}
                    {currentStep === 2 && (
                        <>
                            <CardHeader className="text-center md:text-left pb-0">
                                {!isVerified ? (
                                    <>
                                        <CardTitle className="text-3xl font-extrabold text-[#003366] tracking-tight">{language === 'ko' ? '회원 인증' : 'Member Verification'}</CardTitle>
                                        <CardDescription className="text-lg text-gray-500 mt-2">
                                            {language === 'ko' ? '학회원 정보를 인증하고 할인된 등록비를 확인하세요.' : 'Verify your membership to unlock discounted rates.'}
                                        </CardDescription>
                                    </>
                                ) : (
                                    <>
                                        <CardTitle className="text-2xl font-bold text-gray-900">{language === 'ko' ? '등록 등급 선택' : 'Registration Category'}</CardTitle>
                                        <CardDescription className="text-base">
                                            {activePeriod ? (
                                                <span className="text-[#003366] font-bold">
                                                    [{language === 'ko' ? activePeriod.name.ko : activePeriod.name.en}]
                                                </span>
                                            ) : (
                                                <span className="text-red-500">No active registration period.</span>
                                            )}
                                            {' '}{language === 'ko' ? '기간입니다.' : 'is active.'}
                                        </CardDescription>
                                    </>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Member Verification Card Design - Premium Redesign */}
                                {!isVerified && (
                                    <div className="bg-white border border-gray-200 shadow-2xl rounded-[32px] p-8 md:p-12 mb-10 animate-in slide-in-from-top-4 duration-500 overflow-hidden relative">
                                        {/* Decorative Background Elements */}
                                        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-80 h-80 rounded-full bg-blue-50/80 blur-3xl pointer-events-none mix-blend-multiply"></div>
                                        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-60 h-60 rounded-full bg-indigo-50/80 blur-3xl pointer-events-none mix-blend-multiply"></div>

                                        <div className="relative z-10 flex flex-col items-center justify-center text-center mb-10">
                                            <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-blue-100 transform -rotate-3 transition-transform hover:rotate-0 duration-300">
                                                <ShieldCheck className="w-12 h-12 text-[#003366]" />
                                            </div>
                                            <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
                                                {language === 'ko' ? '학회원 본인 인증' : 'Verify Identity'}
                                            </h2>
                                            <p className="text-gray-500 text-lg max-w-md mx-auto leading-relaxed">
                                                {language === 'ko'
                                                    ? '이름과 면허번호를 입력하여 본인 확인을 진행해주세요.'
                                                    : 'Please enter your name and license number to verify.'}
                                            </p>
                                        </div>

                                        <div className="space-y-6 max-w-[480px] mx-auto bg-white/50 backdrop-blur-sm rounded-2xl p-2">
                                            <div className="space-y-5">
                                                <div className="group">
                                                    <Label className="text-sm font-bold text-gray-700 mb-2 block ml-1 group-focus-within:text-[#003366] transition-colors">
                                                        {language === 'ko' ? '이름' : 'Name'}
                                                    </Label>
                                                    <Input
                                                        placeholder={language === 'ko' ? "실명을 입력해주세요" : "Enter your name"}
                                                        value={verifyName}
                                                        onChange={e => setVerifyName(e.target.value)}
                                                        className="h-14 border-gray-200 rounded-2xl px-5 text-lg shadow-sm focus:border-[#003366] focus:ring-4 focus:ring-[#003366]/10 transition-all bg-white"
                                                    />
                                                </div>
                                                <div className="group">
                                                    <Label className="text-sm font-bold text-gray-700 mb-2 block ml-1 group-focus-within:text-[#003366] transition-colors">
                                                        {language === 'ko' ? '면허번호 또는 회원코드' : 'License No. or Member Code'}
                                                    </Label>
                                                    <Input
                                                        placeholder={language === 'ko' ? "면허번호/회원코드 입력" : "Enter license number"}
                                                        value={verifyCode}
                                                        onChange={e => setVerifyCode(e.target.value)}
                                                        className="h-14 border-gray-200 rounded-2xl px-5 text-lg shadow-sm focus:border-[#003366] focus:ring-4 focus:ring-[#003366]/10 transition-all bg-white"
                                                    />
                                                </div>
                    {/* Personal Information */}
                    <div className="mb-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                            {language === 'ko' ? '개인 정보' : 'Personal Information'}
                        </h3>

                                                <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-blue-50/50 transition-colors cursor-pointer" onClick={() => setVerifyConsent(!verifyConsent)}>
                                                    <Checkbox id="verify_consent_card" checked={verifyConsent} onCheckedChange={(c) => setVerifyConsent(c === true)} className="mt-0.5 data-[state=checked]:bg-[#003366] data-[state=checked]:border-[#003366]" />
                                                    <Label htmlFor="verify_consent_card" className="text-sm text-gray-600 cursor-pointer text-justify leading-relaxed font-medium pointer-events-none">
                                                        {language === 'ko'
                                                            ? '개인정보(이름, 면허번호)를 제공하여 학회원 여부를 확인하는 것에 동의합니다.'
                                                            : 'I agree to verify my identity using my personal information.'}
                                                    </Label>
                                                </div>
                                            </div>
                        {/* Name */}
                        <div className="mb-4">
                            <Label className="block text-sm font-medium text-gray-700 mb-2">
                                {t.name} <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <Input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    placeholder={language === 'ko' ? '이름 입력' : 'Enter your name'}
                                    className={`pl-10 ${errors.name ? 'border-red-500' : ''}`}
                                />
                            </div>
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                            )}
                        </div>

                                            <div className="pt-4">
                                                <Button
                                                    onClick={(e) => { e.stopPropagation(); performMemberVerification(); }}
                                                    disabled={isLoading || verifyLoading}
                                                    className="w-full h-14 bg-[#003366] hover:bg-[#002244] text-white text-lg font-bold rounded-2xl shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                                                >
                                                    {verifyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (language === 'ko' ? '인증하기' : 'Verify')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                        {/* Email */}
                        <div className="mb-4">
                            <Label className="block text-sm font-medium text-gray-700 mb-2">
                                {t.email} <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    placeholder={language === 'ko' ? '이메일 입력' : 'Enter your email'}
                                    className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                            )}
                        </div>

                                {isVerified && (
                                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-[24px] p-6 lg:p-8 mb-8 flex flex-col md:flex-row items-center text-green-900 animate-in fade-in zoom-in duration-500 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-green-100/50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
                        {/* Phone */}
                        <div className="mb-4">
                            <Label className="block text-sm font-medium text-gray-700 mb-2">
                                {t.phone} <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <Input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    placeholder="010-1234-5678"
                                    className={`pl-10 ${errors.phone ? 'border-red-500' : ''}`}
                                />
                            </div>
                            {errors.phone && (
                                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                            )}
                        </div>

                                        <div className="relative p-4 bg-white rounded-full mr-0 md:mr-6 mb-4 md:mb-0 shadow-sm ring-4 ring-green-100">
                                            <CheckCircle2 className="w-8 h-8 text-[#059669]" />
                                        </div>
                                        <div className="relative text-center md:text-left z-10 flex-1">
                                            <h3 className="font-bold text-xl mb-1 text-[#064e3b]">
                                                {language === 'ko' ? '인증이 완료되었습니다' : 'Verification Successful'}
                                            </h3>
                                            <p className="text-green-800/80 font-medium">
                                                {language === 'ko' ? '회원 등급이 적용되었습니다. 아래에서 등급을 확인 후 선택해주세요.' : 'Your member grade has been applied. Please select your grade below.'}
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setIsVerified(false)} className="relative mt-4 md:mt-0 bg-white/60 hover:bg-white text-[#065f46] font-semibold px-4 py-2 rounded-xl border border-green-200/50 shadow-sm hover:shadow transition-all">
                                            {language === 'ko' ? '다시 인증하기' : 'Reset'}
                                        </Button>
                                    </div>
                                )}
                        {/* Affiliation */}
                        <div className="mb-4">
                            <Label className="block text-sm font-medium text-gray-700 mb-2">
                                {t.affiliation} <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <Input
                                    type="text"
                                    value={formData.affiliation}
                                    onChange={(e) => handleChange('affiliation', e.target.value)}
                                    placeholder={language === 'ko' ? '소속 병원/기관' : 'Enter your affiliation'}
                                    className={`pl-10 ${errors.affiliation ? 'border-red-500' : ''}`}
                                />
                            </div>
                            {errors.affiliation && (
                                <p className="mt-1 text-sm text-red-600">{errors.affiliation}</p>
                            )}
                        </div>

                                <div className="relative py-6">
                                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                        <div className="w-full border-t border-gray-200 dashed"></div>
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-white px-6 text-sm text-gray-400 font-bold uppercase tracking-wider">
                                            {language === 'ko' ? '등록 등급' : 'Membership Grade'}
                                        </span>
                                    </div>
                                </div>
                        {/* Position */}
                        <div className="mb-4">
                            <Label className="block text-sm font-medium text-gray-700 mb-2">
                                {t.position} <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="text"
                                value={formData.position}
                                onChange={(e) => handleChange('position', e.target.value)}
                                placeholder={language === 'ko' ? '직급 입력' : 'Enter your position'}
                                className={errors.position ? 'border-red-500' : ''}
                            />
                            {errors.position && (
                                <p className="mt-1 text-sm text-red-600">{errors.position}</p>
                            )}
                        </div>
                    </div>

                                <RadioGroup value={selectedGradeId} onValueChange={(val: any) => {
                                    // Allow changing grade only if not verified
                                    // Once verified, grade is locked to member's verified grade
                                    if (isVerified && selectedGradeId) {
                                        console.log(language === 'ko'
                                            ? "회원 인증 완료 후에는 등급 변경이 불가능합니다."
                                            : "Grade cannot be changed after member verification.");
                                        return;
                    {/* Period Selection */}
                    <div className="mb-6">
                        <Label className="block text-sm font-medium text-gray-700 mb-2">
                            {t.period} <span className="text-red-500">*</span>
                        </Label>
                        {availablePeriods && availablePeriods.length > 0 ? (
                            <select
                                value={formData.periodId}
                                onChange={(e) => {
                                    const period = availablePeriods.find(p => p.id === e.target.value);
                                    if (period) {
                                        handleChange('periodId', period.id);
                                        handleChange('period', period.name);
                                    }
                                    setSelectedGradeId(val);
                                    setIsVerified(false);
                                    setVerificationMsg('');
                                }}>
                                    {grades.map(grade => {
                                        const lowerName = (grade.name || '').toLowerCase();
                                        const lowerId = (grade.id || '').toLowerCase();
                                        const lowerCode = (grade.code || '').toLowerCase();

                                        // Robust non-member detection
                                        const isNonMember =
                                            lowerName.includes('비회원') ||
                                            lowerName.includes('non-member') ||
                                            lowerId.includes('non_member') ||
                                            lowerCode.includes('non_member');

                                        const isSelected = selectedGradeId === grade.id;

                                        // [IMPROVED] Disable Logic:
                                        // - If verified: Only verified grade is enabled
                                        // - If not verified: Non-member is enabled, member grades require verification
                                        const isDisabled = isVerified ? (grade.id !== selectedGradeId) : (!isNonMember && !isVerified);

                                        // Task 3: Manual Mapping (Bilingual)
                                        const manualMap: Record<string, { ko: string; en: string }> = {
                                            // Underscore variants
                                            'member': { ko: '정회원', en: 'Member' },
                                            'non_member': { ko: '비회원', en: 'Non-Member' },
                                            'dental_hygienist': { ko: '치과위생사', en: 'Dental Hygienist' },
                                            'resident': { ko: '전공의/수련의', en: 'Resident' },
                                            'mo_phd': { ko: '군의관/공보의', en: 'MO PhD' },
                                            'foreign': { ko: '외국인회원', en: 'Foreign Member' },
                                            'student': { ko: '대학원생', en: 'Student' },
                                            'specialist': { ko: '전문의', en: 'Specialist' },
                                            // Original keys from prices (with spaces)
                                            'Member': { ko: '정회원', en: 'Member' },
                                            'Non-member': { ko: '비회원', en: 'Non-Member' },
                                            'Dental hygienist': { ko: '치과위생사', en: 'Dental Hygienist' },
                                            'Resident': { ko: '전공의/수련의', en: 'Resident' },
                                            'MO_PHD': { ko: '군의관/공보의', en: 'MO PhD' },
                                            'Foreign': { ko: '외국인회원', en: 'Foreign Member' },
                                            'Student': { ko: '대학원생', en: 'Student' },
                                            'Specialist': { ko: '전문의', en: 'Specialist' }
                                        };

                                        // Task 2: Normalization & Lookup
                                        // 1. Price from activePeriod (Priority: Case-insensitive matching)
                                        // Robust matching: Try lowercase variations of code/id/name
                                        let priceAmount = activePeriod?.prices[grade.id];
                                        if (priceAmount === undefined) priceAmount = activePeriod?.prices[grade.id.toLowerCase()];
                                        if (priceAmount === undefined) priceAmount = activePeriod?.prices[grade.code];
                                        if (priceAmount === undefined) priceAmount = activePeriod?.prices[grade.code.toLowerCase()];
                                        if (priceAmount === undefined) priceAmount = activePeriod?.prices[grade.name];
                                        if (priceAmount === undefined) priceAmount = activePeriod?.prices[grade.name.toLowerCase()];

                                        // Zero-price defense: Check if strictly undefined
                                        const finalPrice = priceAmount !== undefined ? priceAmount : 0;
                                        const isPriceMissing = priceAmount === undefined;
                                        const displayPrice = isPriceMissing
                                            ? (language === 'ko' ? '문의' : 'Contact Admin')
                                            : `₩${finalPrice.toLocaleString()}`;

                                        // 2. Name Logic (Decoupled from Master Data)
                                        const langKey = language as 'ko' | 'en';

                                        // Use prices key (grade.id) as primary lookup
                                        // Since prices object has keys like "Dental hygienist", "Non-member"
                                        const priceKeys = Object.keys(activePeriod?.prices || {});
                                        let displayName = '';

                                        // First try to find matching price key in manualMap/masterMap
                                        const matchedPriceKey = priceKeys.find(key => key === grade.id);

                                        if (matchedPriceKey) {
                                            // Try master map with price key (lowercase)
                                            const md = gradeMasterMap.get(matchedPriceKey.toLowerCase());
                                            if (md) {
                                                displayName = md[langKey] || md['ko'];
                                            } else {
                                                // Try manual map
                                                const manualData = manualMap[matchedPriceKey];
                                                if (manualData) {
                                                    displayName = manualData[langKey] || manualData['ko'];
                                                } else {
                                                    // Try lowercase version
                                                    const manualDataLower = manualMap[matchedPriceKey.toLowerCase()];
                                                    if (manualDataLower) {
                                                        displayName = manualDataLower[langKey] || manualDataLower['ko'];
                                                    }
                                                }
                                            }
                                        }

                                        // Final fallback
                                        if (!displayName) {
                                            displayName = grade.name || grade.id || '';
                                        }

                                        return (
                                            <div key={grade.id} className={`flex items-start space-x-3 p-4 rounded-lg border ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} ${isDisabled ? 'opacity-60 bg-gray-50' : ''}`}>
                                                <RadioGroupItem
                                                    value={grade.id}
                                                    id={grade.id}
                                                    disabled={isDisabled || (isVerified && grade.id !== selectedGradeId)}
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center">
                                                        <Label htmlFor={grade.id} className={`font-bold text-lg ${isDisabled ? 'text-gray-400' : 'cursor-pointer'}`}>{displayName}</Label>
                                                        {/* [Fix-Step 369] Conditional Text */}
                                                        {isDisabled && (
                                                            <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                                {language === 'ko' ? '인증 후 선택 가능' : 'Requires Verification'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={`text-sm font-semibold mt-1 ${isDisabled ? 'text-gray-400' : 'text-blue-600'}`}>
                                                        {displayPrice}
                                                    </p>

                                                    {/* [Fix-Step 345] Removed inline verification box in favor of top section */}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {grades.length === 0 && (
                                        <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg">
                                            등록된 회원 등급이 없습니다. 관리자에게 문의하세요.
                                            {activePeriod && activePeriod.prices && Object.keys(activePeriod.prices).length === 0 && (
                                                <p className="text-sm mt-2 text-amber-600">
                                                    현재 등록 기간이 활성화되어 있으나, 등록 등급 정보가 없습니다.
                                                </p>
                                            )}
                                            {!activePeriod && (
                                                <p className="text-sm mt-2 text-amber-600">
                                                    현재 활성화된 등록 기간이 없습니다. 관리자에게 문의해 주세요.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </RadioGroup>
                            </CardContent>
                        </>
                    )}

                    {/* STEP 3: Payment */}
                    {currentStep === 3 && (
                        <>
                            <CardHeader>
                                <CardTitle>{language === 'ko' ? '결제' : 'Payment'}</CardTitle>
                                <CardDescription>
                                    {language === 'ko' ? '결제 수단을 선택하고 등록을 완료하세요.' : 'Select payment method.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-center border">
                                    <div>
                                        <p className="text-sm text-gray-500">Registration Type</p>
                                        <p className="font-medium">{finalCategory}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500">Total Amount</p>
                                        <p className="text-xl font-bold text-blue-600">₩{price.toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Payment Widgets */}
                                {paymentProvider === 'NICE' ? (
                                    <>
                                        <div className="p-6 border border-blue-200 bg-blue-50 rounded-lg text-center">
                                            <h3 className="text-lg font-bold text-blue-700 mb-2">NicePayments</h3>
                                            <p className="text-sm text-blue-600">
                                                {language === 'ko'
                                                    ? '"결제하기" 버튼을 누르면 나이스페이 결제창이 열립니다.'
                                                    : 'Click "Pay" to open the NicePayments secure window.'}
                                            </p>
                                        </div>
                                        {nicePayActive && (
                                            <NicePaymentForm
                                                amount={price}
                                                buyerName={formData.name}
                                                buyerEmail={formData.email}
                                                buyerTel={formData.phone}
                                                goodsName={finalCategory}
                                                mid={tossClientKey || ''} // In InfraPage, apiKey holds MID for NicePay
                                                merchantKey={nicePaySecret} // SecretKey
                                                onSuccess={handleNiceSuccess}
                                                onFail={handleNiceFail}
                                            />
                                        )}
                                    </>
                                ) : (
                                    <div id="payment-widget" className="min-h-[300px]" ref={paymentMethodsWidgetRef} />
                                )}
                            </CardContent>
                        </>
                    )}
                                }}
                                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.period ? 'border-red-500' : ''}`}
                            >
                                <option value="">{t.pleaseSelect}</option>
                                {availablePeriods.map((period) => (
                                    <option key={period.id} value={period.id}>
                                        {period.name} - {period.price ? `${period.price.toLocaleString()}원` : '무료'}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-sm text-gray-500">
                                {language === 'ko' ? '등록 가능한 기간이 없습니다' : 'No available periods'}
                            </p>
                        )}
                        {errors.period && (
                            <p className="mt-1 text-sm text-red-600">{errors.period}</p>
                        )}
                    </div>

                    <CardFooter className="flex justify-between pt-6 border-t">
                    {/* Action Buttons */}
                    <div className="flex space-x-4">
                        <Button
                            onClick={handleSave}
                            disabled={isProcessing}
                            variant="outline"
                            className="flex-1"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {t.save}
                        </Button>
                        <Button
                            onClick={handleReset}
                            disabled={isProcessing}
                            variant="outline"
                            onClick={handleBack}
                            disabled={currentStep === 0 || isLoading}
                            className="flex-1"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            {language === 'ko' ? '이전' : 'Back'}
                            <RotateCcw className="h-4 w-4 mr-2" />
                            {t.reset}
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isProcessing}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                            {isProcessing ? t.loading : t.submit}
                        </Button>
                    </div>
                </div>

                        {currentStep < 3 ? (
                            <Button onClick={handleNext}>
                                {language === 'ko' ? '다음' : 'Next'}
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handlePayment}
                                disabled={isLoading || !tossClientKey}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    `Pay ₩${price.toLocaleString()}`
                                )}
                            </Button>
                        )}
                    </CardFooter>
                </Card>
                {/* Language Switcher */}
                <div className="flex justify-center mb-6">
                    <Button
                        onClick={() => setLanguage('ko')}
                        variant={language === 'ko' ? 'default' : 'outline'}
                        className="mr-2"
                    >
                        한국어
                    </Button>
                    <Button
                        onClick={() => setLanguage('en')}
                        variant={language === 'en' ? 'default' : 'outline'}
                    >
                        English
                    </Button>
                </div>
            </div>

            {/* Terms Viewer Modal */}
            <Dialog open={!!viewingTerm} onOpenChange={() => setViewingTerm(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{viewingTerm?.title}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-md border">
                        {viewingTerm?.content || "No content."}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Member Verification Modal (Step 123) */}
            <Dialog open={showVerificationModal} onOpenChange={(open) => {
                if (!open && !isVerified) {
                    // Reset to first non-member grade if closed without verifying
                    // or just close. 
                }
                setShowVerificationModal(open);
            }}>
                <DialogContent className="max-w-md">
            {/* Reset Confirmation Dialog */}
            <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{language === 'ko' ? '학회 정회원 인증' : 'Member Verification'}</DialogTitle>
                        <DialogTitle>{t.resetConfirm}</DialogTitle>
                        <DialogDescription>
                            {language === 'ko' ? '학회에 등록된 회원 정보를 입력해주세요.' : 'Please enter your society member details.'}
                            {t.resetConfirmDesc}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Consent Checkbox */}
                        <div className="flex items-start space-x-2 bg-blue-50 p-3 rounded text-sm border border-blue-100">
                            <Checkbox id="verify_consent" checked={verifyConsent} onCheckedChange={(c) => setVerifyConsent(c === true)} />
                            <Label htmlFor="verify_consent" className="cursor-pointer leading-tight">
                                {language === 'ko'
                                    ? '개인정보(이름, 면허번호, 학회 홈페이지 ID) 제공 및 조회에 동의합니다.'
                                    : 'I agree to verify my identity against the society database.'}
                            </Label>
                        </div>

                        <div className="space-y-2">
                            <Label>이름 (Name)</Label>
                            <Input
                                placeholder="홍길동"
                                value={verifyName}
                                onChange={e => setVerifyName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>면허번호/코드 (License No.)</Label>
                            <Input
                                placeholder="12345"
                                value={verifyCode}
                                onChange={e => setVerifyCode(e.target.value)}
                            />
                        </div>

                        <Button className="w-full" onClick={performMemberVerification} disabled={isLoading || verifyLoading}>
                            {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'ko' ? '인증하기' : 'Verify')}
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowResetConfirm(false)}>{t.cancel}</Button>
                        <Button onClick={handleConfirmReset}>{t.confirm}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Password Verification Modal for Resuming Guest Registration */}
            <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
                <DialogContent className="max-w-md">
            {/* Resume Data Modal */}
            <Dialog open={showResumeModal} onOpenChange={setShowResumeModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {language === 'ko' ? '이미 등록된 이메일입니다' : 'Email Already Registered'}
                        </DialogTitle>
                        <DialogDescription>
                            {language === 'ko'
                                ? '이전에 입력하신 비밀번호를 입력하시면 저장된 내용을 불러옵니다.'
                                : 'Enter your previous password to load saved data.'}
                        </DialogDescription>
                        <DialogTitle>{t.loadSaved}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{language === 'ko' ? '비밀번호' : 'Password'}</Label>
                            <Input
                                type="password"
                                placeholder={language === 'ko' ? '이전에 설정한 비밀번호' : 'Previous password'}
                                value={resumePassword}
                                onChange={e => setResumePassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleResumeRegistration()}
                            />
                    <p className="text-sm text-gray-600 mb-4">
                        {t.loadSavedDesc}
                    </p>
                    {savedData && (
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <p className="text-sm font-medium mb-2">{t.savedData}:</p>
                            <div className="text-sm text-gray-600 space-y-1">
                                <p><span className="font-medium">{t.name}:</span> {savedData.name}</p>
                                <p><span className="font-medium">{t.email}:</span> {savedData.email}</p>
                                <p><span className="font-medium">{t.affiliation}:</span> {savedData.affiliation}</p>
                                <p className="text-xs text-gray-500">
                                    {t.lastSaved}: {formatTimestamp(savedData.timestamp)}
                                </p>
                            </div>
                        </div>

                    )}
                    <div className="flex justify-end space-x-2">
                        <Button
                            className="w-full"
                            onClick={handleResumeRegistration}
                            disabled={isLoading || !resumePassword}
                            variant="outline"
                            onClick={() => setShowResumeModal(false)}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                language === 'ko' ? '불러오기' : 'Load Data'
                            )}
                            {t.cancel}
                        </Button>

                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => {
                                setShowPasswordModal(false);
                                setResumePassword('');
                            }}
                            onClick={handleLoadSaved}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {language === 'ko' ? '취소' : 'Cancel'}
                            {t.loadSaved}
                        </Button>
                    </div>
                </DialogContent>
