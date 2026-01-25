import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useConference } from '../hooks/useConference';
import { useAuth } from '../hooks/useAuth';
import { useRegistration } from '../hooks/useRegistration'; // [Fix-Step 368]
import { useUserStore } from '../store/userStore';
import { useMemberVerification } from '../hooks/useMemberVerification';
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
import { CheckCircle2, Circle, AlertCircle, Loader2, ArrowRight, ArrowLeft, ChevronLeft, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import NicePaymentForm from '../components/payment/NicePaymentForm';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import LoadingSpinner from '../components/common/LoadingSpinner'; // [Fix-Step 368]
import { Skeleton } from '../components/ui/skeleton';

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

export default function RegistrationPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();

    // Hooks
    const { id: confId, info, loading: confLoading } = useConference();
    const { auth } = useAuth(confId || '');
    // [Fix-Step 262] Anonymous Auth Helper
    const isAnonymous = firebaseAuth.currentUser?.isAnonymous || false;

    const { language, setLanguage } = useUserStore(); // Use setLanguage
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode');

    // [Fix-Step 368] Registration Hook & State
    const { initializeGuest, resumeRegistration, autoSave } = useRegistration(confId || '', auth.user);
    const [isProcessing, setIsProcessing] = useState(false);
    const hasResumedRef = useRef(false);

    // [Fix-Step 368] Resume Logic
    useEffect(() => {
        if (auth.loading || !auth.user || !confId || hasResumedRef.current) return;

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
            } catch (e) {
                console.error("Resume failed", e);
            } finally {
                hasResumedRef.current = true;
                setIsProcessing(false);
            }
        };
        attemptResume();
    }, [auth.loading, auth.user, confId, resumeRegistration]);

    // [Fix-Step 330] Ensure Language Consistency
    useEffect(() => {
        const urlLang = searchParams.get('lang');
        if (urlLang === 'ko' || urlLang === 'en') {
            if (language !== urlLang) {
                setLanguage(urlLang);
            }
        }
    }, [searchParams, language, setLanguage]);

    // [Fix-Step 262] Silent Anonymous Auth - DEFERRED TO STEP 0 (TERMS)
    // Removed automatic useEffect for signInAnonymously here.

    // State - Wizard
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);

    // [Fix-Step 153] Prevent Duplicate Registration
    useEffect(() => {
        if (!auth.user || !slug) return;

        const checkDup = async () => {
            try {
                // Query: userId == current, slug == current, status == PAID
                // Note: Need to check 'registrations' root collection
                const q = query(
                    collection(db, 'registrations'),
                    where('userId', '==', auth.user!.id),
                    where('slug', '==', slug),
                    where('status', 'in', ['PAID', 'COMPLETED'])
                );
                const snap = await getDocs(q);

                if (!snap.empty) {
                    // Alert and Redirect
                    alert(language === 'ko'
                        ? "이미 등록이 완료된 학술대회입니다.\n(You have already registered for this conference.)"
                        : "You have already registered for this conference.");

                    // Redirect to Home or Success Page of the existing registration
                    const regId = snap.docs[0].id;
                    // window.location.href = `/${slug}/register/success?orderId=${regId}`; // Option A: Go to receipt
                    window.location.href = `/${slug}`; // Option B: Go to Home
                }
            } catch (e) {
                console.error("Duplicate check failed:", e);
                // Don't block flow on error, just log
            }
        };

        checkDup();
    }, [auth.user, slug, language]);

    // [Fix-Step 116] Mode Check & Redirection
    useEffect(() => {
        if (!auth.loading && mode === 'login' && !auth.user) {
            const currentUrl = window.location.pathname + window.location.search;
            const societyParam = info?.societyId ? `&societyId=${info.societyId}` : '';
            navigate(`/portal?returnUrl=${encodeURIComponent(currentUrl)}${societyParam}`);
        }
    }, [auth.loading, auth.user, mode, navigate, info?.societyId]);

    // State - Settings
    const [regSettings, setRegSettings] = useState<RegistrationSettings | null>(null);
    const [tossClientKey, setTossClientKey] = useState<string | null>(null);
    const [paymentProvider, setPaymentProvider] = useState<string>('TOSS'); // 'TOSS' | 'NICE' | ...

    // State - Terms
    // Fix-Step 334: Expanded State for 6 consents
    const [termsContent, setTermsContent] = useState<{
        tos: string; privacy: string; refund: string;
        thirdParty: string; marketing: string; info: string;
    }>({ tos: '', privacy: '', refund: '', thirdParty: '', marketing: '', info: '' });

    const [agreements, setAgreements] = useState({
        tos: false, privacy: false, refund: false,
        thirdParty: false, marketing: false, info: false
    });
    const [viewingTerm, setViewingTerm] = useState<{ title: string; content: string } | null>(null);

    // State - Step 1 (Info)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        affiliation: '',
        licenseNumber: '', // Optional
        simplePassword: '', // For Guest Check
        confirmPassword: '' // For Linking
    });

    // State - Step 2 (Verification & Category)
    const [grades, setGrades] = useState<Grade[]>([]);
    const [selectedGradeId, setSelectedGradeId] = useState<string>('');
    const [verifyName, setVerifyName] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [isVerified, setIsVerified] = useState(false);
    const [verificationMsg, setVerificationMsg] = useState('');
    const [activePeriod, setActivePeriod] = useState<RegistrationPeriod | null>(null);
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [verifyConsent, setVerifyConsent] = useState(false);
    // [Fix-Step 347] Store Verification Data for Locking
    const [memberVerificationData, setMemberVerificationData] = useState<any>(null);

    // [Fix-Step 263] Use Unified Verification Hook
    const { verifyMember, loading: verifyLoading } = useMemberVerification();

    // [Visual Standard] Validation State
    const [showValidation, setShowValidation] = useState(false);

    // [Fix-Step 258] Persistence & Auto-Skip Verification
    useEffect(() => {
        // If user is logged in, and societyId is known
        if (auth.user && info?.societyId && !isLoading) {
            const affiliations = (auth.user as any).affiliations || {};
            const userAffiliation = affiliations[info.societyId];

            // If already verified, set state AND auto-skip if on step 2
            if (userAffiliation?.verified) {
                console.log(`[Persistence] User already verified for ${info.societyId}`);
                setIsVerified(true);
                setShowVerificationModal(false); // Auto-close modal
            }
        }
    }, [auth.user, info?.societyId, isLoading]);

    // When user selects a Grade, check verification requirements
    useEffect(() => {
        if (!selectedGradeId || !grades.length) return;

        const selectedGrade = grades.find(g => g.id === selectedGradeId);
        if (!selectedGrade) return;

        // Determine if verification is required
        // Rule: "비회원" or "Non-member" or "Non-Member" -> No Verification
        const lowerName = selectedGrade.name.toLowerCase();
        const isNonMember = lowerName.includes('비회원') || lowerName.includes('non-member') || lowerName.includes('non member');

        if (!isNonMember) {
            // Check persistence first
            const affiliations = (auth.user as any)?.affiliations || {};
            const isPersisted = affiliations[info?.societyId || '']?.verified;

            if (!isVerified && !isPersisted) {
                // If not verified, show Modal
                setShowVerificationModal(true);
            } else {
                // Already verified
                setShowVerificationModal(false);
                setIsVerified(true);
            }
        } else {
            // Non-member doesn't need verification
            setShowVerificationModal(false);
        }
    }, [selectedGradeId, isVerified, grades, auth.user, info?.societyId]);

    // [Fix-Step 369] Auth-First Logic: Auto-select based on Verification
    useEffect(() => {
        if (grades.length === 0) return;

        // Find Non-Member Grade
        const nonMemberGrade = grades.find(g => {
            const n = g.name.toLowerCase();
            return n.includes('비회원') || n.includes('non-member') || n.includes('non member');
        });

        if (isVerified) {
            // Case A: Verified -> Auto-select matching grade
            if (memberVerificationData?.grade) {
                // [Step 399-D] Strengthened Matching (Remove all spaces)
                const rawServer = String(memberVerificationData.grade).toLowerCase();
                const normalizedServer = rawServer.replace(/\s/g, ''); // "dentalhygienist"

                const matched = grades.find(g => {
                    const gCode = (g.code || '').toLowerCase().replace(/\s/g, '');
                    const gName = (g.name || '').toLowerCase().replace(/\s/g, '');

                    // Strict Code Match OR Name Inclusion (Server grade inside Grade Name)
                    return gCode === normalizedServer || gName === normalizedServer || gName.includes(normalizedServer);
                });

                if (matched) {
                    // [Step 399-D] Force Override if mismatch
                    if (selectedGradeId !== matched.id) {
                        console.log(`[Auto-Select] Forced override from ${selectedGradeId} to ${matched.id} based on verification.`);
                        setSelectedGradeId(matched.id);
                    }
                }
            }
        } else {
            // Case B: Not Verified -> Auto-select Non-Member
            // Only if current selection is NOT non-member (to avoid loops, though non-member is safe)
            // Also, if user explicitly selected something else, we might overwrite it?
            // "Auth-First" implies we force non-member until verified.
            if (nonMemberGrade && selectedGradeId !== nonMemberGrade.id) {
                setSelectedGradeId(nonMemberGrade.id);
            }
        }
    }, [isVerified, grades, memberVerificationData, selectedGradeId]);

    // Actual Verification Logic
    const performMemberVerification = async () => {
        // [Fix-Step 263] Unified Logic via Hook
        if (auth.loading) {
            toast.error("인증 정보를 불러오는 중입니다.");
            return;
        }

        const societyId = info?.societyId || 'kap';

        // [Fix-Step 345] Smart Verification: No target grade required initially
        const targetGradeId = null;

        const res = await verifyMember(
            societyId,
            verifyName,
            verifyCode,
            verifyConsent,
            targetGradeId,
            formData.email,
            formData.phone,
            formData.simplePassword
        );

        if (res.success) {
            setIsVerified(true);
            setMemberVerificationData(res.memberData); // Save for Locking
            setVerificationMsg(language === 'ko' ? "인증되었습니다." : "Verified!");
            setShowVerificationModal(false);

            // [Fix-Step 345] Auto-Select Grade
            const serverGrade = res.memberData?.grade; // e.g. "Military Doctor"
            if (serverGrade) {
                const normalizedServer = String(serverGrade).trim().toLowerCase();
                // Find matching grade
                const matched = grades.find(g => {
                    const gCode = (g.code || '').toLowerCase();
                    const gName = (g.name || '').toLowerCase();
                    // Flexible matching: Code match OR Name match OR Name includes server grade
                    return gCode === normalizedServer || gName === normalizedServer || gName.includes(normalizedServer);
                });

                if (matched) {
                    setSelectedGradeId(matched.id);
                    toast.success(language === 'ko'
                        ? `✅ '${matched.name}' 등급으로 확인되었습니다.`
                        : `✅ Verified as '${matched.name}'`);
                } else {
                    toast("Verified, but could not auto-select grade. Please select manually.", { icon: '⚠️' });
                }
            } else {
                toast.success("Membership Verified!");
            }

        } else {
            setIsVerified(false);
            setVerificationMsg(res.message);
            // Hook handles basic validation errors, but we can show message here too
            if (res.message && res.message !== "Consent required" && res.message !== "Missing inputs") {
                toast.error(res.message);
            }
        }
    };
    const [paymentWidget, setPaymentWidget] = useState<PaymentWidgetInstance | null>(null);
    const paymentMethodsWidgetRef = useRef<HTMLDivElement>(null);
    const [price, setPrice] = useState(0);
    const [finalCategory, setFinalCategory] = useState('');

    // NicePay State
    const [nicePayActive, setNicePayActive] = useState(false);
    const [nicePaySecret, setNicePaySecret] = useState('');
    const [currentRegId, setCurrentRegId] = useState<string | null>(null);

    // [Fix-Step 255] Unified Async Initialization
    useEffect(() => {
        // Guard: Wait for Auth to settle
        if (auth.loading) return;

        // Capture safe ID
        const societyId = info?.societyId;
        if (!confId || !societyId) return;

        const initializeRegistration = async () => {
            setIsInitializing(true);
            const uid = auth.user?.id;

            // DIAGNOSTIC LOGS
            // console.log(`[Registration Init] 1. Auth Status: ${uid || 'GUEST'}`);

            try {
                // Prepare Promises
                const promises: Promise<any>[] = [];

                // 1. User Profile (if logged in)
                if (uid) {
                    promises.push(getDoc(doc(db, 'users', uid)));
                } else {
                    promises.push(Promise.resolve(null)); // Placeholder
                }

                // 2. Identity Terms (Try standard path: societies/{id}/settings/identity)
                // Note: ConfigPage writes to 'settings/identity'.
                promises.push(getDoc(doc(db, 'societies', societyId, 'settings', 'identity')));

                // 3. Reg Settings (Prices)
                promises.push(getDoc(doc(db, `conferences/${confId}/settings/registration`)));

                // 4. Grades
                promises.push(getDocs(collection(db, `societies/${societyId}/settings/grades/list`)));

                // 5. Infra (Payment)
                promises.push(getDoc(doc(db, `societies/${societyId}/settings/infrastructure`)));

                // EXECUTE ALL
                const [userSnap, identitySnap, regSnap, gradesSnap, infraSnap] = await Promise.all(promises);

                // --- PROCESS USER ---
                // console.log(`[Registration Init] 2. User Profile: ${userSnap?.exists() ? 'Found' : 'Missing/Guest'}`);
                if (userSnap && userSnap.exists()) {
                    const uData = userSnap.data();
                    setFormData(prev => ({
                        ...prev,
                        name: uData.name || uData.userName || '',
                        email: uData.email || '',
                        phone: uData.phone || uData.phoneNumber || '',
                        affiliation: uData.affiliation || uData.organization || '',
                        licenseNumber: uData.licenseNumber || ''
                    }));
                }

                // --- PROCESS TERMS ---
                console.log(`[Registration Init] 3. Identity Terms: ${identitySnap.exists() ? 'Found' : 'Missing'}`);
                if (identitySnap.exists()) {
                    const tData = identitySnap.data();
                    const isEn = language === 'en';

                    // [Fix-Step 296] Bilingual Terms Logic
                    // Prioritize: terms.en.tos -> terms_en.tos -> termsOfService_en -> termsOfService
                    const getLocalizedTerm = (key: string, legacyKey: string) => {
                        if (isEn) {
                            // Fix-Step 332: Support root-level _en fields from AdminIdentity
                            return tData[`${legacyKey}_en`] || tData.terms?.en?.[key] || tData.terms_en?.[key] || tData[legacyKey]?.en || tData[legacyKey] || '';
                        }
                        return tData.terms?.ko?.[key] || tData.terms_ko?.[key] || tData[legacyKey]?.ko || tData[legacyKey] || '';
                    };

                    setTermsContent({
                        tos: getLocalizedTerm('tos', 'termsOfService'),
                        privacy: getLocalizedTerm('privacy', 'privacyPolicy'),
                        refund: getLocalizedTerm('refund', 'refundPolicy'),
                        thirdParty: getLocalizedTerm('thirdParty', 'thirdPartyConsent'),
                        marketing: getLocalizedTerm('marketing', 'marketingConsentText'),
                        info: getLocalizedTerm('info', 'infoConsentText')
                    });
                } else {
                    // Fallback to system settings if identity is missing
                    const sysSnap = await getDoc(doc(db, 'system/settings'));
                    if (sysSnap.exists()) {
                        const sData = sysSnap.data();
                        setTermsContent({
                            tos: sData.termsService || '',
                            privacy: sData.termsPrivacy || '',
                            thirdParty: sData.termsThirdParty || '',
                            refund: '',
                            marketing: '',
                            info: ''
                        });
                    }
                }

                // --- PROCESS REGISTRATION SETTINGS ---
                if (regSnap.exists()) {
                    const data = regSnap.data() as RegistrationSettings;
                    setRegSettings(data);

                    const now = new Date();
                    const period = data.periods.find(p => {
                        const start = p.startDate.toDate();
                        const end = p.endDate.toDate();
                        return now >= start && now <= end;
                    });

                    if (period) {
                        setActivePeriod(period);
                    } else {
                        console.warn("No active registration period found.");
                    }
                }

                // --- PROCESS GRADES ---
                if (!gradesSnap.empty) {
                    const list = gradesSnap.docs.map((d: any) => ({
                        id: d.id,
                        name: d.data().name,
                        code: d.data().code
                    }));
                    setGrades(list);
                    if (list.length > 0) {
                        const defaultGrade = list.find((g: any) => {
                            const n = g.name.toLowerCase();
                            return n.includes('비회원') || n.includes('non-member') || n.includes('non member');
                        }) || list[0];
                        setSelectedGradeId(defaultGrade.id);
                    }
                } else {
                    // Fallback
                    const fallbackGrades = [
                        { id: 'MEMBER', name: 'Member (정회원)', code: 'member' },
                        { id: 'NON_MEMBER', name: 'Non-Member (비회원)', code: 'non_member' }
                    ];
                    setGrades(fallbackGrades);
                    setSelectedGradeId('NON_MEMBER');
                }

                // --- PROCESS INFRA ---
                const defaultClientKey = "test_gck_4yKeq5bgrpXJA4nz4qxArGX0lzW6";
                if (infraSnap.exists()) {
                    const data = infraSnap.data() as InfraSettings;
                    const globalEnabled = data.payment?.global?.enabled === true;
                    const useGlobalPayment = language === 'en' && globalEnabled;

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

            } catch (error) {
                console.error("Initialization Failed:", error);
                toast.error("Failed to load registration data.");
            } finally {
                setIsInitializing(false);
            }
        };

        initializeRegistration();
    }, [confId, info?.societyId, language, auth.loading, auth.user]);

    // 3. Initialize Toss Widget (Only on Step 3 - Payment)
    useEffect(() => {
        if (currentStep === 3 && tossClientKey && paymentProvider === 'TOSS') {
            (async () => {
                const customerKey = auth.user ? auth.user.id : uuidv4();
                try {
                    const widget = await loadPaymentWidget(tossClientKey, customerKey);
                    setPaymentWidget(widget);
                } catch (error) {
                    console.error("Failed to load payment widget:", error);
                    toast.error("Payment System Error");
                }
            })();
        }
    }, [currentStep, auth.user, tossClientKey, paymentProvider]);

    // 4. Render Payment Methods
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
    const handleNext = async () => {
        setShowValidation(true); // Trigger visual validation
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
                toast.error("Guest initialization failed.");
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

        } else if (currentStep === 1) {
            // Validate Step 1 (Info)
            if (!formData.name || !formData.email || !formData.phone || !formData.affiliation) {
                toast.error(language === 'ko' ? "모든 필수 항목을 입력해주세요." : "Please fill in all required fields.");
                return;
            }

            // [Fix-Step 261] Guest Check: Email & Password
            if (!auth.user || isAnonymous) {
                if (!formData.simplePassword) {
                    toast.error(language === 'ko' ? "비회원 조회를 위한 비밀번호를 입력해주세요." : "Please enter a password for guest access.");
                    return;
                }

                // Check if email exists in users collection (via Cloud Function)
                setIsLoading(true);
                try {
                    const checkEmailFn = httpsCallable(functions, 'checkEmailExists');
                    const { data }: any = await checkEmailFn({ email: formData.email });

                    if (data.exists) {
                        alert(language === 'ko' ? "이미 가입된 회원입니다. 로그인 페이지로 이동합니다." : "Account exists. Redirecting to login.");
                        // Redirect to login with return URL
                        const currentUrl = window.location.pathname + window.location.search;
                        navigate(`/auth?mode=login&email=${formData.email}&returnUrl=${encodeURIComponent(currentUrl)}`);
                        return;
                    }
                } catch (e) {
                    console.error("Email check failed:", e);
                    // Proceed if check fails? Or block? Better to block or warn.
                } finally {
                    setIsLoading(false);
                }
            }

            const nextStep = 2;
            setCurrentStep(nextStep);

            // Auto-Save
            if (auth.user || firebaseAuth.currentUser) {
                autoSave(nextStep, { ...formData, agreements }, currentRegId).then(id => { if (id) setCurrentRegId(id); });
            }

        } else if (currentStep === 2) {
            // Validate Step 2 (Verification)
            const selectedGrade = grades.find(g => g.id === selectedGradeId);
            const lowerName = selectedGrade?.name.toLowerCase() || '';
            const isNonMember = lowerName.includes('비회원') || lowerName.includes('non-member');

            if (!isNonMember && !isVerified) {
                toast.error(language === 'ko' ? "회원 인증을 완료해주세요." : "Please verify your membership.");
                return;
            }

            if (!activePeriod) {
                toast.error("No active registration period.");
                return;
            }

            // Calculate Price
            const periodName = language === 'ko' ? activePeriod.name.ko : (activePeriod.name.en || activePeriod.name.ko);
            const tierPrice = activePeriod.prices[selectedGradeId] ?? 0;

            setPrice(tierPrice);
            setFinalCategory(`${periodName} - ${selectedGrade?.name}`);

            const nextStep = 3;
            setCurrentStep(nextStep);

            // Auto-Save (Include Verification Data)
            if (auth.user || firebaseAuth.currentUser) {
                autoSave(nextStep, { ...formData, agreements, memberVerificationData }, currentRegId).then(id => { if (id) setCurrentRegId(id); });
            }
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => Math.max(0, prev - 1));
    };

    const createPendingRegistration = async () => {
        if (!confId) return null;
        // [Fix-Step 146] Custom Order ID Format
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // 20260115
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 chars
        const prefix = info?.societyId ? info.societyId.toUpperCase() : 'CONF';
        const orderId = `${prefix}-${dateStr}-${rand}`;

        const regRef = doc(collection(db, `conferences/${confId}/registrations`));

        const regData = {
            id: regRef.id,
            userId: auth.user?.id || 'GUEST',
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
                console.error("Failed to save guest data:", e);
                // Non-blocking
            }
        }

        await setDoc(regRef, regData);
        setCurrentRegId(regRef.id);
        return { regId: regRef.id, orderId };
    };

    const handlePayment = async () => {
        if (!confId) return;
        setIsLoading(true);

        try {
            // [Fix-Step 299] Account Linking for Guests
            // Try to link before creating registration.
            let userIsAnonymous = firebaseAuth.currentUser?.isAnonymous;

            if (userIsAnonymous && formData.simplePassword && formData.email) {
                try {
                    console.log("[Account Linking] Attempting to upgrade guest...");
                    const credential = EmailAuthProvider.credential(formData.email, formData.simplePassword);
                    const user = firebaseAuth.currentUser;

                    if (user) {
                        await linkWithCredential(user, credential);
                        console.log("[Account Linking] Success! Guest upgraded.");
                        toast.success(language === 'ko' ? "계정이 생성되었습니다." : "Account created successfully.");

                        // Update Role in Firestore
                        await setDoc(doc(db, 'users', user.uid), {
                            email: formData.email,
                            role: 'guest', // or 'semi-member'
                            createdAt: Timestamp.now(),
                            updatedAt: Timestamp.now()
                        }, { merge: true });

                        // Update local flag
                        userIsAnonymous = false;
                    }
                } catch (linkError: any) {
                    console.error("[Account Linking] Failed:", linkError);
                    if (linkError.code === 'auth/email-already-in-use') {
                        toast.error("Email already in use. Proceeding as Guest.");
                    } else {
                        toast.error("Account linking failed. Proceeding as Guest.");
                    }
                    // Do not block payment. Continue as anonymous.
                }
            }

            // 1. Create PENDING Registration
            const regInfo = await createPendingRegistration();
            if (!regInfo) throw new Error("Failed to create registration");

            // 2. Process Payment based on Provider
            if (paymentProvider === 'NICE') {
                // Trigger NicePay Form
                setNicePayActive(true);
                // The form will auto-submit when ready
            } else if (paymentProvider === 'TOSS' && paymentWidget) {
                const origin = window.location.origin;
                // [Fix-Step 142] Use Global Payment Handler with Context Params
                const successUrl = `${origin}/payment/success?slug=${slug}&societyId=${info?.societyId}&confId=${confId}&regId=${regInfo.regId}`;
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
        } catch (error) {
            console.error("Payment request failed:", error);
            toast.error("Payment initialization failed.");
            setIsLoading(false);
        }
    };

    const handleNiceSuccess = async (data: any) => {
        // console.log("NicePay Success Data:", data);
        try {
            const confirmFn = httpsCallable(functions, 'confirmNicePayment');
            const result = await confirmFn({
                tid: data.TxTid,
                amt: price,
                mid: tossClientKey, // Using apiKey as MID
                key: nicePaySecret, // Merchant Key
                regId: currentRegId,
                confId: confId
            });

            const resData = result.data as any;
            if (resData.success) {
                navigate(`/${slug}/register/success?regId=${currentRegId}`);
            } else {
                toast.error("Payment Confirmation Failed: " + resData.message);
                setIsLoading(false);
                setNicePayActive(false);
            }
        } catch (error: any) {
            console.error("NicePay Confirm Error:", error);
            toast.error("Payment Confirmation Error: " + error.message);
            setIsLoading(false);
            setNicePayActive(false);
        }
    };

    const handleNiceFail = (error: string) => {
        console.error("NicePay Fail:", error);
        toast.error("Payment Failed: " + error);
        setIsLoading(false);
        setNicePayActive(false);
    };

    const openTermModal = (title: string, content: string) => {
        setViewingTerm({ title, content });
    };

    if (confLoading || isInitializing) {
        return (
            <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 animate-pulse">
                <div className="max-w-3xl mx-auto">
                    {/* Header Skeleton */}
                    <div className="mb-10 text-center">
                        <Skeleton className="h-6 w-24 mx-auto mb-4" /> {/* Back Button */}
                        <Skeleton className="h-10 w-64 mx-auto mb-2" />
                        <Skeleton className="h-4 w-40 mx-auto" />
                    </div>

                    {/* Stepper Skeleton */}
                    <div className="mb-8 flex justify-between px-4">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <div key={s} className="flex flex-col items-center gap-2">
                                <Skeleton className="w-8 h-8 rounded-full" />
                                <Skeleton className="w-12 h-3" />
                            </div>
                        ))}
                    </div>

                    {/* Card Skeleton */}
                    <div className="bg-white shadow-lg rounded-xl p-6 space-y-6">
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-1/3" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                        <div className="space-y-4 pt-4">
                            <Skeleton className="h-12 w-full rounded-md" />
                            <Skeleton className="h-12 w-full rounded-md" />
                            <Skeleton className="h-12 w-full rounded-md" />
                        </div>
                        <div className="flex justify-between pt-6">
                            <Skeleton className="h-10 w-24 rounded-md" />
                            <Skeleton className="h-10 w-24 rounded-md" />
                        </div>
                    </div>
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
                {/* Header */}
                <div className="mb-10">
                    <Button
                        variant="ghost"
                        className="mb-6 pl-0 hover:bg-transparent hover:text-blue-600 transition-colors"
                        onClick={() => navigate(`/${slug}`)}
                    >
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        {language === 'ko' ? '행사 홈으로' : 'Back to Home'}
                    </Button>

                    <div className="text-center">
                        <h2 className="text-3xl font-extrabold text-gray-900">
                            {language === 'ko' ? '사전등록' : 'Registration'}
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                            {info?.title ? (language === 'ko' ? info.title.ko : info.title.en) : 'Conference'}
                        </p>
                    </div>
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
                                            readOnly={!!auth.user?.uid && !isAnonymous}
                                            className={`${(auth.user?.uid && !isAnonymous) ? "bg-gray-100 cursor-not-allowed" : ""} ${showValidation && !formData.name ? "border-red-500 focus-visible:ring-red-500 bg-red-50/50" : ""}`}
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
                                            readOnly={!!auth.user?.uid && !isAnonymous}
                                            className={`${(auth.user?.uid && !isAnonymous) ? "bg-gray-100 cursor-not-allowed" : ""} ${showValidation && !formData.affiliation ? "border-red-500 focus-visible:ring-red-500 bg-red-50/50" : ""}`}
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
                                            readOnly={!!auth.user?.uid && !isAnonymous}
                                            className={`${(auth.user?.uid && !isAnonymous) ? "bg-gray-100 cursor-not-allowed" : ""} ${showValidation && !formData.phone ? "border-red-500 focus-visible:ring-red-500 bg-red-50/50" : ""}`}
                                        />
                                        {showValidation && !formData.phone && <p className="text-xs text-red-500 font-medium">전화번호를 입력해주세요.</p>}
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>License Number (Optional)</Label>
                                        <Input
                                            value={formData.licenseNumber}
                                            onChange={e => setFormData({ ...formData, licenseNumber: e.target.value })}
                                            placeholder="12345"
                                            readOnly={!!auth.user?.uid && !isAnonymous}
                                            className={(auth.user?.uid && !isAnonymous) ? "bg-gray-100 cursor-not-allowed" : ""}
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
                                    )}
                                </div>
                            </CardContent>
                        </>
                    )}

                    {/* STEP 2: Category & Verification (DYNAMIC) */}
                    {currentStep === 2 && (
                        <>
                            <CardHeader>
                                <CardTitle>{language === 'ko' ? '등록 구분 선택' : 'Registration Category'}</CardTitle>
                                <CardDescription>
                                    {activePeriod ? (
                                        <span className="text-blue-600 font-semibold">
                                            [{language === 'ko' ? activePeriod.name.ko : activePeriod.name.en}]
                                        </span>
                                    ) : (
                                        <span className="text-red-500">No active registration period.</span>
                                    )}
                                    {' '}{language === 'ko' ? '기간입니다.' : 'is active.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* [Fix-Step 346] Force Verification UI to Top with Enhanced Styling */}
                                {!isVerified && (
                                    <div className="bg-blue-50 border-2 border-blue-400 shadow-md rounded-xl p-6 mb-8 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-blue-100 rounded-full hidden sm:block">
                                                <CheckCircle2 className="w-6 h-6 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-blue-900 mb-2">
                                                    {language === 'ko' ? '1. 먼저 회원 인증을 진행해주세요' : '1. Member Verification First'}
                                                </h3>
                                                <p className="text-sm text-blue-700 mb-4 leading-relaxed">
                                                    {language === 'ko'
                                                        ? '이름 + 면허번호(학회 홈페이지 ID) 입력하고 인증하면, 해당하는 등록비가 자동으로 선택됩니다.'
                                                        : 'Enter your name and license number to auto-select your registration fee.'}
                                                </p>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-blue-900 font-semibold">이름 (Name)</Label>
                                                        <Input
                                                            placeholder="홍길동"
                                                            value={verifyName}
                                                            onChange={e => setVerifyName(e.target.value)}
                                                            className="bg-white border-blue-200 focus:border-blue-500"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-blue-900 font-semibold">면허번호/코드 (License No.)</Label>
                                                        <Input
                                                            placeholder="12345"
                                                            value={verifyCode}
                                                            onChange={e => setVerifyCode(e.target.value)}
                                                            className="bg-white border-blue-200 focus:border-blue-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-2 mb-4 bg-white/50 p-2 rounded">
                                                    <Checkbox id="verify_consent_top" checked={verifyConsent} onCheckedChange={(c) => setVerifyConsent(c === true)} />
                                                    <Label htmlFor="verify_consent_top" className="cursor-pointer text-sm text-blue-800">
                                                        {language === 'ko'
                                                            ? '개인정보(이름, 면허번호, 학회 홈페이지 ID) 제공 및 조회에 동의합니다.'
                                                            : 'I agree to verify my identity against the society database.'}
                                                    </Label>
                                                </div>

                                                <Button onClick={performMemberVerification} disabled={isLoading || verifyLoading} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 shadow-sm">
                                                    {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                                    {language === 'ko' ? '회원 인증 및 등급 자동 선택' : 'Verify & Select Grade'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isVerified && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center text-green-800 animate-in fade-in duration-500">
                                        <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
                                        <span className="font-medium">
                                            {language === 'ko' ? '회원 인증이 완료되었습니다.' : 'Member verification completed.'}
                                        </span>
                                    </div>
                                )}

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                        <div className="w-full border-t border-gray-200"></div>
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-white px-2 text-sm text-gray-500">
                                            {language === 'ko' ? '2. 등록 등급 선택' : '2. Select Grade'}
                                        </span>
                                    </div>
                                </div>

                                <RadioGroup value={selectedGradeId} onValueChange={(val: any) => {
                                    if (isVerified) return; // Lock if verified (Auto-selected)
                                    setSelectedGradeId(val);
                                    setIsVerified(false);
                                    setVerificationMsg('');
                                }}>
                                    {grades.map(grade => {
                                        const lowerName = grade.name.toLowerCase();
                                        const isNonMember = lowerName.includes('비회원') || lowerName.includes('non-member');
                                        const isSelected = selectedGradeId === grade.id;

                                        // [Fix-Step 369] Disable Logic: Disabled if NOT verified AND NOT non-member
                                        const isDisabled = !isVerified && !isNonMember;

                                        return (
                                            <div key={grade.id} className={`flex items-start space-x-3 p-4 rounded-lg border ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} ${isDisabled ? 'opacity-60 bg-gray-50' : ''}`}>
                                                <RadioGroupItem
                                                    value={grade.id}
                                                    id={grade.id}
                                                    disabled={isDisabled || (isVerified && grade.id !== selectedGradeId)}
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center">
                                                        <Label htmlFor={grade.id} className={`font-bold text-lg ${isDisabled ? 'text-gray-400' : 'cursor-pointer'}`}>{grade.name}</Label>
                                                        {/* [Fix-Step 369] Conditional Text */}
                                                        {isDisabled && (
                                                            <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                                {language === 'ko' ? '인증 후 선택 가능' : 'Requires Verification'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={`text-sm font-semibold mt-1 ${isDisabled ? 'text-gray-400' : 'text-blue-600'}`}>
                                                        ₩{activePeriod?.prices[grade.id]?.toLocaleString() ?? 0}
                                                    </p>

                                                    {/* [Fix-Step 345] Removed inline verification box in favor of top section */}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {grades.length === 0 && (
                                        <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg">
                                            등록된 회원 등급이 없습니다. 관리자에게 문의하세요.
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

                    <CardFooter className="flex justify-between pt-6 border-t">
                        <Button
                            variant="outline"
                            onClick={handleBack}
                            disabled={currentStep === 0 || isLoading}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            {language === 'ko' ? '이전' : 'Back'}
                        </Button>

                        {currentStep < 3 ? (
                            <Button onClick={handleNext}>
                                {language === 'ko' ? '다음' : 'Next'}
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button onClick={handlePayment} disabled={isLoading || (!paymentWidget && paymentProvider !== 'NICE')} className="bg-blue-600 hover:bg-blue-700">
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
                    <DialogHeader>
                        <DialogTitle>{language === 'ko' ? '학회 정회원 인증' : 'Member Verification'}</DialogTitle>
                        <DialogDescription>
                            {language === 'ko' ? '학회에 등록된 회원 정보를 입력해주세요.' : 'Please enter your society member details.'}
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
                </DialogContent>
            </Dialog>
        </div>
    );
}
