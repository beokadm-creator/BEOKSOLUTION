import { useState, useEffect } from 'react';
import { collection, query, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

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
    badgeQr?: string; // Added for printing
    virtualAccount?: {
        bank: string;
        accountNumber: string;
        customerName?: string;
        dueDate?: string;
    };
    options?: unknown[]; // Snapshot of selected options
}

interface UseRegistrationsPaginationParams {
    conferenceId: string | null;
    itemsPerPage?: number;
    searchQuery?: string;
}

interface UseRegistrationsPaginationReturn {
    registrations: RootRegistration[];
    loading: boolean;
    error: string | null;
    currentPage: number;
    itemsPerPage: number;
    setCurrentPage: (page: number) => void;
    setItemsPerPage: (size: number) => void;
    lastVisible: null;
    hasMore: boolean;
    refresh: () => void;
}

/**
 * Custom hook for registration list.
 * [Fix-Final] 항상 전체 데이터를 Firestore에서 가져옴. limit() 미사용.
 * 이전 limit(50) 방식은 오래된 등록자(예: 강민규)가 일반 목록에서 사라지는 버그를 유발했음.
 * 클라이언트에서 검색/필터/페이지네이션을 처리하므로 UI 동작은 동일.
 */
export function useRegistrationsPagination({
    conferenceId,
    itemsPerPage: initialItemsPerPage = 50,
    searchQuery = ''
}: UseRegistrationsPaginationParams): UseRegistrationsPaginationReturn {
    const [allData, setAllData] = useState<RootRegistration[]>([]);
    const [registrations, setRegistrations] = useState<RootRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPageState] = useState(1);
    const [itemsPerPage, setItemsPerPageState] = useState(initialItemsPerPage);
    const [refreshTick, setRefreshTick] = useState(0);

    // 1. Firestore에서 전체 데이터 로드 (conferenceId 또는 refresh 요청 시)
    useEffect(() => {
        const loadData = async () => {
            if (!conferenceId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const regRef = collection(db, 'conferences', conferenceId, 'registrations');
                // [Fix-Final] limit() 없이 전체 조회
                const q = query(regRef, orderBy('createdAt', 'desc'));
                const snap = await getDocs(q);

                const data = snap.docs.map(d => {
                    const docData = d.data();
                    const flattened = { id: d.id, ...docData } as RootRegistration;

                    if (!flattened.orderId) flattened.orderId = flattened.id;

                    // Flatten userInfo fields to top level for display
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

                setAllData(data);
                setCurrentPageState(1); // 새 데이터 로드 시 1페이지로 초기화
            } catch (err: unknown) {
                setError((err instanceof Error ? err.message : 'Unknown error') + ' (Check Console for Link)');
            } finally {
                setLoading(false);
            }
        };

        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conferenceId, refreshTick]);

    // 2. allData + searchQuery → 클라이언트 사이드 필터 및 페이지 슬라이싱
    useEffect(() => {
        let filtered = allData;

        if (searchQuery && searchQuery.trim()) {
            const st = searchQuery.toLowerCase().trim();
            filtered = allData.filter(reg => {
                return (
                    (reg.userName || '').toLowerCase().includes(st) ||
                    (reg.userEmail || '').toLowerCase().includes(st) ||
                    (reg.userPhone || '').toLowerCase().includes(st) ||
                    (reg.orderId || '').toLowerCase().includes(st) ||
                    (reg.id || '').toLowerCase().includes(st)
                );
            });
            // 검색 시에는 전체 결과를 한번에 보여줌
            setRegistrations(filtered);
        } else {
            // 페이지네이션 적용
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            setRegistrations(filtered.slice(start, end));
        }
    }, [allData, searchQuery, currentPage, itemsPerPage]);

    const hasMore = !searchQuery?.trim() && currentPage * itemsPerPage < allData.length;

    const refresh = () => setRefreshTick(t => t + 1);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1) setCurrentPageState(newPage);
    };

    const handleItemsPerPageChange = (newSize: number) => {
        setItemsPerPageState(newSize);
        setCurrentPageState(1);
    };

    return {
        registrations,
        loading,
        error,
        currentPage,
        itemsPerPage,
        setCurrentPage: handlePageChange,
        setItemsPerPage: handleItemsPerPageChange,
        lastVisible: null,
        hasMore,
        refresh
    };
}
