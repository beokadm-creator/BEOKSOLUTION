import { useState, useEffect } from 'react';
import { collection, query, getDocs, Timestamp, limit, orderBy, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
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
    virtualAccount?: {
        bank: string;
        accountNumber: string;
        customerName?: string;
        dueDate?: string;
    };
}

interface UseRegistrationsPaginationParams {
    conferenceId: string | null;
    itemsPerPage?: number;
    searchQuery?: string; // 검색어 (이름, 이메일, 전화번호)
}


interface UseRegistrationsPaginationReturn {
    registrations: RootRegistration[];
    loading: boolean;
    error: string | null;
    currentPage: number;
    itemsPerPage: number;
    setCurrentPage: (page: number) => void;
    setItemsPerPage: (size: number) => void;
    lastVisible: QueryDocumentSnapshot | null;
    hasMore: boolean;
    refresh: () => void;
}

/**
 * Custom hook for paginated registration list
 * Follows project convention: use hooks for data access, not direct Firestore calls in pages
 *
 * @param conferenceId - The conference ID to fetch registrations for
 * @param itemsPerPage - Number of items per page (default: 50)
 * @returns Paginated registration data and controls
 */
export function useRegistrationsPagination({
    conferenceId,
    itemsPerPage: initialItemsPerPage = 50,
    searchQuery = ''
}: UseRegistrationsPaginationParams): UseRegistrationsPaginationReturn {
    const [registrations, setRegistrations] = useState<RootRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Fetch data from Firestore with pagination
    useEffect(() => {
        const loadData = async () => {
            if (!conferenceId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Corrected Path: conferences/{conferenceId}/registrations
                const regRef = collection(db, 'conferences', conferenceId, 'registrations');

                // Build query with pagination
                let q = query(
                    regRef,
                    orderBy('createdAt', 'desc'),
                    limit(itemsPerPage)
                );

                // If loading next page, start after last document
                if (currentPage > 1 && lastVisible) {
                    q = query(
                        regRef,
                        orderBy('createdAt', 'desc'),
                        startAfter(lastVisible),
                        limit(itemsPerPage)
                    );
                }

                const snap = await getDocs(q);
                const data = snap.docs.map(d => {
                    const docData = d.data();
                    const flattened = {
                        id: d.id,
                        ...docData
                    } as RootRegistration;

                    // Ensure orderId is populated, fallback to id
                    if (!flattened.orderId) {
                        flattened.orderId = flattened.id;
                    }

                    // Flatten userInfo fields to top level for display
                    if (docData.userInfo) {
                        flattened.userName = docData.userInfo.name || docData.userName;
                        flattened.userEmail = docData.userInfo.email || docData.userEmail;
                        flattened.userPhone = docData.userInfo.phone || docData.userPhone;
                        flattened.affiliation = docData.userInfo.affiliation || docData.affiliation;
                        flattened.licenseNumber = docData.userInfo.licenseNumber || docData.licenseNumber;

                        // [Fix] Map grade/tier from userInfo if available
                        if (!flattened.tier && docData.userInfo.grade) {
                            flattened.tier = docData.userInfo.grade;
                        }
                    }

                    // [Fix] Map schema-defined userTier to tier if tier is missing
                    if (!flattened.tier && docData.userTier) {
                        flattened.tier = docData.userTier;
                    }

                    // [Fix] Fallback to categoryName if tier is still missing (for display)
                    if (!flattened.tier && docData.categoryName) {
                        flattened.tier = docData.categoryName;
                    }

                    // [Fix] Fallback for licenseNumber if still missing
                    if (!flattened.licenseNumber) {
                        if (docData.license) flattened.licenseNumber = docData.license;
                        else if (docData.userInfo?.licensenumber) flattened.licenseNumber = docData.userInfo.licensenumber;
                        // Check formData as last resort (some legacy data might be here)
                        else if (docData.formData?.licenseNumber) flattened.licenseNumber = docData.formData.licenseNumber;
                    }

                    return flattened;
                });

                // Update cursor states
                if (snap.docs.length > 0) {
                    setLastVisible(snap.docs[snap.docs.length - 1]);
                }

                // Check if more pages available
                setHasMore(snap.docs.length === itemsPerPage);

                // Client-side filtering by search query
                let filteredData = data;
                if (searchQuery && searchQuery.trim()) {
                    const query = searchQuery.toLowerCase().trim();
                    filteredData = data.filter(reg => {
                        const name = (reg.userName || '').toLowerCase();
                        const email = (reg.userEmail || '').toLowerCase();
                        const phone = (reg.userPhone || '').toLowerCase();
                        return name.includes(query) || email.includes(query) || phone.includes(query);
                    });
                }

                setRegistrations(filteredData);
            } catch (err: unknown) {
                setError((err instanceof Error ? err.message : 'Unknown error') + " (Check Console for Link)");
            } finally {
                setLoading(false);
            }
        };

        loadData();

        // lastVisible is intentionally excluded - it's updated during pagination and shouldn't trigger refetch
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conferenceId, currentPage, itemsPerPage, searchQuery]);

    /**
     * Refresh data (reset to page 1)
     */
    const refresh = () => {
        setCurrentPage(1);
        setLastVisible(null);
    };

    /**
     * Handle page size change
     */
    const handleItemsPerPageChange = (newSize: number) => {
        setItemsPerPage(newSize);
        setCurrentPage(1);
        setLastVisible(null);
    };

    /**
     * Handle page change
     */
    const handlePageChange = (newPage: number) => {
        if (newPage === 1) {
            setCurrentPage(1);
            setLastVisible(null);
        } else if (newPage > currentPage && hasMore) {
            setCurrentPage(newPage);
        } else if (newPage < currentPage && newPage >= 1) {
            // For simplicity, reset to page 1 when going backward
            // A full implementation would track firstVisible for "Previous" functionality
            setCurrentPage(1);
            setLastVisible(null);
        }
    };

    return {
        registrations,
        loading,
        error,
        currentPage,
        itemsPerPage,
        setCurrentPage: handlePageChange,
        setItemsPerPage: handleItemsPerPageChange,
        lastVisible,
        hasMore,
        refresh
    };
}
