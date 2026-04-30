import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useConference } from './useConference';
import { useAuth } from './useAuth';
import { useRegistration } from './useRegistration';
import { useUserStore } from '../store/userStore';
import { usePricing } from './usePricing';
import { doc, setDoc, getDoc, Timestamp, getDocs, collection } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { loadPaymentWidget, PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { toFirestoreUserData } from '../utils/userDataMapper';
import { normalizeFieldSettings } from '../utils/registrationFieldSettings';
import type { RegistrationFieldSettings } from '../types/schema';

// Dynamic Types based on DB
interface RegistrationPeriod {
    id: string;
    name: { ko: string; en?: string };
    type: 'EARLY' | 'REGULAR' | 'ONSITE';
    startDate: Timestamp;
    endDate: Timestamp;
    totalPrices: Record<string, number>; // { [gradeId]: totalPrice }
}

interface RegistrationSettings {
    periods: RegistrationPeriod[];
    refundPolicy?: string;
    paymentMode?: 'TIERED' | 'FREE_ALL';
    fieldSettings?: RegistrationFieldSettings;
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

export function useRegistrationPage(slug: string | undefined) {
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
        calculatedPrice?: number; // Pre-calculated totalPrice from modal
    } || {};

    // Params from Modal (State > SearchParams > sessionStorage fallback)
    const memberVerified = state.memberVerified || searchParams.get('memberVerified') === 'true';
    const paramMemberName = state.memberName || searchParams.get('memberName') || '';
    const paramMemberGrade = state.memberGrade || searchParams.get('memberGrade') || '';
    const paramMemberCode = state.memberCode || searchParams.get('memberCode') || '';
    const lockNameField = memberVerified && !!paramMemberName;

    // Try to get calculated totalPrice - sessionStorage FIRST for reliability
    let paramCalculatedPrice: number | undefined = undefined;

    try {
        // Priority 1: Check sessionStorage for member verification
        const storageKey = `member_verification_${confId}`;
        const sessionData = sessionStorage.getItem(storageKey);
        if (sessionData) {
            const parsed = JSON.parse(sessionData);
            if (typeof parsed.calculatedPrice === 'number') {
                paramCalculatedPrice = parsed.calculatedPrice;
            }
        }

        // Priority 2: Check sessionStorage for non-member selection
        if (paramCalculatedPrice === undefined) {
            const nonMemberKey = `non_member_selection_${confId}`;
            const nonMemberData = sessionStorage.getItem(nonMemberKey);
            if (nonMemberData) {
                const parsed = JSON.parse(nonMemberData);
                if (typeof parsed.calculatedPrice === 'number') {
                    paramCalculatedPrice = parsed.calculatedPrice;
                }
            }
        }

        // Priority 3: Check location.state (may be lost during navigation)
        if (paramCalculatedPrice === undefined && location.state && typeof (location.state as { calculatedPrice?: number }).calculatedPrice === 'number') {
            paramCalculatedPrice = (location.state as { calculatedPrice?: number }).calculatedPrice;
        }
    } catch (e) {
        console.warn('[RegistrationPage] Failed to read calculated totalPrice:', e);
    }

    useRegistration(confId || '', auth.user);
    const [isProcessing, setIsProcessing] = useState(false);

    // State - Settings
    const [regSettings, setRegSettings] = useState<RegistrationSettings | null>(null);
    const [activePeriod, setActivePeriod] = useState<RegistrationPeriod | null>(null);
    const [grades, setGrades] = useState<Grade[]>([]);

    // Payment Config
    const [tossClientKey, setTossClientKey] = useState<string | null>(null);
    const [paymentWidget, setPaymentWidget] = useState<PaymentWidgetInstance | null>(null);
    const paymentMethodsWidgetRef = useRef<HTMLDivElement>(null);
    const paymentMethodsInstanceRef = useRef<{ updateAmount(amount: { value: number }): void } | null>(null);

    // State - Form
    const [formData, setFormData] = useState({
        name: paramMemberName,
        email: '',
        phone: '',
        affiliation: '',
        position: '',
        licenseNumber: paramMemberCode,
        simplePassword: '',
        confirmPassword: ''
    });

    const [isInfoSaved, setIsInfoSaved] = useState(false);
    const [finalCategory, setFinalCategory] = useState('');

    // Dynamic Field Settings
    const fieldSettings = normalizeFieldSettings(regSettings?.fieldSettings);

    // Pricing hook for optional add-ons
    const {
        basePrice,
        totalPrice,
        optionsTotal,
        selectedOptions,
        toggleOption,
        isOptionSelected,
        setBasePrice: updateBasePrice
    } = usePricing(0);

    // [Fix-Step 156] selectedTier state to ensure grade/tier is saved
    const [selectedTier, setSelectedTier] = useState<string>('');

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
                const registrationSettingsPaths = [
                    `conferences/${confId}/settings/registration`,
                    ...(societyId && slug && !slug.includes('_')
                        ? [`conferences/${societyId}_${slug}/settings/registration`]
                        : []),
                    ...(societyId && slug
                        ? [
                            `societies/${societyId}/conferences/${slug}/settings/registration`,
                            `societies/${societyId}/conferences/${confId}/settings/registration`
                        ]
                        : [])
                ].filter((path, index, paths) => paths.indexOf(path) === index);

                const getRegistrationSettings = async () => {
                    for (const path of registrationSettingsPaths) {
                        const snap = await getDoc(doc(db, path));
                        if (snap.exists()) return snap;
                    }
                    return null;
                };

                // 1. Load Settings (including footer info)
                const [regSnap, gradesSnap, infraSnap, societySnap] = await Promise.all([
                    getRegistrationSettings(),
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
                if (regSnap?.exists()) {
                    const data = regSnap.data() as RegistrationSettings;
                    setRegSettings(data);
                    const now = new Date();
                    const period = data.periods.find(p => {
                        const start = p.startDate.toDate();
                        const end = p.endDate.toDate();
                        // Extend end to end-of-day (23:59:59.999) to include the full last day
                        const endOfDay = new Date(end);
                        endOfDay.setHours(23, 59, 59, 999);
                        return now >= start && now <= endOfDay;
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
                    const domesticPayment = data.payment?.domestic;
                    // const useGlobalPayment = language === 'en' && data.payment?.global?.enabled;

                    // Use DB key if configured, otherwise fallback to default test key
                    const apiKey = domesticPayment?.apiKey || defaultClientKey;
                    setTossClientKey(apiKey);

                } else {
                    setTossClientKey(defaultClientKey);
                }

                // 2. Pre-fill User Data if logged in
                if (auth.user) {
                    const uData = auth.user;
                    setFormData(prev => ({
                        ...prev,
                        name: prev.name || uData.name || '',
                        email: uData.email || '',
                        phone: uData.phone || '', // ??ConferenceUser has phone
                        affiliation: uData.organization || '', // ??ConferenceUser.organization -> UI.affiliation
                        licenseNumber: prev.licenseNumber || uData.licenseNumber || ''
                    }));
                }
            } catch (error) {
                console.error("Init failed:", error);
                toast.error("초기화에 실패했습니다.");
            } finally {
                setIsInitializing(false);
            }
        };

        initializeRegistration();
    }, [confId, info?.societyId, language, auth.loading, auth.user, slug]);

    // Calculate Price based on Grade
    useEffect(() => {
        // PRIORITY 1: Use pre-calculated totalPrice from modal if available
        if (regSettings?.paymentMode === 'FREE_ALL') {
            updateBasePrice(0);
            setSelectedTier('FREE_ATTENDEE');
            setFinalCategory(language === 'ko' ? '무료 참석자' : 'Free Attendee');
            return;
        }

        if (paramCalculatedPrice !== undefined && paramCalculatedPrice >= 0) {
            updateBasePrice(paramCalculatedPrice);

            // Determine category name
            let categoryPrefix = 'Registration';
            if (activePeriod) {
                categoryPrefix = activePeriod.name.ko;
            } else {
                categoryPrefix = language === 'ko' ? '\uD559\uC220\uB300\uD68C \uB4F1\uB85D' : 'Conference Registration';
            }

            // Still need to determine the category name
            let targetGradeId = '';
            if (paramMemberGrade) {
                if (grades.length > 0) {
                    const normalizedServer = String(paramMemberGrade).toLowerCase().replace(/\s/g, '');
                    const matched = grades.find(g => {
                        const gId = (g.id || '').toLowerCase().replace(/\s/g, '');
                        const gCode = (g.code || '').toLowerCase().replace(/\s/g, '');
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
                    if (matched) {
                        targetGradeId = matched.code || matched.id;
                    }
                }
                if (!targetGradeId && activePeriod?.totalPrices && activePeriod.totalPrices[paramMemberGrade] !== undefined) {
                    targetGradeId = paramMemberGrade;
                }
            }

            // [Fix-Step 156] Update selectedTier state
            setSelectedTier(targetGradeId);

            if (targetGradeId) {
                const gradeNameObj = grades.find(g => g.id === targetGradeId || g.code === targetGradeId)?.name || null;
                let gradeName = '';
                if (gradeNameObj && typeof gradeNameObj === 'object' && gradeNameObj !== null) {
                    const ko = (gradeNameObj as { ko?: string }).ko || '';
                    const en = (gradeNameObj as { en?: string }).en || '';
                    gradeName = language === 'en' ? (en || ko) : (ko || en);
                } else if (gradeNameObj) {
                    gradeName = String(gradeNameObj);
                }

                if (!gradeName) {
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
                        gradeName = targetGradeId;
                    }
                }

                setFinalCategory(`${categoryPrefix} - ${gradeName}`);
            } else {
                setFinalCategory(categoryPrefix);
            }
            return;
        }

        if (!activePeriod) return;

        // PRIORITY 2: Fall back to original calculation logic if no pre-calculated totalPrice
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
                // FIXED: Use grade.code (not Firestore doc ID) for totalPrice lookup
                if (matched) {
                    targetGradeId = matched.code || matched.id;
                }
            }

            // B. If not found in grades, check if it's a direct totalPrice key (e.g. non-member types)
            if (!targetGradeId && activePeriod.totalPrices && activePeriod.totalPrices[paramMemberGrade] !== undefined) {
                targetGradeId = paramMemberGrade;
            }
        }

        // 2. Fallback: Default to 'Non-member' if nothing selected/found
        if (!targetGradeId) {
            // Try finding "Non-member" in grades list first
            const nonMember = grades.find(g => {
                const n = String(g.name || '').toLowerCase();  // ??Safe handling of undefined name
                return n.includes('\uBE44\uD68C\uC6D0') || n.includes('non-member');
            });
            if (nonMember) {
                targetGradeId = nonMember.code || nonMember.id;
            } else if (activePeriod.totalPrices && activePeriod.totalPrices['Non-member'] !== undefined) {
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
                    }
                } else {
                    // Last resort: Show ID itself if no name found anywhere
                    gradeName = targetGradeId;
                }
            }

            const p = activePeriod.totalPrices[targetGradeId] ?? 0;
            updateBasePrice(p);
            setFinalCategory(`${activePeriod.name.ko} - ${gradeName}`);
        }

        // [Fix-Step 156] Update selectedTier state
        setSelectedTier(targetGradeId);

    }, [activePeriod, grades, paramMemberGrade, language, paramCalculatedPrice, updateBasePrice, regSettings?.paymentMode]);


    // Payment Widget Init
    useEffect(() => {
        if (isInfoSaved && tossClientKey) {
            (async () => {
                const customerKey = auth.user ? auth.user.id : uuidv4();
                try {
                    const widget = await loadPaymentWidget(tossClientKey, customerKey);
                    setPaymentWidget(widget);
                } catch (error) {
                    console.error("Failed to load payment widget:", error);
                    toast.error('결제 위젯을 불러오지 못했습니다. 페이지를 새로고침해주세요.');
                }
            })();
        }
    }, [isInfoSaved, auth.user, tossClientKey]);

    useEffect(() => {
        if (paymentWidget && paymentMethodsWidgetRef.current && totalPrice >= 0) {
            const amount = { value: totalPrice };

            if (paymentMethodsInstanceRef.current) {
                paymentMethodsInstanceRef.current.updateAmount(amount);
            } else {
                paymentMethodsInstanceRef.current = paymentWidget.renderPaymentMethods(
                    '#payment-widget',
                    amount,
                    { variantKey: 'DEFAULT' }
                );
            }



        }

        // paymentMethodsInstanceRef is a ref and should not be in dependencies

    }, [paymentWidget, totalPrice]);

    // Reset instance ref if widget changes
    useEffect(() => {
        paymentMethodsInstanceRef.current = null;

        // paymentMethodsInstanceRef is a ref and should not be in dependencies

    }, [paymentWidget]);


    // Handlers
    const handleLoginAndLoad = async () => {
        if (!formData.email || !formData.simplePassword) {
            toast.error(language === 'ko' ? "이메일과 비밀번호를 입력해주세요." : "Please enter email and password.");
            return;
        }

        setIsProcessing(true);
        try {
            await signInWithEmailAndPassword(firebaseAuth, formData.email, formData.simplePassword);
            toast.success(language === 'ko' ? "기존 정보를 불러왔습니다." : "User info loaded.");
            // useEffect will handle form population
        } catch (error: unknown) {
            console.error("Login failed:", error);
            if (error && typeof error === 'object' && 'code' in error && (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password')) {
                toast.error(language === 'ko' ? "일치하는 계정을 찾지 못했습니다. 아래 정보를 직접 입력해주세요." : "No record found. Please fill in details.");
            } else {
                const message = error instanceof Error ? error.message : 'Unknown error';
                toast.error("Login failed: " + message);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveBasicInfo = async () => {
        // Dynamic Validation based on fieldSettings
        const missingRequired = [];
        if (fieldSettings.name.required && !formData.name) missingRequired.push('name');
        if (fieldSettings.email.required && !formData.email) missingRequired.push('email');
        if (fieldSettings.phone.required && !formData.phone) missingRequired.push('phone');
        if (fieldSettings.affiliation.required && !formData.affiliation) missingRequired.push('affiliation');
        if (fieldSettings.position.required && !formData.position) missingRequired.push('position');
        if (fieldSettings.licenseNumber.required && !formData.licenseNumber) missingRequired.push('licenseNumber');

        if (missingRequired.length > 0) {
            toast.error(language === 'ko' ? "필수 항목을 모두 입력해주세요." : "Please fill in all required fields.");
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

            // If email is hidden and not provided, generate a dummy one for auth purposes
            // Use phone number for better traceability if available
            const cleanPhone = formData.phone?.replace(/[^0-9]/g, '');
            if (!formData.email && !cleanPhone) {
                toast.error(language === 'ko' ? "이메일 또는 휴대폰 번호 중 하나는 필수입니다." : "Either email or phone number is required.");
                setIsProcessing(false);
                return;
            }
            const authEmail = formData.email || `${cleanPhone}@no-email.placeholder`;

            if (!uid) {
                // Not logged in -> Create Account
                try {
                    const userCredential = await createUserWithEmailAndPassword(firebaseAuth, authEmail, formData.simplePassword);
                    uid = userCredential.user.uid;
                    toast.success(language === 'ko' ? "계정이 생성되었습니다." : "Account created successfully.");
                } catch (authError: unknown) {
                    const err = authError as { code?: string };
                    if (err.code === 'auth/email-already-in-use') {
                        // Try logging in if email exists
                        try {
                            const userCredential = await signInWithEmailAndPassword(firebaseAuth, authEmail, formData.simplePassword);
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
                    organization: formData.affiliation, // UI??affiliation, DB??organization????????????
                    position: formData.position,
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
            toast.error(language === 'ko' ? `저장에 실패했습니다: ${message}` : `Save failed: ${message}`);
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

            const regData: Record<string, unknown> = {
                id: regRef.id,
                userId: auth.user?.id || firebaseAuth.currentUser?.uid || 'GUEST',
                userInfo: {
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    affiliation: formData.affiliation,
                    position: formData.position,
                    licenseNumber: formData.licenseNumber // [Fix-Step 156] Include licenseNumber in userInfo
                },
                conferenceId: confId,
                status: 'PENDING',
                paymentStatus: 'PENDING',
                amount: totalPrice,
                tier: selectedTier, // [Fix-Step 156] Include tier
                categoryName: finalCategory,
                orderId: orderId,
                licenseNumber: formData.licenseNumber, // [Fix-Step 156] Include licenseNumber at root
                position: formData.position,
                // [Fix-Option] Include selected options
                baseAmount: basePrice,
                optionsTotal: optionsTotal,
                selectedOptions: selectedOptions.map(o => ({
                    optionId: o.option.id,
                    name: o.option.name,
                    price: o.option.price,
                    quantity: o.quantity,
                    totalPrice: o.option.price * o.quantity
                })),
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
                regData.memberVerificationData = mvFromURL;
            }

            // Include agreement details from state if available
            if (state.agreementDetails) {
                regData.agreementDetails = state.agreementDetails;
            }

            // [Modified] Do NOT save to Firestore yet (Prevent Garbage)
            // Save to sessionStorage to retrieve after success
            sessionStorage.setItem(`pending_reg_${orderId}`, JSON.stringify(regData));

            if (totalPrice === 0) {
                // Call our new Cloud Function for free registration
                const currentUser = firebaseAuth.currentUser;
                if (!currentUser) {
                    throw new Error(language === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
                }
                const idToken = typeof currentUser.getIdToken === 'function' ? await currentUser.getIdToken() : null;
                if (!idToken) {
                    throw new Error(language === 'ko' ? '인증 토큰을 가져오지 못했습니다.' : 'Failed to get auth token.');
                }

                const response = await fetch(
                    `https://us-central1-eregi-8fc1e.cloudfunctions.net/processFreeRegistrationHttp`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`,
                        },
                        body: JSON.stringify({
                            regId: regRef.id,
                            confId: confId,
                            userData: {
                                userId: currentUser.uid,
                                name: formData.name,
                                email: formData.email,
                                phone: formData.phone,
                                affiliation: formData.affiliation,
                                position: formData.position,
                                licenseNumber: formData.licenseNumber,
                                tier: selectedTier,
                                categoryName: finalCategory,
                                isAnonymous: false,
                                memberVerificationData: mvFromURL
                            },
                            amount: 0,
                            baseAmount: basePrice,
                            optionsTotal: optionsTotal,
                            selectedOptions: selectedOptions.map(o => ({
                                optionId: o.option.id,
                                name: o.option.name,
                                price: o.option.price,
                                quantity: o.quantity,
                                totalPrice: o.option.price * o.quantity
                            })),
                            agreementDetails: state.agreementDetails || {}
                        })
                    }
                );

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || '무료 등록 처리에 실패했습니다.');
                }

                const pureSlug = confId.includes('_') ? confId.split('_').slice(1).join('_') : confId;
                window.location.href = `/${pureSlug}/register/success?regId=${regRef.id}&name=${encodeURIComponent(formData.name)}`;
                return;
            }

            // 2. Process Payment
            if (paymentWidget) {
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
                toast.error("Payment widget is not ready.");
                setIsProcessing(false);
            }

        } catch (error) {
            console.error("Payment Error:", error);
            toast.error("결제 시작 실패");
            setIsProcessing(false);
        }
    };

    return {
        // Loading states
        confLoading,
        isInitializing,
        isProcessing,

        // Conference info
        confId,
        info,

        // Language
        language,
        setLanguage,

        // Auth
        auth,

        // Form state
        formData,
        setFormData,
        fieldSettings,
        selectedTier,
        isInfoSaved,
        setIsInfoSaved,

        // Registration settings
        regSettings,
        activePeriod,
        grades,

        // Pricing
        basePrice,
        totalPrice,
        optionsTotal,
        selectedOptions,
        toggleOption,
        isOptionSelected,
        updateBasePrice,
        finalCategory,

        // Payment
        paymentWidget,
        paymentMethodsWidgetRef,

        // Footer
        footerInfo,
        societyName,

        // Refund modal
        showRefundModal,
        setShowRefundModal,

        // Member verification
        memberVerified,
        paramMemberCode,
        lockNameField,

        // Handlers
        handleLoginAndLoad,
        handleSaveBasicInfo,
        handlePayment,
    };
}
