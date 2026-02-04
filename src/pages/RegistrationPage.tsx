import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useConference } from '../hooks/useConference';
import { useAuth } from '../hooks/useAuth';
import { useRegistration } from '../hooks/useRegistration';
import { useUserStore } from '../store/userStore';
import { doc, setDoc, getDoc, Timestamp, getDocs, collection } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { loadPaymentWidget, PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { CheckCircle2, Loader2, Save, CreditCard, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import NicePaymentForm from '../components/payment/NicePaymentForm';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { WideFooterPreview } from '../components/conference/wide-preview/WideFooterPreview';
import { normalizeUserData, toFirestoreUserData } from '../utils/userDataMapper';

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
    refundPolicy?: string;
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

interface MemberVerificationData {
    id?: string;
    societyId?: string;
    grade?: string;
    name?: string;
    code?: string;
    expiry?: string;
}

export default function RegistrationPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();

    // Hooks
    const { id: confId, info, loading: confLoading } = useConference();
    const { auth } = useAuth();

    const { language, setLanguage } = useUserStore();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const state = location.state as {
        memberVerified?: boolean;
        memberName?: string;
        memberGrade?: string;
        memberCode?: string;
        memberVerificationId?: string;
        memberExpiry?: string;
        memberVerification?: MemberVerificationData;
        memberVerificationData?: MemberVerificationData & { memberDocId?: string };
    } || {};

    // Params from Modal (State > SearchParams fallback)
    const memberVerified = state.memberVerified || searchParams.get('memberVerified') === 'true';
    const paramMemberName = state.memberName || searchParams.get('memberName') || '';
    const paramMemberGrade = state.memberGrade || searchParams.get('memberGrade') || '';
    const paramMemberCode = state.memberCode || searchParams.get('memberCode') || '';

    useRegistration(confId || '', auth.user);
    const [isProcessing, setIsProcessing] = useState(false);

    // State - Settings
    const [regSettings, setRegSettings] = useState<RegistrationSettings | null>(null);
    const [activePeriod, setActivePeriod] = useState<RegistrationPeriod | null>(null);
    const [grades, setGrades] = useState<Grade[]>([]);

    // Payment Config
    const [tossClientKey, setTossClientKey] = useState<string | null>(null);
    const [paymentProvider, setPaymentProvider] = useState<string>('TOSS');
    const [nicePaySecret, setNicePaySecret] = useState('');
    const [paymentWidget, setPaymentWidget] = useState<PaymentWidgetInstance | null>(null);
    const paymentMethodsWidgetRef = useRef<HTMLDivElement>(null);

    // State - Form
    const [formData, setFormData] = useState({
        name: paramMemberName,
        email: '',
        phone: '',
        affiliation: '',
        licenseNumber: paramMemberCode,
        simplePassword: '',
        confirmPassword: ''
    });

    const [isInfoSaved, setIsInfoSaved] = useState(false);
    const [currentRegId, setCurrentRegId] = useState<string | null>(null);
    const [price, setPrice] = useState(0);
    const [finalCategory, setFinalCategory] = useState('');

    // NicePay State
    const [nicePayActive, setNicePayActive] = useState(false);

    // [Fix-Step 330] Ensure Language Consistency
    useEffect(() => {
        const urlLang = searchParams.get('lang');
        if (urlLang === 'ko' || urlLang === 'en') {
            if (language !== urlLang) {
                setLanguage(urlLang);
            }
        }
    }, [searchParams, language, setLanguage]);

    // Initialization
    const [isInitializing, setIsInitializing] = useState(true);
    const [footerInfo, setFooterInfo] = useState<Record<string, unknown> | null>(null);
    const [societyName, setSocietyName] = useState<string>('');
    const [showRefundModal, setShowRefundModal] = useState(false);

    useEffect(() => {
        if (auth.loading) return;

        const societyId = info?.societyId;
        if (!confId || !societyId) {
            setIsInitializing(false);
            return;
        }

        const initializeRegistration = async () => {
            setIsInitializing(true);
            try {
                // 1. Load Settings (including footer info)
                const [regSnap, gradesSnap, infraSnap, societySnap] = await Promise.all([
                    getDoc(doc(db, `conferences/${confId}/settings/registration`)),
                    getDocs(collection(db, `societies/${societyId}/settings/grades/list`)),
                    getDoc(doc(db, `societies/${societyId}/settings/infrastructure`)),
                    getDoc(doc(db, 'societies', societyId))
                ]);

                // Footer Info & Society Name
                if (societySnap.exists()) {
                    const sData = societySnap.data();
                    setFooterInfo(sData.footerInfo);
                    setSocietyName(sData.name?.ko || sData.name?.en || societyId.toUpperCase());
                }

                // Registration Settings
                if (regSnap.exists()) {
                    const data = regSnap.data() as RegistrationSettings;
                    setRegSettings(data);
                    const now = new Date();
                    const period = data.periods.find(p => {
                        const start = p.startDate.toDate();
                        const end = p.endDate.toDate();
                        return now >= start && now <= end;
                    });
                    if (period) setActivePeriod(period);
                }

                // Grades
                let loadedGrades: Grade[] = [];
                if (!gradesSnap.empty) {
                    loadedGrades = gradesSnap.docs.map((d) => ({
                        id: d.id,
                        name: d.data().name,
                        code: d.data().code
                    }));
                    setGrades(loadedGrades);
                }

                // Infra (Payment)
                const defaultClientKey = "test_gck_4yKeq5bgrpXJA4nz4qxArGX0lzW6";
                if (infraSnap.exists()) {
                    const data = infraSnap.data() as InfraSettings;
                    const useGlobalPayment = language === 'en' && data.payment?.global?.enabled;

                    if (useGlobalPayment) {
                        const key = data.payment?.domestic?.apiKey && data.payment?.domestic?.apiKey.startsWith('test_')
                            ? data.payment?.domestic?.apiKey
                            : defaultClientKey;
                        setTossClientKey(key);
                        setPaymentProvider(data.payment?.domestic?.provider || 'TOSS');
                        if (data.payment?.domestic?.secretKey) setNicePaySecret(data.payment.domestic.secretKey);
                    } else {
                        const key = data.payment?.domestic?.apiKey && data.payment?.domestic?.apiKey.startsWith('test_')
                            ? data.payment?.domestic?.apiKey
                            : defaultClientKey;
                        setTossClientKey(key);
                        setPaymentProvider(data.payment?.domestic?.provider || 'TOSS');
                        if (data.payment?.domestic?.secretKey) setNicePaySecret(data.payment.domestic.secretKey);
                    }
                } else {
                    setTossClientKey(defaultClientKey);
                    setPaymentProvider('TOSS');
                }

                // 2. Pre-fill User Data if logged in
                if (auth.user) {
                    const uData = auth.user;
                    setFormData(prev => ({
                        ...prev,
                        name: prev.name || uData.name || '',
                        email: uData.email || '',
                        phone: uData.phone || '', // ✅ ConferenceUser has phone
                        affiliation: uData.organization || '', // ✅ ConferenceUser.organization -> UI.affiliation
                        licenseNumber: prev.licenseNumber || uData.licenseNumber || ''
                    }));
                }
            } catch (error) {
                console.error("Init failed:", error);
                toast.error("초기화 실패");
            } finally {
                setIsInitializing(false);
            }
        };

        initializeRegistration();
    }, [confId, info?.societyId, language, auth.loading, auth.user]);

    // Calculate Price based on Grade
    useEffect(() => {
        if (!activePeriod) return;

        let targetGradeId = '';

        // 1. Try to use passed grade (from URL or State)
        if (paramMemberGrade) {
            // A. Search in Grades List (if available) - search by code, name, or id
            if (grades.length > 0) {
                const normalizedServer = String(paramMemberGrade).toLowerCase().replace(/\s/g, '');
                const matched = grades.find(g => {
                    const gId = (g.id || '').toLowerCase().replace(/\s/g, '');
                    const gCode = (g.code || '').toLowerCase().replace(/\s/g, '');

                    // Handle name as object {ko, en} or string
                    let gName = '';
                    const nameObj = g.name;
                    if (nameObj && typeof nameObj === 'object') {
                        const koName = (nameObj as { ko?: string }).ko || '';
                        const enName = (nameObj as { en?: string }).en || '';
                        gName = (koName + enName).toLowerCase().replace(/\s/g, '');
                    } else {
                        gName = String(nameObj || '').toLowerCase().replace(/\s/g, '');
                    }

                    return gId === normalizedServer || gCode === normalizedServer || gName === normalizedServer || gName.includes(normalizedServer);
                });
                // FIXED: Use grade.code (not Firestore doc ID) for price lookup
                if (matched) {
                    console.log('[Grade Match] Matched grade:', matched.code, 'from input:', paramMemberGrade);
                    targetGradeId = matched.code || matched.id;
                }
            }

            // B. If not found in grades, check if it's a direct price key (e.g. non-member types)
            if (!targetGradeId && activePeriod.prices && activePeriod.prices[paramMemberGrade] !== undefined) {
                console.log('[Grade Match] Using direct price key:', paramMemberGrade);
                targetGradeId = paramMemberGrade;
            }
        }

        // 2. Fallback: Default to 'Non-member' if nothing selected/found
        if (!targetGradeId) {
            // Try finding "Non-member" in grades list first
            const nonMember = grades.find(g => {
                const n = g.name.toLowerCase();
                return n.includes('비회원') || n.includes('non-member');
            });
            if (nonMember) {
                targetGradeId = nonMember.code || nonMember.id;
            } else if (activePeriod.prices && activePeriod.prices['Non-member'] !== undefined) {
                // Direct fallback to 'Non-member' key
                targetGradeId = 'Non-member';
            }
        }

        if (targetGradeId) {
            // FIXED: Search by both id and code when looking up grade name
            const gradeNameObj = grades.find(g => g.id === targetGradeId || g.code === targetGradeId)?.name || null;

            // Extract name from object {ko, en} based on language
            let gradeName = '';
            if (gradeNameObj && typeof gradeNameObj === 'object' && gradeNameObj !== null) {
                const ko = (gradeNameObj as { ko?: string }).ko || '';
                const en = (gradeNameObj as { en?: string }).en || '';
                gradeName = language === 'en' ? (en || ko) : (ko || en);
            } else if (gradeNameObj) {
                gradeName = String(gradeNameObj);
            }

            // Fallback name for non-member types not in grades list
            if (!gradeName) {
                // Try one more time to fetch from DB grades using ID match
                const dbGrade = grades.find(g => g.id === targetGradeId || g.code === targetGradeId);
                if (dbGrade) {
                    const dbGradeName = dbGrade.name;
                    if (dbGradeName && typeof dbGradeName === 'object' && dbGradeName !== null) {
                        const ko = (dbGradeName as { ko?: string }).ko || '';
                        const en = (dbGradeName as { en?: string }).en || '';
                        gradeName = language === 'en' ? (en || ko) : (ko || en);
                    } else if (dbGradeName) {
                        gradeName = String(dbGradeName || '');
                    }
                } else {
                    // Last resort: Show ID itself if no name found anywhere
                    gradeName = targetGradeId;
                }
            }

            const p = activePeriod.prices[targetGradeId] ?? 0;
            setPrice(p);
            setFinalCategory(`${activePeriod.name.ko} - ${gradeName}`);
        }

    }, [activePeriod, grades, paramMemberGrade, language]);


    // Payment Widget Init
    useEffect(() => {
        if (isInfoSaved && tossClientKey && paymentProvider === 'TOSS') {
            (async () => {
                const customerKey = auth.user ? auth.user.id : uuidv4();
                try {
                    const widget = await loadPaymentWidget(tossClientKey, customerKey);
                    setPaymentWidget(widget);
                } catch (error) {
                    console.error("Failed to load payment widget:", error);
                }
            })();
        }
    }, [isInfoSaved, auth.user, tossClientKey, paymentProvider]);

    useEffect(() => {
        if (paymentWidget && paymentMethodsWidgetRef.current && price >= 0) {
            paymentWidget.renderPaymentMethods(
                '#payment-widget',
                { value: price },
                { variantKey: 'DEFAULT' }
            );
        }
    }, [paymentWidget, price]);


    // Handlers
    const handleLoginAndLoad = async () => {
        if (!formData.email || !formData.simplePassword) {
            toast.error(language === 'ko' ? "이메일과 비밀번호를 입력해주세요." : "Please enter email and password.");
            return;
        }

        setIsProcessing(true);
        try {
            await signInWithEmailAndPassword(firebaseAuth, formData.email, formData.simplePassword);
            toast.success(language === 'ko' ? "정보를 불러왔습니다." : "User info loaded.");
            // useEffect will handle form population
        } catch (error: unknown) {
            console.error("Login failed:", error);
            if (error && typeof error === 'object' && 'code' in error && (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password')) {
                toast.error(language === 'ko' ? "등록된 정보가 없습니다. 새로 입력해주세요." : "No record found. Please fill in details.");
            } else {
                const message = error instanceof Error ? error.message : 'Unknown error';
                toast.error("Login failed: " + message);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveBasicInfo = async () => {
        if (!formData.name || !formData.email || !formData.phone || !formData.affiliation) {
            toast.error(language === 'ko' ? "모든 필수 항목을 입력해주세요." : "Please fill in all required fields.");
            return;
        }

        if (!auth.user && !formData.simplePassword) {
            toast.error(language === 'ko' ? "비밀번호를 입력해주세요." : "Please enter a password.");
            return;
        }

        setIsProcessing(true);
        try {
            // 1. Create User (Sign Up) or Update if logged in
            let uid = auth.user?.id || firebaseAuth.currentUser?.uid;

            if (!uid) {
                // Not logged in -> Create Account
                try {
                    const userCredential = await createUserWithEmailAndPassword(firebaseAuth, formData.email, formData.simplePassword);
                    uid = userCredential.user.uid;
                    toast.success(language === 'ko' ? "회원가입이 완료되었습니다." : "Account created successfully.");
                } catch (authError: unknown) {
                    const err = authError as { code?: string };
                    if (err.code === 'auth/email-already-in-use') {
                        // Try logging in if email exists
                        try {
                            const userCredential = await signInWithEmailAndPassword(firebaseAuth, formData.email, formData.simplePassword);
                            uid = userCredential.user.uid;
                            toast.success(language === 'ko' ? "로그인되었습니다." : "Logged in successfully.");
                        } catch (loginError: unknown) {
                            const err = loginError as { code?: string };
                            if (err.code === 'auth/wrong-password') {
                                toast.error(language === 'ko' ? "이미 가입된 이메일입니다. 비밀번호를 확인해주세요." : "Email already exists. Please check your password.");
                                setIsProcessing(false);
                                return;
                            } else {
                                throw authError; // Throw original error if not wrong password
                            }
                        }
                    } else {
                        throw authError;
                    }
                }
            }

            // 2. Save User Info to users/{uid}
            if (uid) {
                const userDataToSave = toFirestoreUserData({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    organization: formData.affiliation, // UI는 affiliation, DB는 organization으로 저장
                    licenseNumber: formData.licenseNumber
                });

                await setDoc(doc(db, 'users', uid), {
                    ...userDataToSave,
                    simplePassword: formData.simplePassword ? btoa(formData.simplePassword) : null, // Legacy support
                    updatedAt: Timestamp.now()
                }, { merge: true });
            }

            setIsInfoSaved(true);
            toast.success(language === 'ko' ? "기본 정보가 저장되었습니다." : "Basic info saved.");

            // Scroll to payment
            setTimeout(() => {
                document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);

        } catch (e: unknown) {
            console.error("Save info failed:", e);
            const message = e instanceof Error ? e.message : 'Unknown error';
            toast.error(language === 'ko' ? `저장 실패: ${message}` : `Save failed: ${message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePayment = async () => {
        if (!confId) return;
        setIsProcessing(true);

        try {
            // 1. Create PENDING Registration
            // [Fix-Step 146] Custom Order ID Format
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // 20260115
            const rand = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 chars
            const prefix = info?.societyId ? info.societyId.toUpperCase() : 'CONF';
            const orderId = `${prefix}-${dateStr}-${rand}`;

            const regRef = doc(collection(db, `conferences/${confId}/registrations`));

            const regData = {
                id: regRef.id,
                userId: auth.user?.id || firebaseAuth.currentUser?.uid || 'GUEST',
                userInfo: {
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    affiliation: formData.affiliation
                },
                conferenceId: confId,
                status: 'PENDING',
                paymentStatus: 'PENDING',
                amount: price,
                categoryName: finalCategory,
                orderId: orderId,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            // Determine and attach member verification data if available
            // Priority: location.state > sessionStorage > URL params
            const mvFromURL: MemberVerificationData | null = (() => {
                // Try sessionStorage first (persists across refresh)
                const storageKey = `member_verification_${confId}`;
                const sessionData = sessionStorage.getItem(storageKey);
                let fromStorage: MemberVerificationData | null = null;
                if (sessionData) {
                    try {
                        fromStorage = JSON.parse(sessionData);
                    } catch (e) {
                        console.warn('Failed to parse sessionStorage member verification data:', e);
                    }
                }

                const candidate = {
                    id: state.memberVerificationId || state.memberVerification?.id || state.memberVerificationData?.id || state.memberVerificationData?.memberDocId || fromStorage?.id || '',
                    societyId: info?.societyId || fromStorage?.societyId || '',
                    grade: (paramMemberGrade || state.memberGrade || state.memberVerification?.grade || state.memberVerificationData?.grade || fromStorage?.grade || ''),
                    name: (paramMemberName || state.memberName || state.memberVerification?.name || state.memberVerificationData?.name || fromStorage?.name || ''),
                    code: (paramMemberCode || state.memberCode || state.memberVerification?.code || state.memberVerificationData?.code || fromStorage?.code || ''),
                    expiry: state.memberExpiry || state.memberVerification?.expiry || state.memberVerificationData?.expiry || fromStorage?.expiry || ''
                };
                const hasData = !!(candidate.name || candidate.code || candidate.id);
                return hasData ? candidate : null;
            })();
            if (mvFromURL) {
                // Attach to regData so Cloud Functions can lock the member code after payment
                // @ts-expect-error - memberVerificationData is added dynamically for Cloud Functions
                regData.memberVerificationData = mvFromURL;
            }

            await setDoc(regRef, regData);
            setCurrentRegId(regRef.id);

            // 2. Process Payment
            if (paymentProvider === 'NICE') {
                setNicePayActive(true);
            } else if (paymentProvider === 'TOSS' && paymentWidget) {
                const origin = window.location.origin;
                const successUrl = `${origin}/payment/success?slug=${slug}&societyId=${info?.societyId}&confId=${confId}&regId=${regRef.id}`;
                const failUrl = `${origin}/${slug}/register/fail?regId=${regRef.id}`;

                await paymentWidget.requestPayment({
                    orderId: orderId,
                    orderName: `${finalCategory}`,
                    customerName: formData.name,
                    customerEmail: formData.email,
                    successUrl,
                    failUrl,
                });
            } else {
                toast.error("Payment provider error");
                setIsProcessing(false);
            }

        } catch (error) {
            console.error("Payment Error:", error);
            toast.error("결제 시작 실패");
            setIsProcessing(false);
        }
    };

    const handleNiceSuccess = async (data: { TxTid: string }) => {
        try {
            const confirmFn = httpsCallable(functions, 'confirmNicePayment');
            const result = await confirmFn({
                tid: data.TxTid,
                amt: price,
                mid: tossClientKey,
                key: nicePaySecret,
                regId: currentRegId,
                confId: confId
            });

            const resData = result.data as { success: boolean; message?: string };
            if (resData.success) {
                navigate(`/${slug}/register/success?regId=${currentRegId}`);
            } else {
                toast.error("Payment Confirmation Failed: " + resData.message);
                setIsProcessing(false);
                setNicePayActive(false);
            }
        } catch (error: unknown) {
            console.error("NicePay Confirm Error:", error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            toast.error("Payment Confirmation Error: " + message);
            setIsProcessing(false);
            setNicePayActive(false);
        }
    };

    const handleNiceFail = (error: string) => {
        toast.error("Payment Failed: " + error);
        setIsProcessing(false);
        setNicePayActive(false);
    };

    if (confLoading || isInitializing) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><LoadingSpinner /></div>;
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            {/* HEADER */}
            <header className="bg-white shadow-sm py-4 px-6 flex justify-between items-center sticky top-0 z-10">
                <div className="font-bold text-xl text-blue-900">{info?.societyId?.toUpperCase() || 'Academic Society'}</div>
                <button
                    type="button"
                    onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
                    className="px-3 py-1 rounded text-sm font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                >
                    {language === 'ko' ? 'EN' : 'KO'}
                </button>
            </header>

            {/* BODY */}
            <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8">
                {isProcessing && (
                    <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex items-center justify-center">
                        <LoadingSpinner />
                    </div>
                )}

                <div className="max-w-3xl mx-auto space-y-8">
                    {/* Header */}
                    <div>
                        <Button variant="ghost" className="pl-0 mb-4" onClick={() => navigate(`/${slug}`)}>
                            <ChevronLeft className="w-5 h-5 mr-1" />
                            {language === 'ko' ? '홈으로' : 'Home'}
                        </Button>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {language === 'ko' ? `${societyName} 학술대회 등록페이지` : `${societyName} Conference Registration Page`}
                        </h1>
                        <p className="mt-2 text-gray-600">
                            {info?.title ? (language === 'ko' ? info.title.ko : info.title.en) : 'Conference'}
                        </p>
                    </div>

                    {/* Step 1: Basic Info */}
                    <Card className={`transition-all duration-300 ${isInfoSaved ? 'opacity-70 grayscale' : 'shadow-lg border-blue-200'}`}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isInfoSaved ? 'bg-green-100 text-green-600' : 'bg-blue-600 text-white'}`}>
                                    {isInfoSaved ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                                </div>
                                {language === 'ko' ? '기본 정보 입력' : 'Basic Information'}
                            </CardTitle>
                            <CardDescription>
                                {language === 'ko' ? '학술대회 등록을 위한 기본 정보를 입력해주세요.' : 'Please enter your basic information for registration.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* 1. Email & Password (Guest Login / Create) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                                <div className="space-y-2">
                                    <Label>Email <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        readOnly={isInfoSaved || !!auth.user}
                                        className={isInfoSaved || !!auth.user ? 'bg-gray-100' : 'bg-white'}
                                        placeholder="email@example.com"
                                    />
                                </div>

                                {/* Password: Show for guests (non-authenticated users) */}
                                {!auth.user && (
                                    <div className="space-y-2">
                                        <Label className="flex justify-between items-center">
                                            <span>
                                                {language === 'ko' ? 'Password' : 'Password'} <span className="text-red-500">*</span>
                                            </span>
                                            {/* Load Button for Guests */}
                                            <button
                                                type="button"
                                                onClick={handleLoginAndLoad}
                                                className="text-xs text-blue-600 hover:underline font-medium"
                                                disabled={isProcessing}
                                            >
                                                {language === 'ko' ? '기존 정보 불러오기' : 'Load Existing Info'}
                                            </button>
                                        </Label>
                                        <Input
                                            type="password"
                                            value={formData.simplePassword}
                                            onChange={e => setFormData({ ...formData, simplePassword: e.target.value })}
                                            readOnly={isInfoSaved}
                                            className="bg-white"
                                            placeholder={language === 'ko' ? '비밀번호 입력' : 'Enter password'}
                                        />
                                        <p className="text-xs text-gray-500">
                                            * {language === 'ko' ? '기존 회원은 정보가 자동 입력되며, 신규 회원은 이 정보로 계정이 생성됩니다.' : 'Existing users: info auto-loads. New users: account created.'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* 2. Personal Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        readOnly={memberVerified || isInfoSaved}
                                        className={memberVerified || isInfoSaved ? 'bg-gray-100' : ''}
                                        placeholder="홍길동"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Affiliation <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.affiliation}
                                        onChange={e => setFormData({ ...formData, affiliation: e.target.value })}
                                        readOnly={isInfoSaved}
                                        className={isInfoSaved ? 'bg-gray-100' : ''}
                                        placeholder="소속 (병원/학교)"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>License Number <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.licenseNumber}
                                        onChange={e => setFormData({ ...formData, licenseNumber: e.target.value })}
                                        readOnly={isInfoSaved || (memberVerified && !!paramMemberCode)}
                                        className={isInfoSaved || (memberVerified && !!paramMemberCode) ? 'bg-gray-100' : ''}
                                        placeholder="면허번호 (없을 경우 생년월일)"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        readOnly={isInfoSaved}
                                        className={isInfoSaved ? 'bg-gray-100' : ''}
                                        placeholder="010-1234-5678"
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className={`${isInfoSaved ? 'hidden' : 'block'}`}>
                            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSaveBasicInfo} disabled={isProcessing}>
                                <Save className="w-4 h-4 mr-2" />
                                {language === 'ko' ? '기본 정보 저장하기' : 'Save Basic Info'}
                            </Button>
                        </CardFooter>
                        {isInfoSaved && (
                            <div className="absolute top-4 right-4">
                                <Button variant="ghost" size="sm" onClick={() => setIsInfoSaved(false)}>
                                    {language === 'ko' ? '수정' : 'Edit'}
                                </Button>
                            </div>
                        )}
                    </Card>

                    {/* Step 2: Payment */}
                    {isInfoSaved && (
                        <Card id="payment-section" className="shadow-lg border-blue-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                        2
                                    </div>
                                    {language === 'ko' ? '결제' : 'Payment'}
                                </CardTitle>
                                <CardDescription>
                                    {language === 'ko' ? '등록비를 결제하고 등록을 완료하세요.' : 'Complete payment to finish registration.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-slate-50 p-6 rounded-xl border flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-gray-500">Registration Type</p>
                                        <p className="font-bold text-lg text-slate-900">{finalCategory}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500">Amount</p>
                                        <p className="text-2xl font-bold text-blue-600">₩{price.toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Payment Widget Area */}
                                {paymentProvider === 'NICE' ? (
                                    <div className="text-center p-8 bg-blue-50 rounded-xl border border-blue-100">
                                        <p className="mb-4 font-medium text-blue-800">
                                            {language === 'ko' ? '나이스페이 결제창이 열립니다.' : 'NicePay window will open.'}
                                        </p>
                                        {nicePayActive && (
                                            <NicePaymentForm
                                                amount={price}
                                                buyerName={formData.name}
                                                buyerEmail={formData.email}
                                                buyerTel={formData.phone}
                                                goodsName={finalCategory}
                                                mid={tossClientKey || ''}
                                                merchantKey={nicePaySecret}
                                                onSuccess={handleNiceSuccess}
                                                onFail={handleNiceFail}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div id="payment-widget" ref={paymentMethodsWidgetRef} className="min-h-[300px]" />
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button
                                    className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-md"
                                    onClick={handlePayment}
                                    disabled={isProcessing || (!paymentWidget && paymentProvider !== 'NICE')}
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <CreditCard className="w-5 h-5 mr-2" />
                                            {language === 'ko' ? '결제하기' : 'Pay Now'}
                                        </>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    )}
                </div>
            </main>

            {/* FOOTER - WideFooterPreview */}
            <WideFooterPreview
                society={footerInfo ? {
                    name: societyName || info?.societyId,  // Firestore에서 가져온 학회명 사용
                    footerInfo
                } : undefined}
                language={language}
            />

            {/* Refund Policy Modal - Floating Trigger Button */}
            <button
                type="button"
                onClick={() => setShowRefundModal(true)}
                className="fixed bottom-4 right-4 z-40 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold transition-colors"
            >
                {language === 'ko' ? '환불규정' : 'Refund Policy'}
            </button>

            {/* Refund Policy Modal */}
            <Dialog open={showRefundModal} onOpenChange={setShowRefundModal}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{language === 'ko' ? '환불규정' : 'Refund Policy'}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">
                        {regSettings?.refundPolicy || (info as any)?.refundPolicy ||
                            "2026년 3월 5일 17시까지 전액 환불 이후 환불은 불가 합니다. 카드결제 : 승인취소 퀵계좌이체 등 : 시스템에서 계좌 환불 * 카드사 승인 사정에 따라 환불이 영업일 기준 5일 이상 발생할 수 있습니다. 자세한 사항은 사무국으로 문의주시기 바랍니다."}
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button onClick={() => setShowRefundModal(false)}>
                            {language === 'ko' ? '닫기' : 'Close'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
