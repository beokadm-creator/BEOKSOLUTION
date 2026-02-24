 
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '../firebase';
import { useSubdomain } from '../hooks/useSubdomain';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { loadPaymentWidget, PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';
import { v4 as uuidv4 } from 'uuid';
import { CheckCircle2, Circle } from 'lucide-react';

// Types
interface MembershipFeeTier {
    id: string;
    name: string;
    amount: number;
    validityMonths?: number;
    validityYears?: number;
    isActive: boolean;
}

interface UserInfo {
    id: string;
    name: string;
    email: string;
    licenseNumber?: string;
    code?: string;
    expiryDate?: string;
}

export default function MembershipPaymentPage() {
    const navigate = useNavigate();

    // Get sid from subdomain (kadd) since we're accessing via kadd.eregi.co.kr
    const { subdomain } = useSubdomain();
    const sid = subdomain;

    console.log('[MembershipPaymentPage] Sid from subdomain:', sid);

    const [loading, setLoading] = useState(true);
    console.log('[MembershipPaymentPage] Component mounted');

    // Get current user directly from Firebase Auth (avoid useAuth session clearing)
    const authUser = firebaseAuth.currentUser;

    const [user, setUser] = useState<UserInfo | null>(null);
    const [feeTiers, setFeeTiers] = useState<MembershipFeeTier[]>([]);
    const [selectedTier, setSelectedTier] = useState<string>('');
    const [tossClientKey, setTossClientKey] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    // Payment Widget
    const [paymentWidget, setPaymentWidget] = useState<PaymentWidgetInstance | null>(null);
    const paymentMethodsWidgetRef = useRef<HTMLDivElement>(null);

    // Add dependency on sid to trigger reload when it changes
    useEffect(() => {
        console.log('[MembershipPaymentPage] Sid changed to:', sid);
    }, [sid]);

    // Reset loading when sid changes
    useEffect(() => {
        if (sid) {
            requestAnimationFrame(() => {
                const initialLoading = true;
                setLoading(initialLoading);
            });
        }
    }, [sid]);

    useEffect(() => {
        // Only load data if sid is available
        if (!sid) {
            console.log('[MembershipPaymentPage] No sid available, skipping data load');
            return;
        }

        console.log('[MembershipPaymentPage] Loading data with sid:', sid);

        const loadData = async () => {
            try {
                // 1. 로그인 사용자 정보 로드
                if (!authUser) {
                    console.log('[MembershipPaymentPage] No auth user available');
                    toast.error('로그인이 필요합니다.');
                    navigate('/login');
                    return;
                }

                console.log('[MembershipPaymentPage] Auth user found:', authUser.uid);

                // 2. Try to get user from users/{uid} first
                const userDoc = await getDoc(doc(db, 'users', authUser.uid));
                let userData: Record<string, unknown> | null = null;

                if (userDoc.exists()) {
                    console.log('[MembershipPaymentPage] User doc found in users/{uid}');
                    userData = userDoc.data();
                } else {
                    console.log('[MembershipPaymentPage] User doc not found in users/{uid}, trying societies/kadd/members');

                    // 3. If not found, try to get from societies/kadd/members
                    const membersRef = collection(db, 'societies', sid, 'members');

                    // Try multiple search patterns: id (uid), code, licenseNumber
                    let memberSnap;

                    // Pattern 1: Search by id (Firebase Auth uid)
                    console.log('[MembershipPaymentPage] Trying search by id (uid):', authUser.uid);
                    memberSnap = await getDocs(query(membersRef, where('id', '==', authUser.uid)));

                    // Pattern 2: If not found, try code
                    if (memberSnap.empty) {
                        console.log('[MembershipPaymentPage] Trying search by code...');
                        const q1 = query(membersRef, where('licenseNumber', '==', authUser.email || ''));
                        const snap1 = await getDocs(q1);
                        if (!snap1.empty) {
                            memberSnap = snap1;
                        }
                    }

                    // Pattern 3: Try direct code search with empty string fallback
                    if (memberSnap.empty) {
                        console.log('[MembershipPaymentPage] Trying all members to find match...');
                        memberSnap = await getDocs(membersRef);
                        console.log('[MembershipPaymentPage] Total members found:', memberSnap.docs.length);
                    }

                    if (!memberSnap.empty && memberSnap.docs.length > 0) {
                        console.log('[MembershipPaymentPage] Member found in societies/kadd/members');
                        const memberData = memberSnap.docs[0].data();
                        console.log('[MembershipPaymentPage] Member data:', memberData);

                        // Create user data from member data
                        userData = {
                            name: memberData.name,
                            email: memberData.email || authUser.email,
                            licenseNumber: memberData.code || memberData.licenseNumber,
                            code: memberData.code || memberData.licenseNumber,
                            expiryDate: memberData.expiryDate,
                            grade: memberData.grade
                        };
                    } else {
                        console.error('[MembershipPaymentPage] User not found in either users/{uid} or societies/kadd/members');
                        console.log('[MembershipPaymentPage] Auth uid:', authUser.uid);
                        console.log('[MembershipPaymentPage] Auth email:', authUser.email);
                        toast.error('회원 정보를 찾을 수 없습니다.');
                        setLoading(false);
                        return;
                    }
                }

                console.log('[MembershipPaymentPage] User data loaded:', userData);
                setUser({
                    id: userDoc.id || authUser.uid,
                    name: (userData.name as string) || (userData.userName as string) || '',
                    email: (userData.email as string) || authUser.email || '',
                    licenseNumber: (userData.licenseNumber as string) || (userData.code as string) || '',
                    code: (userData.code as string) || (userData.licenseNumber as string) || '',
                    expiryDate: (userData.expiryDate as string) || undefined
                });

                // 4. 회원등급별 금액 설정 로드
                const feeTierDoc = await getDoc(doc(db, 'societies', sid, 'settings', 'membership-fees'));
                if (feeTierDoc.exists()) {
                    const tiers = feeTierDoc.data().membershipFeeTiers || [];
                    const activeTiers = (tiers as MembershipFeeTier[]).filter(t => t.isActive);
                    setFeeTiers(activeTiers);
                    if (activeTiers.length > 0) {
                        setSelectedTier(activeTiers[0].id);
                    }
                }

                // 5. Toss 클라이언트 키 로드
                const infraDoc = await getDoc(doc(db, 'societies', sid, 'settings', 'infrastructure'));
                if (infraDoc.exists()) {
                    const infra = infraDoc.data();
                    const key = infra.payment?.domestic?.apiKey;
                    if (key) {
                        setTossClientKey(key);
                        console.log('[MembershipPaymentPage] Toss client key loaded');
                    } else {
                        console.warn('[MembershipPaymentPage] No Toss API key found in infrastructure settings');
                    }
                } else {
                    console.warn('[MembershipPaymentPage] No infrastructure settings found');
                }

                setLoading(false);
            } catch (error) {
                console.error("Load error:", error);
                toast.error('데이터 로드 실패');
                setLoading(false);
            }
        };

        loadData();
    }, [sid, navigate, authUser]);

    // Initialize Toss Payment Widget
    useEffect(() => {
        if (tossClientKey && selectedTier) {
            (async () => {
                try {
                    const customerKey = `cust_${uuidv4()}`;
                    console.log('[MembershipPaymentPage] Initializing Toss widget with customerKey:', customerKey);
                    const widget = await loadPaymentWidget(tossClientKey, customerKey);
                    setPaymentWidget(widget);
                    console.log('[MembershipPaymentPage] Toss widget initialized');
                } catch (error) {
                    console.error('[MembershipPaymentPage] Widget initialization error:', error);
                    toast.error('결제 위젯 초기화 실패');
                }
            })();
        }
    }, [tossClientKey, selectedTier]);

    // Render payment methods
    useEffect(() => {
        if (paymentWidget && paymentMethodsWidgetRef.current && selectedTier) {
            const tier = feeTiers.find(t => t.id === selectedTier);
            if (tier) {
                console.log('[MembershipPaymentPage] Rendering payment methods for amount:', tier.amount);
                paymentWidget.renderPaymentMethods(
                    '#payment-widget',
                    { value: tier.amount }
                );
            }
        }
    }, [paymentWidget, selectedTier, feeTiers]);

    const handlePayment = async () => {
        if (!user || !selectedTier) {
            toast.error('필수 정보를 선택해주세요.');
            return;
        }

        const tier = feeTiers.find(t => t.id === selectedTier);
        if (!tier) {
            toast.error('잘못된 회원등급입니다.');
            return;
        }

        if (!paymentWidget) {
            toast.error('결제 위젯이 초기화되지 않았습니다.');
            return;
        }

        setProcessing(true);

        try {
            // 결제 ID 생성
            const orderId = `MEMB-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            console.log('[MembershipPaymentPage] Requesting payment:', { orderId, tier: tier.name, amount: tier.amount });

            // 토스페이먼츠 결제 요청
            await paymentWidget.requestPayment({
                orderId,
                orderName: `${tier.name} 회비`,
                customerName: user.name,
                customerEmail: user.email,
                successUrl: `${window.location.origin}/payment/success?societyId=${sid}&type=membership&tierId=${selectedTier}`,
                failUrl: `${window.location.origin}/mypage/membership?error=payment_failed`,
            });

            console.log('[MembershipPaymentPage] Payment widget opened');
        } catch (error: unknown) {
            console.error("Payment error:", error);

            let errorMessage = '결제 시작 실패';

            if (error && typeof error === 'object') {
                const err = error as { code?: string; message?: string };
                const rawMsg = err.message || '';

                if (err.code === 'PAY_PROCESS_CANCELED' || rawMsg.includes('cancel')) {
                    errorMessage = '결제가 취소되었습니다.';
                } else if (rawMsg.toLowerCase().includes('phone') || rawMsg.toLowerCase().includes('tel') || rawMsg.includes('연락처') || rawMsg.includes('전화번호')) {
                    errorMessage = '연락처 형식 오류: 010-1234-5678 형식으로 입력해주세요. (하이픈 포함 필수)';
                } else if (rawMsg.toLowerCase().includes('network') || rawMsg.toLowerCase().includes('fetch')) {
                    errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인 후 다시 시도해주세요.';
                } else if (rawMsg) {
                    errorMessage = `결제 오류: ${rawMsg}`;
                }
            }

            toast.error(errorMessage, { duration: 6000 });
            setProcessing(false);
        }
    };

    if (loading) return <LoadingSpinner />;
    if (!sid) return <LoadingSpinner />;
    if (!user) return <div className="min-h-screen flex items-center justify-center">회원 정보를 찾을 수 없습니다.</div>;

    const selectedTierData = feeTiers.find(t => t.id === selectedTier);

    return (
        <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-8">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-blue-600" />
                        <span className="text-sm font-medium text-gray-900">회원 정보 확인</span>
                    </div>
                    <div className="w-12 h-px bg-gray-300" />
                    <div className={`flex items-center gap-2 ${selectedTier ? 'text-blue-600' : 'text-gray-400'}`}>
                        {selectedTier ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                        <span className="text-sm font-medium">등급 선택</span>
                    </div>
                    <div className="w-12 h-px bg-gray-300" />
                    <div className={`flex items-center gap-2 ${selectedTier ? 'text-blue-600' : 'text-gray-400'}`}>
                        {selectedTier ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                        <span className="text-sm font-medium">결제</span>
                    </div>
                </div>
            </div>

            {/* 회원 정보 */}
            <Card>
                <CardHeader>
                    <CardTitle>회원 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500">이름</p>
                            <p className="text-lg font-semibold">{user.name}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">이메일</p>
                            <p className="text-lg font-semibold">{user.email}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">면허번호/코드</p>
                            <p className="text-lg font-semibold">{user.licenseNumber || user.code || '-'}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">현재 유효기간</p>
                            <p className="text-lg font-semibold">{user.expiryDate || '설정 안됨'}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 회원등급 선택 */}
            {feeTiers.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>회원등급 선택</CardTitle>
                        <CardDescription>
                            회원등급에 따른 금액과 유효기간을 확인하세요.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <RadioGroup value={selectedTier} onValueChange={(value) => setSelectedTier(value as string)}>
                            {feeTiers.map(tier => (
                                <div
                                    key={tier.id}
                                    className={`flex items-center justify-between p-4 border rounded-lg transition-all ${selectedTier === tier.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <RadioGroupItem value={tier.id} id={tier.id} />
                                        <div className="flex-1">
                                            <p className="font-semibold text-lg">{tier.name}</p>
                                            <p className="text-gray-600">
                                                {tier.validityMonths ? `${tier.validityMonths}개월` : `${tier.validityYears}년`} / ₩{tier.amount.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </RadioGroup>
                    </CardContent>
                </Card>
            )}

            {/* 결제 위젯 영역 */}
            {selectedTier && tossClientKey && (
                <Card>
                    <CardHeader>
                        <CardTitle>결제 정보</CardTitle>
                        <CardDescription>
                            결제 수단을 선택하고 결제를 진행하세요.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* 결제 금액 표시 */}
                        {selectedTierData && (
                            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-700">결제 금액</span>
                                    <span className="text-2xl font-bold text-blue-600">
                                        ₩{selectedTierData.amount.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* 토스페이먼츠 위젯 렌더링 영역 */}
                        <div
                            id="payment-widget"
                            ref={paymentMethodsWidgetRef}
                            className="min-h-[400px]"
                        />

                        {/* 결제 버튼 */}
                        <div className="mt-6 flex justify-end">
                            <Button
                                onClick={handlePayment}
                                disabled={processing || !selectedTier || !paymentWidget}
                                className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg font-semibold"
                                type="button"
                            >
                                {processing ? '결제 처리 중...' : '결제하기'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!tossClientKey && (
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-gray-500">
                            결제 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
