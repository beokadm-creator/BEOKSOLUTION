import { useMemo, useState, useEffect } from 'react';
import { useExcel } from './useExcel';
import { useRegistrationsPagination } from './useRegistrationsPagination';
import { useBixolon } from './useBixolon';
import toast from 'react-hot-toast';
import { query, collection, getDocs, getDoc, doc, Timestamp, orderBy as fbOrderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { safeFormatDate } from '../utils/dateUtils';
import { handleDeleteRegistrationWithCleanup } from '../utils/registrationDeleteHandler';
import { normalizeFieldSettings } from '../utils/registrationFieldSettings';
import type { RegistrationFieldSettings } from '../types/schema';

// Define the root-level registration type based on PaymentSuccessHandler
export interface RootRegistration {
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
    position?: string; // Optional
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
    options?: RegistrationOptionSummary[];
    badgeQr?: string; // Added for QR printing
    baseAmount?: number;
    optionsTotal?: number;
}

export interface RegistrationOptionSummary {
    name?: string | { ko?: string };
    quantity?: number;
}

export interface FallbackBadgeElement {
    x: number;
    y: number;
    fontSize: number;
    isVisible: boolean;
    type: string;
}

export interface BulkModalState {
    open: boolean;
    step: 'confirm' | 'processing' | 'done';
    targetIds: string[];
    confirmInput: string;
    checks: boolean[];
    result: { sent: number; failed: number; skipped: number; tokenGenerated: number } | null;
}

export const statusToKorean = (status: string): string => {
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
export const displayTier = (tier: string | undefined): string => {
    return tier || '-';
};

export function useRegistrationList(conferenceId: string | null) {
    const { exportToExcel, processing: exporting } = useExcel();

    // Filters
    // [FIX-20250124-01] Default filter to SUCCESSFUL (PAID) to avoid showing incomplete registrations
    const [filterStatus, setFilterStatus] = useState('SUCCESSFUL');
    const [searchName, setSearchName] = useState('');

    const [fieldSettings, setFieldSettings] = useState<RegistrationFieldSettings>(normalizeFieldSettings());

    // Fetch fieldSettings from registration settings
    useEffect(() => {
        if (!conferenceId) return;
        const fetchSettings = async () => {
            try {
                const regDoc = await getDoc(doc(db, `conferences/${conferenceId}/settings/registration`));
                if (regDoc.exists()) {
                    setFieldSettings(normalizeFieldSettings(regDoc.data().fieldSettings));
                }
            } catch (err) {
                console.error("Failed to fetch fieldSettings", err);
                toast.error('신청서 설정을 불러오지 못했습니다.');
            }
        };
        fetchSettings();
    }, [conferenceId]);

    // Bixolon Hook
    const { printBadge, printing: bixolonPrinting, error: bixolonError } = useBixolon();

    // Selection & Processing State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // ─── Bulk Send Modal State ───────────────────────────────────────────────
    const [bulkModal, setBulkModal] = useState<BulkModalState>({
        open: false,
        step: 'confirm',
        targetIds: [],
        confirmInput: '',
        checks: [false, false, false],
        result: null
    });

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
        if (reg.badgeIssued) {
            toast.error("이미 명찰이 발급되었습니다.");
            return;
        }
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
        } catch (error: unknown) {
            console.error('Failed to send notification:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Error: ${message}`);
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
            // [Fix] Filter out already issued badges from selected ones
            targetIds = registrations.filter(r => selectedIds.includes(r.id) && !r.badgeIssued).map(r => r.id);
            if (targetIds.length !== selectedIds.length) {
                toast.error(`선택된 인원 중 이미 명찰이 발급된 ${selectedIds.length - targetIds.length}명은 발송 대상에서 제외되었습니다.`, { duration: 4000 });
            }
        } else {
            const toastId = toast.loading('전체 등록자 목록을 불러오는 중...');
            try {
                const allRegs = await fetchAllRegistrations();
                // [Fix-Critical] orderId 기반 중복 제거 (userId 기반 → 가족/대리 등록 누락 버그 수정)
                const seenIds = new Set<string>();
                const deduped: RootRegistration[] = [];
                allRegs.forEach(r => {
                    const oid = r.orderId || r.id;
                    if (!seenIds.has(oid)) { seenIds.add(oid); deduped.push(r); }
                });
                targetIds = deduped
                    .filter(r => {
                        // 상태 필터
                        let matchesStatus = false;
                        if (filterStatus === 'ALL') matchesStatus = true;
                        else if (filterStatus === 'SUCCESSFUL') matchesStatus = r.status === 'PAID';
                        else if (filterStatus === 'CANCELED') matchesStatus = ['CANCELED', 'REFUNDED', 'REFUND_REQUESTED'].includes(r.status);
                        else if (filterStatus === 'WAITING') matchesStatus = ['WAITING_FOR_DEPOSIT', 'PENDING_PAYMENT'].includes(r.status);
                        else matchesStatus = r.status === filterStatus;
                        // [Fix] 검색 필터 (이름, 이메일, 전화번호, 주문번호)
                        const searchTerm = searchName.trim().toLowerCase();
                        const matchesSearch = searchTerm
                            ? (r.userName ?? '').toLowerCase().includes(searchTerm) ||
                            (r.userEmail ?? '').toLowerCase().includes(searchTerm) ||
                            (r.userPhone ?? '').toLowerCase().includes(searchTerm) ||
                            (r.orderId ?? '').toLowerCase().includes(searchTerm) ||
                            (r.id ?? '').toLowerCase().includes(searchTerm)
                            : true;
                        // [Fix] Exclude already issued badges
                        const isNotIssued = !r.badgeIssued;
                        return matchesStatus && matchesSearch && isNotIssued;
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
        } catch (error: unknown) {
            console.error('Bulk send failed:', error);
            toast.error(`발송 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
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
            let badgeLayout = null;

            if (conferenceId) {
                try {
                    const cfgSnap = await getDoc(doc(db, `conferences/${conferenceId}/settings/badge_config`));
                    if (cfgSnap.exists()) {
                        const data = cfgSnap.data();
                        // 인포데스크와 동일한 로직: 활성화 시에만 DB 레이아웃 사용
                        if (data.badgeLayoutEnabled && data.badgeLayout) {
                            badgeLayout = {
                                width: data.badgeLayout.width || 800,
                                height: data.badgeLayout.height || 1200,
                                elements: data.badgeLayout.elements || [],
                                enableCutting: data.badgeLayout.enableCutting || false
                            };
                        }
                    }
                } catch (fetchErr) {
                    console.error('[Bixolon] badge_config fetch failed:', fetchErr);
                }
            }

            // Info Desk와 동일한 기본 레이아웃 폴백 (v356 로직 동기화)
            const activeLayout = badgeLayout || {
                width: 800,
                height: 1200,
                elements: [
                    { x: 400, y: 150, fontSize: 6, isVisible: true, type: 'QR' },
                    { x: 400, y: 450, fontSize: 4, isVisible: true, type: 'NAME' },
                    { x: 400, y: 600, fontSize: 2, isVisible: true, type: 'ORG' }
                ] as FallbackBadgeElement[]
            };

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

            const displayAmount = reg.amount !== undefined
                ? reg.amount
                : (reg.baseAmount !== undefined ? ((reg.baseAmount || 0) + (reg.optionsTotal || 0)) : 0);

            const printSuccess = await printBadge(activeLayout, {
                name: userName,
                org: userAffiliation,
                position: reg.position,
                category: displayTier(reg.tier),
                license: reg.licenseNumber || '',
                price: displayAmount.toLocaleString() + '원',
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
        // [Fix-Critical] userId 기반 중복제거 제거
        // 기존 로직은 같은 계정(userId)으로 등록한 여러 명(가족/대리 등록)을 1명으로 줄이는 버그가 있었음.
        // 관련 문서: sunjaikim@gmail.com (UID: HrFOQzgeVGW8PQ0hUOhSUAlywIX2)로 등록된 3건 중 2건이 누락됨.
        // 수정: orderId(= 문서 ID)를 기준으로만 중복 제거. 한 계정의 여러 등록은 모두 표시.
        const seenOrderIds = new Set<string>();
        const deduplicatedRegs: RootRegistration[] = [];
        registrations.forEach(r => {
            const orderId = r.orderId || r.id;
            if (!seenOrderIds.has(orderId)) {
                seenOrderIds.add(orderId);
                if (['PAID', 'REFUNDED', 'CANCELED', 'REFUND_REQUESTED', 'WAITING_FOR_DEPOSIT', 'PENDING_PAYMENT'].includes(r.status)) {
                    deduplicatedRegs.push(r);
                }
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

                // [Fix] 주문번호(orderId/id) 검색 추가 및 Null-safe 처리
                const searchTerm = searchName.toLowerCase();
                const matchesName = (r.userName ?? '').toLowerCase().includes(searchTerm) ||
                    (r.orderId ?? '').toLowerCase().includes(searchTerm) ||
                    (r.id ?? '').toLowerCase().includes(searchTerm) ||
                    (r.userEmail ?? '').toLowerCase().includes(searchTerm) ||
                    (r.userPhone ?? '').toLowerCase().includes(searchTerm);
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

            // [Fix-Critical] orderId 기반 중복 제거 (userId 기반 → 가족/대리 등록 누락 버그 수정)
            const seenOrderIds = new Set<string>();
            const deduped: RootRegistration[] = [];
            allRegs.forEach(r => {
                const oid = r.orderId || r.id;
                if (!seenOrderIds.has(oid)) { seenOrderIds.add(oid); deduped.push(r); }
            });
            const fullFilteredData = deduped.filter(r => {
                // 상태 필터
                let matchesStatus = false;
                if (filterStatus === 'ALL') matchesStatus = true;
                else if (filterStatus === 'SUCCESSFUL') matchesStatus = r.status === 'PAID';
                else if (filterStatus === 'CANCELED') matchesStatus = ['CANCELED', 'REFUNDED', 'REFUND_REQUESTED'].includes(r.status);
                else if (filterStatus === 'WAITING') matchesStatus = ['WAITING_FOR_DEPOSIT', 'PENDING_PAYMENT'].includes(r.status);
                else matchesStatus = r.status === filterStatus;
                // [Fix] 검색 필터 (이름, 이메일, 전화번호, 주문번호)
                const searchTerm = searchName.trim().toLowerCase();
                const matchesSearch = searchTerm
                    ? (r.userName ?? '').toLowerCase().includes(searchTerm) ||
                    (r.userEmail ?? '').toLowerCase().includes(searchTerm) ||
                    (r.userPhone ?? '').toLowerCase().includes(searchTerm) ||
                    (r.orderId ?? '').toLowerCase().includes(searchTerm) ||
                    (r.id ?? '').toLowerCase().includes(searchTerm)
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
                '선택옵션': r.options ? r.options.map((o) => `${typeof o.name === 'string' ? o.name : o.name?.ko || ''}(${o.quantity})`).join(', ') : '-',
                '결제수단': r.paymentType || r.paymentMethod || r.method || '카드',
                '상태': statusToKorean(r.status),
                '등록일': safeFormatDate(r.createdAt),
            }));
            exportToExcel(data, `Registrants_${conferenceId || 'unknown'}_${new Date().toISOString().slice(0, 10)}`);
            toast.success(`총 ${data.length}명의 데이터를 다운로드했습니다.`);
        } catch {
            toast.dismiss(toastId);
            toast.error('데이터를 불러오는데 실패했습니다.');
        }
    };

    return {
        // Filters
        filterStatus,
        setFilterStatus,
        searchName,
        setSearchName,

        // Data
        filteredData,
        loading,
        error,
        fieldSettings,
        selectedIds,

        // Processing states
        isProcessing,
        exporting,
        bixolonPrinting,
        bixolonError,

        // Bulk modal
        bulkModal,
        setBulkModal,

        // Pagination
        currentPage,
        itemsPerPage,
        setCurrentPage,
        setItemsPerPage,
        hasMore,
        registrations,

        // Actions
        handleIssueBadge,
        handleResendNotification,
        handleBixolonPrint,
        handleDeleteRegistration,
        prepareBulkSend,
        executeBulkSend,
        toggleSelection,
        toggleSelectAll,
        handleExport,
    };
}
