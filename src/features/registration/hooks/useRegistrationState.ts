import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useConference } from '@/hooks/useConference';
import { useAuth } from '@/hooks/useAuth';
import { useRegistration } from '@/hooks/useRegistration';
import { useUserStore } from '@/store/userStore';
import { usePricing } from '@/hooks/usePricing';
import { doc, setDoc, getDoc, Timestamp, getDocs, collection } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { loadPaymentWidget, PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { toFirestoreUserData } from '@/utils/userDataMapper';
import type { RegistrationPeriod, RegistrationSettings, InfraSettings, Grade, MemberVerificationData } from '../types';

export function useRegistrationState() {
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
        calculatedPrice?: number;
    } || {};

    const memberVerified = state.memberVerified || searchParams.get('memberVerified') === 'true';
    const paramMemberName = state.memberName || searchParams.get('memberName') || '';
    const paramMemberGrade = state.memberGrade || searchParams.get('memberGrade') || '';
    const paramMemberCode = state.memberCode || searchParams.get('memberCode') || '';

    let paramCalculatedPrice: number | undefined = undefined;

    try {
        const storageKey = `member_verification_${confId}`;
        const sessionData = sessionStorage.getItem(storageKey);
        if (sessionData) {
            const parsed = JSON.parse(sessionData);
            if (typeof parsed.calculatedPrice === 'number') {
                paramCalculatedPrice = parsed.calculatedPrice;
            }
        }

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
    const paymentMethodsInstanceRef = useRef<any>(null);

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
    const [finalCategory, setFinalCategory] = useState('');

    const pricing = usePricing(0);
    const { basePrice, totalPrice, optionsTotal, selectedOptions, setBasePrice: updateBasePrice } = pricing;

    const [selectedTier, setSelectedTier] = useState<string>('');

    useEffect(() => {
        const urlLang = searchParams.get('lang');
        if (urlLang === 'ko' || urlLang === 'en') {
            if (language !== urlLang) {
                setLanguage(urlLang);
            }
        }
    }, [searchParams, language, setLanguage]);

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
                const [regSnap, gradesSnap, infraSnap, societySnap] = await Promise.all([
                    getDoc(doc(db, `conferences/${confId}/settings/registration`)),
                    getDocs(collection(db, `societies/${societyId}/settings/grades/list`)),
                    getDoc(doc(db, `societies/${societyId}/settings/infrastructure`)),
                    getDoc(doc(db, 'societies', societyId))
                ]);

                if (societySnap.exists()) {
                    const sData = societySnap.data();
                    setFooterInfo(sData.footerInfo);
                    setSocietyName(sData.name?.ko || sData.name?.en || societyId.toUpperCase());
                }

                if (regSnap.exists()) {
                    const data = regSnap.data() as RegistrationSettings;
                    setRegSettings(data);
                    const now = new Date();
                    const period = data.periods.find(p => {
                        const start = p.startDate.toDate();
                        const end = p.endDate.toDate();
                        const endOfDay = new Date(end);
                        endOfDay.setHours(23, 59, 59, 999);
                        return now >= start && now <= endOfDay;
                    });
                    if (period) setActivePeriod(period);
                }

                let loadedGrades: Grade[] = [];
                if (!gradesSnap.empty) {
                    loadedGrades = gradesSnap.docs.map((d) => ({
                        id: d.id,
                        name: d.data().name,
                        code: d.data().code
                    }));
                    setGrades(loadedGrades);
                }

                const defaultClientKey = "test_gck_4yKeq5bgrpXJA4nz4qxArGX0lzW6";
                if (infraSnap.exists()) {
                    const data = infraSnap.data() as InfraSettings;
                    const domesticPayment = data.payment?.domestic;
                    const apiKey = domesticPayment?.apiKey || defaultClientKey;
                    setTossClientKey(apiKey);
                } else {
                    setTossClientKey(defaultClientKey);
                }

                if (auth.user) {
                    const uData = auth.user;
                    setFormData(prev => ({
                        ...prev,
                        name: prev.name || uData.name || '',
                        email: uData.email || '',
                        phone: uData.phone || '',
                        affiliation: uData.organization || '',
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
    }, [confId, info?.societyId, language, auth.loading, auth.user]);

    useEffect(() => {
        if (paramCalculatedPrice !== undefined && paramCalculatedPrice >= 0) {
            updateBasePrice(paramCalculatedPrice);

            let categoryPrefix = 'Registration';
            if (activePeriod) {
                categoryPrefix = activePeriod.name.ko;
            } else {
                categoryPrefix = language === 'ko' ? '\uD559\uC220\uB300\uD68C \uB4F1\uB85D' : 'Conference Registration';
            }

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

            if (!targetGradeId && activePeriod.totalPrices && activePeriod.totalPrices[paramMemberGrade] !== undefined) {
                targetGradeId = paramMemberGrade;
            }
        }

        if (!targetGradeId) {
            const nonMember = grades.find(g => {
                const n = String(g.name || '').toLowerCase();
                return n.includes('\uBE44\uD68C\uC6D0') || n.includes('non-member');
            });
            if (nonMember) {
                targetGradeId = nonMember.code || nonMember.id;
            } else if (activePeriod.totalPrices && activePeriod.totalPrices['Non-member'] !== undefined) {
                targetGradeId = 'Non-member';
            }
        }

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
                    }
                } else {
                    gradeName = targetGradeId;
                }
            }

            const p = activePeriod.totalPrices[targetGradeId] ?? 0;
            updateBasePrice(p);
            setFinalCategory(`${activePeriod.name.ko} - ${gradeName}`);
        }

        setSelectedTier(targetGradeId);

    }, [activePeriod, grades, paramMemberGrade, language, paramCalculatedPrice, updateBasePrice]);


    useEffect(() => {
        if (isInfoSaved && tossClientKey) {
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
    }, [paymentWidget, totalPrice]);

    useEffect(() => {
        paymentMethodsInstanceRef.current = null;
    }, [paymentWidget]);

    const handleLoginAndLoad = async () => {
        if (!formData.email || !formData.simplePassword) {
            toast.error(language === 'ko' ? "이메일과 비밀번호를 입력해주세요." : "Please enter email and password.");
            return;
        }

        setIsProcessing(true);
        try {
            await signInWithEmailAndPassword(firebaseAuth, formData.email, formData.simplePassword);
            toast.success(language === 'ko' ? "기존 정보를 불러왔습니다." : "User info loaded.");
        } catch (error: any) {
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
        if (!formData.name || !formData.email || !formData.phone || !formData.affiliation) {
            toast.error(language === 'ko' ? "필수 항목을 모두 입력해주세요." : "Please fill in all required fields.");
            return;
        }

        if (!auth.user && !formData.simplePassword) {
            toast.error(language === 'ko' ? "비밀번호를 입력해주세요." : "Please enter a password.");
            return;
        }

        setIsProcessing(true);
        try {
            let uid = auth.user?.id || firebaseAuth.currentUser?.uid;

            if (!uid) {
                try {
                    const userCredential = await createUserWithEmailAndPassword(firebaseAuth, formData.email, formData.simplePassword);
                    uid = userCredential.user.uid;
                    toast.success(language === 'ko' ? "계정이 생성되었습니다." : "Account created successfully.");
                } catch (authError: any) {
                    if (authError.code === 'auth/email-already-in-use') {
                        try {
                            const userCredential = await signInWithEmailAndPassword(firebaseAuth, formData.email, formData.simplePassword);
                            uid = userCredential.user.uid;
                            toast.success(language === 'ko' ? "로그인되었습니다." : "Logged in successfully.");
                        } catch (loginError: any) {
                            if (loginError.code === 'auth/wrong-password') {
                                toast.error(language === 'ko' ? "이미 가입된 이메일입니다. 비밀번호를 확인해주세요." : "Email already exists. Please check your password.");
                                setIsProcessing(false);
                                return;
                            } else {
                                throw authError;
                            }
                        }
                    } else {
                        throw authError;
                    }
                }
            }

            if (uid) {
                const userDataToSave = toFirestoreUserData({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    organization: formData.affiliation,
                    licenseNumber: formData.licenseNumber
                });

                await setDoc(doc(db, 'users', uid), {
                    ...userDataToSave,
                    simplePassword: formData.simplePassword ? btoa(formData.simplePassword) : null,
                    updatedAt: Timestamp.now()
                }, { merge: true });
            }

            setIsInfoSaved(true);
            toast.success(language === 'ko' ? "기본 정보가 저장되었습니다." : "Basic info saved.");

            setTimeout(() => {
                document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);

        } catch (e: any) {
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
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
            const prefix = info?.societyId ? info.societyId.toUpperCase() : 'CONF';
            const orderId = `${prefix}-${dateStr}-${rand}`;

            const regRef = doc(collection(db, `conferences/${confId}/registrations`));

            const regData: any = {
                id: regRef.id,
                userId: auth.user?.id || firebaseAuth.currentUser?.uid || 'GUEST',
                userInfo: {
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    affiliation: formData.affiliation,
                    licenseNumber: formData.licenseNumber
                },
                conferenceId: confId,
                status: 'PENDING',
                paymentStatus: 'PENDING',
                amount: totalPrice,
                tier: selectedTier,
                categoryName: finalCategory,
                orderId: orderId,
                licenseNumber: formData.licenseNumber,
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

            const mvFromURL: MemberVerificationData | null = (() => {
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

            sessionStorage.setItem(`pending_reg_${orderId}`, JSON.stringify(regData));

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
        slug,
        navigate,
        confId,
        info,
        confLoading,
        auth,
        language,
        setLanguage,
        isProcessing,
        isInitializing,
        footerInfo,
        societyName,
        showRefundModal,
        setShowRefundModal,
        regSettings,
        formData,
        setFormData,
        isInfoSaved,
        setIsInfoSaved,
        handleLoginAndLoad,
        handleSaveBasicInfo,
        handlePayment,
        memberVerified,
        paramMemberCode,
        pricing,
        finalCategory,
        paymentMethodsWidgetRef,
        paymentWidget,
    };
}
