import { useBixolon } from '../../hooks/useBixolon';
// import { BadgeElement } from '../../types/schema';
import React, { useState, useEffect, useMemo } from 'react';
import { BadgeConfig } from '../../types/print';
import { useParams, useNavigate } from 'react-router-dom';
import { useExcel } from '../../hooks/useExcel';
import { useRegistrationsPagination } from '../../hooks/useRegistrationsPagination';
import { useConference } from '../../hooks/useConference';
import { convertBadgeLayoutToConfig } from '../../utils/badgeConverter';
import toast from 'react-hot-toast';
import { query, collection, getDocs, getDoc, limit, doc, updateDoc, Timestamp, addDoc, where, orderBy as fbOrderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase';
import { Loader2, Printer, ChevronLeft, ChevronRight, MessageCircle, CheckSquare, Square, CheckCircle2, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { EregiButton } from '../../components/eregi/EregiForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { safeFormatDate } from '../../utils/dateUtils';
import PrintHandler from '../../components/print/PrintHandler';
import BadgeTemplate from '../../components/print/BadgeTemplate';
import { kadd_2026 } from '../../data/conferences/kadd_2026.backup';
import { useRef } from 'react';
import { handleDeleteRegistrationWithCleanup } from '../../utils/registrationDeleteHandler'; // Keep cascade delete handler
import { Button } from '../../components/ui/button';

// Define the root-level registration type based on PaymentSuccessHandler
interface RootRegistration {
    id: string; // orderId
    orderId?: string; // Add optional orderId
    originalRegId: string;
    slug: string;
    societyId: string;
    conferenceId: string;
    userId: string;
    userName?: string; // Optional for safety
    userEmail?: string;
    userPhone?: string;
    userOrg?: string; // Optional
    affiliation?: string; // Optional
    tier: string; // Changed from grade to tier to match Firestore field
    categoryName?: string; // For fallback display
    amount: number;
    status: string; // 'PAID'
    paymentKey?: string;
    licenseNumber?: string; // Added
    paymentType?: string; // Added (e.g., '카드', '계좌이체')
    method?: string; // Fallback for payment method
    paymentMethod?: string; // Direct field from Firestore
    createdAt: Timestamp;
    badgeIssued?: boolean;
    badgeIssuedAt?: Timestamp;
    virtualAccount?: {
        bank: string;
        accountNumber: string;
        customerName?: string;
        dueDate?: string;
    };
    options?: any[]; // Allow any to bypass TS error
    badgeQr?: string; // Added for QR printing
}

const statusToKorean = (status: string) => {
    switch (status) {
        case 'PAID': return '결제완료';
        case 'PENDING': return '대기';
        case 'WAITING_FOR_DEPOSIT': return '입금대기';
        case 'PENDING_PAYMENT': return '결제진행중';
        case 'REFUNDED': return '환불완료';
        case 'REFUND_REQUESTED': return '환불요청';
        case 'CANCELED': return '취소됨';
        default: return status;
    }
};

// Display tier/grade value directly from DB (e.g., "정회원", "치과위생", "준회원")
const displayTier = (tier: string | undefined): string => {
    return tier || '-';
};

const RegistrationListPage: React.FC = () => {
    // [Fix-Step 150] BYPASS STRICT HOOK & MANUAL RESOLVE
    // const { slug } = useConference(); // REMOVED
    const { slug } = useParams<{ slug: string }>(); // Use Router Params directly
    const navigate = useNavigate();

    const { exportToExcel, processing: exporting } = useExcel();

    // Filters
    // [FIX-20250124-01] Default filter to SUCCESSFUL (PAID) to avoid showing incomplete registrations
    const [filterStatus, setFilterStatus] = useState('SUCCESSFUL');
    const [searchName, setSearchName] = useState('');

    // [Fix-Step 150] Smart Slug Auto-Resolution (Manual)
    const [activeSlug, setActiveSlug] = useState<string | null>(slug || null);
    const [conferenceId, setConferenceId] = useState<string | null>(null);
    const { info } = useConference(conferenceId || slug);
    const [status, setStatus] = useState<string>("Initializing...");

    // Bixolon Hook
    const { printBadge, printing: bixolonPrinting, error: bixolonError } = useBixolon();

    // Selection & Processing State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    // ─── Bulk Send Modal State ───────────────────────────────────────────────
    const [bulkModal, setBulkModal] = useState<{
        open: boolean;
        step: 'confirm' | 'processing' | 'done';
        targetIds: string[];
        confirmInput: string;
        checks: boolean[];
        result: { sent: number; failed: number; skipped: number; tokenGenerated: number } | null;
    }>({
        open: false,
        step: 'confirm',
        targetIds: [],
        confirmInput: '',
        checks: [false, false, false],
        result: null
    });

    const badgeConfig = useMemo(() => {
        if (info?.badgeLayout && info.badgeLayout.elements.length > 0) {
            return convertBadgeLayoutToConfig(info.badgeLayout);
        }
        return kadd_2026.badge as BadgeConfig;
    }, [info]);

    // Use pagination hook (follows project convention: use hooks, not direct Firestore)
    const {
        registrations,
        loading,
        error,
        currentPage,
        itemsPerPage,
        setCurrentPage,
        setItemsPerPage,
        hasMore,
        refresh: refreshPagination
    } = useRegistrationsPagination({
        conferenceId,
        itemsPerPage: 50,
        searchQuery: searchName
    });

    // Auto-Resolve Slug if missing
    useEffect(() => {
        if (slug) {
            // If slug is provided, we still need conferenceId. 
            // Query by slug to get ID.
            const findId = async () => {
                const q = query(collection(db, 'conferences'), where('slug', '==', slug));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setConferenceId(snap.docs[0].id);
                    setActiveSlug(slug);
                    setStatus(`URL Slug Found: ${slug}`);
                }
            };
            findId();
            return;
        }

        const resolveSlug = async () => {
            setStatus("HOOK BYPASSED. Searching for active conference...");
            try {
                // Try to find ANY conference for this society (or system-wide fallback)
                // Assuming 'kap' is the default society for this admin view
                const q = query(collection(db, 'conferences'), limit(1));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const found = snap.docs[0].data().slug;
                    const foundId = snap.docs[0].id;
                    setActiveSlug(found);
                    setConferenceId(foundId);
                    setStatus(`Auto-Resolved: ${found}`);
                } else {
                    console.error("No active conferences found in system.");
                    setStatus("Resolution Failed: No conferences found.");
                }
            } catch (e: unknown) {
                console.error("Failed to auto-resolve conference:", e);
                setStatus(`Resolution Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
        };

        resolveSlug();
    }, [slug]);

    // Action: Issue Badge Manual
    const handleIssueBadge = async (e: React.MouseEvent, reg: RootRegistration) => {
        e.stopPropagation();
        if (!confirm(`${reg.userName || '사용자'} 님의 명찰을 발급 처리하시겠습니까?`)) return;

        setIsProcessing(true);
        try {
            if (!conferenceId) {
                toast.error("Conference ID missing");
                return;
            }

            const functions = getFunctions();
            const issueBadgeFn = httpsCallable(functions, 'issueDigitalBadge');
            const result = await issueBadgeFn({
                confId: conferenceId,
                regId: reg.id,
                issueOption: 'DIGITAL_PRINT' // Default for manual admin issuance
            }) as { data: { success: boolean, badgeQr?: string } };

            if (result.data.success) {
                toast.success("명찰 발급 처리 완료");
                refreshPagination();
            } else {
                throw new Error("발급 처리에 실패했습니다.");
            }
        } catch (e: unknown) {
            console.error("Badge issue failed:", e);
            toast.error("처리 실패: " + (e instanceof Error ? e.message : '알 수 없는 오류'));
        } finally {
            setIsProcessing(false);
        }
    };

    // Action: Resend Notification (AlimTalk)
    const handleResendNotification = async (e: React.MouseEvent, reg: RootRegistration) => {
        e.stopPropagation();
        if (!confirm(`${reg.userName || '사용자'} 님에게 알림톡을 재발송하시겠습니까?`)) return;
        if (!conferenceId) return;

        setIsProcessing(true);
        try {
            const functions = getFunctions();
            const resendNotificationFn = httpsCallable(functions, 'resendBadgePrepToken');
            const result = await resendNotificationFn({
                confId: conferenceId,
                regId: reg.id
            }) as { data: { success: boolean; newToken: string } };

            if (result.data.success) {
                toast.success('알림톡이 발송되었습니다.');
            } else {
                throw new Error('Failed to send notification');
            }
        } catch (error: any) {
            console.error('Failed to send notification:', error);
            toast.error(`Error: ${error.message || 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Helper: Firestore에서 페이지네이션 없이 전체 등록 데이터를 가져오기
    const fetchAllRegistrations = async (): Promise<RootRegistration[]> => {
        if (!conferenceId) return [];
        const regRef = collection(db, 'conferences', conferenceId, 'registrations');
        const q = query(regRef, fbOrderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => {
            const docData = d.data();
            const flattened = { id: d.id, ...docData } as RootRegistration;
            if (!flattened.orderId) flattened.orderId = flattened.id;
            if (docData.userInfo) {
                flattened.userName = docData.userInfo.name || docData.userName;
                flattened.userEmail = docData.userInfo.email || docData.userEmail;
                flattened.userPhone = docData.userInfo.phone || docData.userPhone;
                flattened.affiliation = docData.userInfo.affiliation || docData.affiliation;
                flattened.licenseNumber = docData.userInfo.licenseNumber || docData.licenseNumber;
                if (!flattened.tier && docData.userInfo.grade) flattened.tier = docData.userInfo.grade;
            }
            if (!flattened.tier && docData.userTier) flattened.tier = docData.userTier;
            if (!flattened.tier && docData.categoryName) flattened.tier = docData.categoryName;
            if (!flattened.licenseNumber) {
                if (docData.license) flattened.licenseNumber = docData.license;
                else if (docData.userInfo?.licensenumber) flattened.licenseNumber = docData.userInfo.licensenumber;
                else if (docData.formData?.licenseNumber) flattened.licenseNumber = docData.formData.licenseNumber;
            }
            if (docData.badgeQr) flattened.badgeQr = docData.badgeQr;
            return flattened;
        });
    };

    // Action: Bulk Send — open safety modal
    const prepareBulkSend = async (mode: 'selected' | 'all') => {
        if (!conferenceId) return;

        let targetIds: string[];
        if (mode === 'selected') {
            targetIds = selectedIds;
        } else {
            const toastId = toast.loading('전체 등록자 목록을 불러오는 중...');
            try {
                const allRegs = await fetchAllRegistrations();
                // 중복 제거 + 필터 적용
                const seen = new Map<string, RootRegistration>();
                allRegs.forEach(r => {
                    if (!r.userId) return;
                    const prev = seen.get(r.userId);
                    if (!prev || (r.status === 'PAID' && prev.status !== 'PAID')) seen.set(r.userId, r);
                });
                targetIds = Array.from(seen.values())
                    .filter(r => {
                        // 상태 필터
                        let matchesStatus = false;
                        if (filterStatus === 'ALL') matchesStatus = true;
                        else if (filterStatus === 'SUCCESSFUL') matchesStatus = r.status === 'PAID';
                        else if (filterStatus === 'CANCELED') matchesStatus = ['CANCELED', 'REFUNDED', 'REFUND_REQUESTED'].includes(r.status);
                        else if (filterStatus === 'WAITING') matchesStatus = ['WAITING_FOR_DEPOSIT', 'PENDING_PAYMENT'].includes(r.status);
                        else matchesStatus = r.status === filterStatus;
                        // 이름/이메일/전화번호 검색 필터 (searchName 있을 때만)
                        const matchesSearch = searchName.trim()
                            ? (r.userName ?? '').toLowerCase().includes(searchName.toLowerCase()) ||
                            (r.userEmail ?? '').toLowerCase().includes(searchName.toLowerCase()) ||
                            (r.userPhone ?? '').toLowerCase().includes(searchName.toLowerCase())
                            : true;
                        return matchesStatus && matchesSearch;
                    })
                    .map(r => r.id);
                toast.dismiss(toastId);
            } catch {
                toast.error('전체 목록을 불러오는데 실패했습니다.', { id: toastId });
                return;
            }
        }

        if (targetIds.length === 0) {
            toast.error('발송할 대상이 없습니다.');
            return;
        }

        setBulkModal({ open: true, step: 'confirm', targetIds, confirmInput: '', checks: [false, false, false], result: null });
    };

    // Action: Bulk Send — execute via server-side Cloud Function
    const executeBulkSend = async () => {
        if (!conferenceId) return;
        setBulkModal(prev => ({ ...prev, step: 'processing' }));
        try {
            const fns = getFunctions();
            const bulkFn = httpsCallable(fns, 'bulkSendNotifications');
            const result = await bulkFn({
                confId: conferenceId,
                regIds: bulkModal.targetIds
            }) as { data: { success: boolean; sent: number; failed: number; skipped: number; tokenGenerated: number } };

            setBulkModal(prev => ({
                ...prev,
                step: 'done',
                result: {
                    sent: result.data.sent,
                    failed: result.data.failed,
                    skipped: result.data.skipped,
                    tokenGenerated: result.data.tokenGenerated
                }
            }));
            setSelectedIds([]);
        } catch (error: any) {
            console.error('Bulk send failed:', error);
            toast.error(`발송 실패: ${error.message || '알 수 없는 오류'}`);
            setBulkModal(prev => ({ ...prev, step: 'confirm' }));
        }
    };

    const toggleSelection = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredData.length && filteredData.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredData.map(r => r.id));
        }
    };

    const handleBixolonPrint = async (e: React.MouseEvent, reg: RootRegistration) => {
        e.stopPropagation();

        if (bixolonPrinting) return;

        // Use existing badgeQr or fallback to ID (Testing purpose)
        const qrData = reg.badgeQr || reg.id;

        toast.loading("라벨 프린터 전송 중...", { id: 'bixolon-print' });

        try {
            // [Fix] info.badgeLayout이 null일 수 있음 (useConference 캐시/타이밍 문제)
            // settings/badge_config에서 직접 로드 훈에 info.badgeLayout fallback
            let badgeLayout = null;

            if (conferenceId) {
                console.log('[Bixolon] Fetching latest layout from settings/badge_config...');
                try {
                    const cfgSnap = await getDoc(doc(db, `conferences/${conferenceId}/settings/badge_config`));
                    if (cfgSnap.exists() && cfgSnap.data().badgeLayout) {
                        badgeLayout = cfgSnap.data().badgeLayout;
                        console.log('[Bixolon] 최신 로드 완료:', badgeLayout);
                    }
                } catch (fetchErr) {
                    console.error('[Bixolon] badge_config fetch failed:', fetchErr);
                }
            }

            // Fallback to slug if conferenceId is missing
            if (!badgeLayout && slug) {
                console.log('[Bixolon] Fetching conference by slug...');
                try {
                    const q = query(collection(db, 'conferences'), where('slug', '==', slug));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        const cid = snap.docs[0].id;
                        const cfgSnap = await getDoc(doc(db, `conferences/${cid}/settings/badge_config`));
                        if (cfgSnap.exists() && cfgSnap.data().badgeLayout) {
                            badgeLayout = cfgSnap.data().badgeLayout;
                            console.log('[Bixolon] slug 기반 로드 완료:', cid);
                        }
                    }
                } catch (fetchErr) {
                    console.error('[Bixolon] slug-based badge_config fetch failed:', fetchErr);
                }
            }

            if (!badgeLayout) {
                toast.error("배지 레이아웃이 설정되지 않았습니다. 명찰 편집기에서 저장 후 다시 시도하세요.", { id: 'bixolon-print', duration: 5000 });
                return;
            }

            let userName = reg.userName || '';
            let userAffiliation = reg.userOrg || reg.affiliation || '';

            // Fallback: Fetch from user document if missing affiliation
            if ((!userAffiliation || userAffiliation.includes('@')) && reg.userId && conferenceId) {
                try {
                    const userRef = doc(db, `conferences/${conferenceId}/users`, reg.userId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        userAffiliation = userData.organization || userData.affiliation || userAffiliation;
                        userName = userName || userData.name || '';
                    }
                } catch (err) {
                    console.error("Failed to fetch user doc for affiliation fallback (print):", err);
                }
            }

            const printSuccess = await printBadge(badgeLayout, {
                name: userName,
                org: userAffiliation,
                category: displayTier(reg.tier),
                license: reg.licenseNumber || '',
                price: (reg.amount || 0).toLocaleString() + '원',
                affiliation: userAffiliation,
                qrData: qrData
            });

            if (printSuccess) {
                toast.success("라벨 출력 성공", { id: 'bixolon-print' });
            } else {
                // Show specific error if available
                const errMsg = bixolonError || '라벨 출력 실패 - 프린터 에이전트 연결을 확인하세요 (ws://127.0.0.1:18082)';
                toast.error(errMsg, { id: 'bixolon-print', duration: 6000 });
            }
        } catch (e) {
            console.error(e);
            toast.error("프린터 오류 발생", { id: 'bixolon-print' });
        }
    };

    const handleDeleteRegistration = async (e: React.MouseEvent, reg: RootRegistration) => {
        e.stopPropagation();

        const confirmMessage = `다음 등록 정보를 삭제하시겠습니까?\n\n` +
            `이름: ${reg.userName || '미상'}\n` +
            `이메일: ${reg.userEmail || '미상'}\n` +
            `주문번호: ${reg.id}\n\n` +
            `⚠️ 관련된 모든 출결 데이터가 함께 삭제됩니다.\n` +
            `⚠️ 이 작업은 되돌릴 수 없습니다.`;

        if (!confirm(confirmMessage)) return;

        try {
            if (!conferenceId) {
                toast.error("Conference ID가 없습니다.");
                return;
            }

            await handleDeleteRegistrationWithCleanup(reg, conferenceId, refreshPagination);


        } catch (e: unknown) {
            toast.error("삭제 중 오류가 발생했습니다: " + (e instanceof Error ? e.message : 'Unknown error'));
        }
    };

    const filteredData = useMemo(() => {
        // First, group registrations by userId to handle duplicates
        const userRegistrations = new Map<string, RootRegistration[]>();
        registrations.forEach(r => {
            if (r.userId) {
                if (!userRegistrations.has(r.userId)) {
                    userRegistrations.set(r.userId, []);
                }
                userRegistrations.get(r.userId)!.push(r);
            }
        });

        // For each user, select the best registration (priority: PAID > others)
        const deduplicatedRegs: RootRegistration[] = [];
        userRegistrations.forEach((regs) => {
            // Sort by status priority: PAID first, then by createdAt desc
            const sorted = regs.sort((a, b) => {
                if (a.status === 'PAID' && b.status !== 'PAID') return -1;
                if (a.status !== 'PAID' && b.status === 'PAID') return 1;
                // If same status, newer first
                const aTime = a.createdAt?.toMillis() || 0;
                const bTime = b.createdAt?.toMillis() || 0;
                return bTime - aTime;
            });
            // Only include if status is one of the allowed statuses
            const best = sorted[0];
            if (['PAID', 'REFUNDED', 'CANCELED', 'REFUND_REQUESTED', 'WAITING_FOR_DEPOSIT', 'PENDING_PAYMENT'].includes(best.status)) {
                deduplicatedRegs.push(best);
            }
        });

        // Then filter by status and name
        return deduplicatedRegs.filter(r => {
            try {
                let matchesStatus = false;
                if (filterStatus === 'ALL') {
                    matchesStatus = true;
                } else if (filterStatus === 'SUCCESSFUL') {
                    matchesStatus = r.status === 'PAID';
                } else if (filterStatus === 'CANCELED') {
                    matchesStatus = r.status === 'CANCELED' || r.status === 'REFUNDED' || r.status === 'REFUND_REQUESTED';
                } else if (filterStatus === 'WAITING') {
                    matchesStatus = r.status === 'WAITING_FOR_DEPOSIT' || r.status === 'PENDING_PAYMENT';
                } else {
                    matchesStatus = r.status === filterStatus;
                }

                // Fix: Null-safe access
                const matchesName = (r.userName ?? '').toLowerCase().includes(searchName.toLowerCase());
                return matchesStatus && matchesName;
            } catch (e) {
                console.error("데이터 오류 발생 레코드 ID:", r.id, e);
                return false;
            }
        });
    }, [registrations, filterStatus, searchName]);

    const handleExport = async () => {
        // 엑셀 다운로드: 페이지네이션 무관하게 Firestore에서 전체 데이터 조회
        const toastId = toast.loading('전체 등록자 데이터를 불러오는 중...');
        try {
            const allRegs = await fetchAllRegistrations();

            // 중복 제거 및 필터 적용
            const userRegistrations = new Map<string, RootRegistration[]>();
            allRegs.forEach(r => {
                if (r.userId) {
                    if (!userRegistrations.has(r.userId)) userRegistrations.set(r.userId, []);
                    userRegistrations.get(r.userId)!.push(r);
                }
            });
            const deduped: RootRegistration[] = [];
            userRegistrations.forEach((regs) => {
                const sorted = regs.sort((a, b) => {
                    if (a.status === 'PAID' && b.status !== 'PAID') return -1;
                    if (a.status !== 'PAID' && b.status === 'PAID') return 1;
                    return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
                });
                const best = sorted[0];
                if (['PAID', 'REFUNDED', 'CANCELED', 'REFUND_REQUESTED', 'WAITING_FOR_DEPOSIT', 'PENDING_PAYMENT'].includes(best.status)) {
                    deduped.push(best);
                }
            });
            const fullFilteredData = deduped.filter(r => {
                // 상태 필터
                let matchesStatus = false;
                if (filterStatus === 'ALL') matchesStatus = true;
                else if (filterStatus === 'SUCCESSFUL') matchesStatus = r.status === 'PAID';
                else if (filterStatus === 'CANCELED') matchesStatus = ['CANCELED', 'REFUNDED', 'REFUND_REQUESTED'].includes(r.status);
                else if (filterStatus === 'WAITING') matchesStatus = ['WAITING_FOR_DEPOSIT', 'PENDING_PAYMENT'].includes(r.status);
                else matchesStatus = r.status === filterStatus;
                // 이름/이메일/전화번호 검색 필터 (searchName 있을 때만)
                const matchesSearch = searchName.trim()
                    ? (r.userName ?? '').toLowerCase().includes(searchName.toLowerCase()) ||
                    (r.userEmail ?? '').toLowerCase().includes(searchName.toLowerCase()) ||
                    (r.userPhone ?? '').toLowerCase().includes(searchName.toLowerCase())
                    : true;
                return matchesStatus && matchesSearch;
            });

            toast.dismiss(toastId);
            const data = fullFilteredData.map(r => ({
                '주문번호': r.id,
                '이름': r.userName,
                '이메일': r.userEmail || '-',
                '전화번호': r.userPhone || '-',
                '소속': r.userOrg || r.affiliation || '-',
                '면허번호': r.licenseNumber || '-',
                '등급': displayTier(r.tier),
                '결제금액': r.amount,
                '선택옵션': r.options ? r.options.map((o: any) => `${typeof o.name === 'string' ? o.name : o.name?.ko || ''}(${o.quantity})`).join(', ') : '-',
                '결제수단': r.paymentType || r.paymentMethod || r.method || '카드',
                '상태': statusToKorean(r.status),
                '등록일': safeFormatDate(r.createdAt),
            }));
            exportToExcel(data, `Registrants_${activeSlug}_${new Date().toISOString().slice(0, 10)}`);
            toast.success(`총 ${data.length}명의 데이터를 다운로드했습니다.`);
        } catch (err) {
            toast.dismiss(toastId);
            toast.error('데이터를 불러오는데 실패했습니다.');
        }
    };

    if (loading && !activeSlug) return (
        <div className="p-8 flex flex-col items-center">
            <Loader2 className="animate-spin w-8 h-8 text-blue-600 mb-4" />
            <div className="text-gray-500 text-sm font-mono mb-4">
                Loading... {status}
            </div>
        </div>
    );

    if (error) return (
        <div className="p-8 text-red-600 font-bold border border-red-400 bg-red-50 m-4 rounded">
            Error Loading Registrations: {error}
            <br />
            <span className="text-sm font-normal text-gray-700">Check the browser console for a Firestore Index Link if this is a "Missing Index" error.</span>
        </div>
    );

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">등록 현황 (Registration List)</h1>

            {/* Filters & Actions */}
            <div className="flex gap-4 mb-6 items-center flex-wrap">
                <input
                    placeholder="이름, 이메일, 전화번호 검색 (Search by Name, Email, Phone)"
                    value={searchName}
                    onChange={e => setSearchName(e.target.value)}
                    className="p-2 border rounded w-64 focus:outline-none focus:ring-2 focus:ring-[#2d80c6] rounded-xl"
                />
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="p-2 border rounded rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d80c6]"
                >
                    <option value="ALL">전체 상태 (All Status)</option>
                    <option value="SUCCESSFUL">성공 접수 (Successful)</option>
                    <option value="PAID">결제완료 (PAID)</option>
                    <option value="WAITING">입금대기 (Waiting)</option>
                    <option value="CANCELED">취소/환불 (Canceled)</option>
                </select>
                <div className="ml-auto flex gap-2">
                    <EregiButton
                        onClick={() => prepareBulkSend('selected')}
                        disabled={isProcessing || selectedIds.length === 0}
                        variant="secondary"
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 py-2 px-4 h-auto text-sm"
                    >
                        <MessageCircle size={14} className="mr-1.5" />
                        선택 발송 ({selectedIds.length})
                    </EregiButton>
                    <EregiButton
                        onClick={() => prepareBulkSend('all')}
                        disabled={isProcessing || filteredData.length === 0}
                        variant="secondary"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white border-none py-2 px-4 h-auto text-sm"
                    >
                        <MessageCircle size={14} className="mr-1.5" />
                        전체 발송 (전체)
                    </EregiButton>
                    <EregiButton
                        onClick={handleExport}
                        disabled={exporting}
                        isLoading={exporting}
                        variant="primary"
                        className="bg-green-600 hover:bg-green-700 text-white border-none py-2 px-4 h-auto text-sm"
                    >
                        엑셀 다운로드 (Excel)
                    </EregiButton>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-[#f0f5fa] border-b border-[#e1ecf6]">
                        <tr>
                            <th className="p-4 w-10">
                                <button onClick={toggleSelectAll} className="p-1 hover:bg-blue-50 rounded">
                                    {selectedIds.length === filteredData.length && filteredData.length > 0 ? (
                                        <CheckSquare size={18} className="text-blue-600" />
                                    ) : (
                                        <Square size={18} className="text-gray-300" />
                                    )}
                                </button>
                            </th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">주문번호</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">이름</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">이메일</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">전화번호</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">소속</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">면허번호</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">등급</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">결제금액</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">결제수단</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">상태</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider text-center">명찰/알림</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider text-center">삭제</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">등록일</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredData.map(r => (
                            <tr
                                key={r.id}
                                className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedIds.includes(r.id) ? 'bg-blue-50/50' : ''}`}
                                onClick={() => navigate(`/admin/conf/${conferenceId}/registrations/${r.id}`)}
                            >
                                <td className="p-4" onClick={(e) => toggleSelection(e, r.id)}>
                                    <div className="flex justify-center">
                                        {selectedIds.includes(r.id) ? (
                                            <CheckSquare size={18} className="text-blue-600" />
                                        ) : (
                                            <Square size={18} className="text-gray-300" />
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 font-mono text-xs text-gray-400">{r.orderId || r.id}</td>
                                <td className="p-4 font-medium text-gray-900">{r.userName}</td>
                                <td className="p-4 text-sm text-gray-500">{r.userEmail || '-'}</td>
                                <td className="p-4 text-sm text-gray-500">{r.userPhone || '-'}</td>
                                <td className="p-4 text-sm text-gray-500">{r.userOrg || r.affiliation || '-'}</td>
                                <td className="p-4 text-sm text-gray-500">{r.licenseNumber || '-'}</td>
                                <td className="p-4 text-sm text-gray-500">{displayTier(r.tier)}</td>
                                <td className="p-4 text-sm font-medium text-[#1b4d77]">
                                    <div>{(r.amount || 0).toLocaleString()}원</div>
                                    {r.options && r.options.length > 0 && (
                                        <div className="text-[10px] mt-1">
                                            <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-bold">
                                                + 옵션 ({r.options.length})
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 text-sm text-gray-500">{r.paymentType || r.paymentMethod || r.method || '카드'}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${r.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-100' :
                                        (r.status === 'WAITING_FOR_DEPOSIT' || r.status === 'PENDING_PAYMENT') ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                            'bg-red-50 text-red-700 border-red-100'
                                        }`}>
                                        {statusToKorean(r.status)}
                                    </span>
                                    {(r.status === 'WAITING_FOR_DEPOSIT' || r.status === 'PENDING_PAYMENT') && r.virtualAccount && (
                                        <div className="text-[10px] text-gray-500 mt-1">
                                            {r.virtualAccount.bank} {r.virtualAccount.accountNumber}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2 justify-center">
                                        {r.badgeIssued ? (
                                            <span className="text-green-600 font-bold text-xs flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> 발급완료
                                            </span>
                                        ) : (
                                            r.status === 'PAID' && (
                                                <EregiButton
                                                    onClick={(e) => handleIssueBadge(e, r)}
                                                    variant="secondary"
                                                    className="px-3 py-1 text-xs h-auto bg-white border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100"
                                                >
                                                    명찰 발급
                                                </EregiButton>
                                            )
                                        )}
                                        <EregiButton
                                            onClick={(e) => handleBixolonPrint(e, r)}
                                            variant="secondary"
                                            className="px-2 py-1 text-xs h-auto bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700 font-bold"
                                            title="명찰 프린트"
                                            disabled={bixolonPrinting}
                                        >
                                            명찰 프린트
                                        </EregiButton>
                                        <EregiButton
                                            onClick={(e) => handleResendNotification(e, r)}
                                            variant="secondary"
                                            className="px-2 py-1 text-xs h-auto bg-indigo-50 border-indigo-200 hover:bg-indigo-100 text-indigo-700"
                                            title="알림톡 발송"
                                            disabled={isProcessing}
                                        >
                                            <MessageCircle size={14} />
                                        </EregiButton>
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    <EregiButton
                                        onClick={(e) => handleDeleteRegistration(e, r)}
                                        variant="secondary"
                                        className="px-2 py-1 text-xs h-auto bg-red-50 border-red-200 hover:bg-red-100 text-red-600"
                                        title="삭제"
                                    >
                                        🗑️
                                    </EregiButton>
                                </td>
                                <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                                    {r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : '-'}
                                </td>
                            </tr>
                        ))}
                        {filteredData.length === 0 && (
                            <tr><td colSpan={12} className="p-8 text-center text-gray-500">등록된 내역이 없습니다. (No records found)</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {!loading && registrations.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border-t">
                    <div className="text-sm text-gray-600">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to {(currentPage - 1) * itemsPerPage + registrations.length} entries (Page {currentPage}{!hasMore ? ' - Last Page' : ''})
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Page Size Selector */}
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                            }}
                            className="px-3 py-1 border border-gray-300 rounded text-sm"
                        >
                            <option value={25}>25 per page</option>
                            <option value={50}>50 per page</option>
                            <option value={100}>100 per page</option>
                        </select>

                        {/* Previous Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setCurrentPage(1);
                            }}
                            disabled={currentPage === 1}
                            className="px-3 py-1"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            First
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (currentPage > 1) {
                                    setCurrentPage(currentPage - 1);
                                }
                            }}
                            disabled={currentPage === 1}
                            className="px-3 py-1"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Previous
                        </Button>

                        {/* Page Info */}
                        <span className="text-sm font-medium px-3">
                            Page {currentPage}
                        </span>

                        {/* Next Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (hasMore) {
                                    setCurrentPage(currentPage + 1);
                                }
                            }}
                            disabled={!hasMore}
                            className="px-3 py-1"
                        >
                            Next
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}

            {/* ─── Bulk Send Safety Modal ─────────────────────────────────────────────── */}
            {bulkModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

                        {/* Header */}
                        <div className={`px-6 py-4 flex items-center gap-3 ${bulkModal.step === 'done' ? 'bg-green-600' :
                            bulkModal.step === 'processing' ? 'bg-blue-600' : 'bg-amber-500'
                            }`}>
                            {bulkModal.step === 'confirm' && <AlertTriangle className="w-6 h-6 text-white" />}
                            {bulkModal.step === 'processing' && <Loader2 className="w-6 h-6 text-white animate-spin" />}
                            {bulkModal.step === 'done' && <ShieldCheck className="w-6 h-6 text-white" />}
                            <h2 className="text-white font-bold text-lg flex-1">
                                {bulkModal.step === 'confirm' && '전체 알림톡 발송 확인'}
                                {bulkModal.step === 'processing' && '서버에서 발송 중...'}
                                {bulkModal.step === 'done' && '발송 완료'}
                            </h2>
                            {bulkModal.step !== 'processing' && (
                                <button onClick={() => setBulkModal(prev => ({ ...prev, open: false }))} className="text-white/80 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        <div className="px-6 py-5">

                            {/* STEP 1: Confirm */}
                            {bulkModal.step === 'confirm' && (
                                <div className="space-y-4">
                                    {/* Target Count */}
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <p className="text-sm text-amber-700 font-medium">발송 대상</p>
                                        <p className="text-3xl font-extrabold text-amber-900 mt-1">{bulkModal.targetIds.length}명</p>
                                        <p className="text-xs text-amber-600 mt-1">기존 수령 링크는 무효화되고 새 링크가 발급됩니다.</p>
                                    </div>

                                    {/* Checklist */}
                                    <div className="space-y-2">
                                        <p className="text-sm font-semibold text-gray-700">다음 사항을 확인하세요 ⚠️</p>
                                        {[
                                            '앞에 표시된 등록자가 모두 전화번호를 보유한 실제 수령 대상임을 확인했습니다.',
                                            '이미 알림톡을 받은 대상에게 재발송하면 기존 링크가 만료되는 점을 이해했습니다.',
                                            '사전에 테스트 발송을 통해 템플릿과 시간 표기를 확인했습니다.',
                                        ].map((label, i) => (
                                            <label key={i} className={`flex items-start gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${bulkModal.checks[i] ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                                                }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={bulkModal.checks[i]}
                                                    onChange={() => setBulkModal(prev => ({
                                                        ...prev,
                                                        checks: prev.checks.map((c, j) => j === i ? !c : c)
                                                    }))}
                                                    className="mt-0.5 w-4 h-4 accent-green-600"
                                                />
                                                <span className="text-sm text-gray-700">{label}</span>
                                            </label>
                                        ))}
                                    </div>

                                    {/* Confirmation Input */}
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1.5">
                                            아래에 정확히 <strong className="text-red-600">{bulkModal.targetIds.length}</strong> 을 입력하세요
                                        </p>
                                        <input
                                            type="text"
                                            value={bulkModal.confirmInput}
                                            onChange={e => setBulkModal(prev => ({ ...prev, confirmInput: e.target.value }))}
                                            placeholder={`${bulkModal.targetIds.length} 입력`}
                                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 focus:outline-none text-lg font-bold text-center"
                                        />
                                    </div>

                                    {/* Server-side Note */}
                                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                        <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                                        <p className="text-xs text-blue-700"><strong>안전:</strong> 화면을 닫아도 서버에서 멈춰지 않고 처리됩니다.</p>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setBulkModal(prev => ({ ...prev, open: false }))}
                                            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 font-medium"
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={executeBulkSend}
                                            disabled={
                                                !bulkModal.checks.every(Boolean) ||
                                                bulkModal.confirmInput.trim() !== String(bulkModal.targetIds.length)
                                            }
                                            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                        >
                                            발송 시작
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: Processing */}
                            {bulkModal.step === 'processing' && (
                                <div className="py-8 text-center space-y-4">
                                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
                                    <div>
                                        <p className="font-bold text-gray-800 text-lg">{bulkModal.targetIds.length}명 발송 중...</p>
                                        <p className="text-sm text-gray-500 mt-1">30명 병렬 토큰 생성 → NHN 배치 전송</p>
                                    </div>
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                        <p className="text-sm text-blue-700 font-medium">✅ 이 창을 닫아도 안전합니다</p>
                                        <p className="text-xs text-blue-600 mt-1">서버에서 자동 완료 후 결과를 저장합니다.</p>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: Done */}
                            {bulkModal.step === 'done' && bulkModal.result && (
                                <div className="py-6 space-y-4">
                                    <div className="text-center">
                                        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
                                        <p className="font-bold text-gray-800 text-xl">발송 완료!</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                                            <p className="text-3xl font-extrabold text-green-700">{bulkModal.result.sent}</p>
                                            <p className="text-xs text-green-600 mt-1">발송 성공</p>
                                        </div>
                                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                                            <p className="text-3xl font-extrabold text-red-700">{bulkModal.result.failed}</p>
                                            <p className="text-xs text-red-600 mt-1">발송 실패</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
                                            <p className="text-3xl font-extrabold text-gray-700">{bulkModal.result.skipped}</p>
                                            <p className="text-xs text-gray-600 mt-1">스킵 (전화번호 없음 등)</p>
                                        </div>
                                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
                                            <p className="text-3xl font-extrabold text-blue-700">{bulkModal.result.tokenGenerated}</p>
                                            <p className="text-xs text-blue-600 mt-1">토큰 발급</p>
                                        </div>
                                    </div>
                                    {bulkModal.result.failed > 0 && (
                                        <p className="text-xs text-gray-500 text-center">Firebase 콘솔 로그에서 실패 대상 확인 가능</p>
                                    )}
                                    <button
                                        onClick={() => setBulkModal(prev => ({ ...prev, open: false }))}
                                        className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 transition-colors"
                                    >
                                        닫기
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RegistrationListPage;
