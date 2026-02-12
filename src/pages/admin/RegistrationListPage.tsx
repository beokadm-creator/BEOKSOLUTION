import React, { useState, useEffect, useMemo } from 'react';
import { BadgeConfig } from '../../types/print';
import { useParams, useNavigate } from 'react-router-dom';
import { useExcel } from '../../hooks/useExcel';
import { useRegistrationsPagination } from '../../hooks/useRegistrationsPagination';
import toast from 'react-hot-toast';
import { query, collection, getDocs, limit, doc, updateDoc, Timestamp, addDoc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader2, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { EregiButton } from '../../components/eregi/EregiForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
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
    const [status, setStatus] = useState<string>("Initializing...");

    // Print Modal State
    const [selectedReg, setSelectedReg] = useState<RootRegistration | null>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const badgeRef = useRef<HTMLDivElement>(null);

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

        try {
            // Need to update in subcollection now
            // conferences/{conferenceId}/registrations/{reg.id}
            if (!conferenceId) {
                toast.error("Conference ID missing");
                return;
            }
            await updateDoc(doc(db, 'conferences', conferenceId, 'registrations', reg.id), {
                badgeIssued: true,
                badgeIssuedAt: Timestamp.now()
            });
            await addDoc(collection(db, `conferences/${conferenceId}/registrations/${reg.id}/logs`), {
                type: 'BADGE_ISSUED', timestamp: Timestamp.now(), method: 'MANUAL_ADMIN_LIST'
            });
            toast.success("명찰 발급 처리 완료");
            // Refresh pagination to show updated badge status
            refreshPagination();
        } catch (e: unknown) {
            console.error("Badge issue failed:", e);
            toast.error("처리 실패");
        }
    };

    const handlePrintClick = (e: React.MouseEvent, reg: RootRegistration) => {
        e.stopPropagation();
        setSelectedReg(reg);
        setShowPrintModal(true);
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

    const handleExport = () => {
        const data = filteredData.map(r => ({
            '주문번호': r.id,
            '이름': r.userName,
            '이메일': r.userEmail || '-',
            '전화번호': r.userPhone || '-',
            '소속': r.userOrg || r.affiliation || '-',
            '면허번호': r.licenseNumber || '-',
            '등급': displayTier(r.tier),
            '결제금액': r.amount,
            '결제수단': r.paymentType || r.paymentMethod || r.method || '카드',
            '상태': statusToKorean(r.status),
            '등록일': r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : '-'
        }));
        exportToExcel(data, `Registrants_${activeSlug}_${new Date().toISOString().slice(0, 10)}`);
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
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">명찰/알림</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">삭제</th>
                            <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm uppercase tracking-wider">등록일</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredData.map(r => (
                            <tr
                                key={r.id}
                                className="hover:bg-slate-50 cursor-pointer transition-colors"
                                onClick={() => navigate(`/admin/conf/${conferenceId}/registrations/${r.id}`)}
                            >
                                <td className="p-4 font-mono text-xs text-gray-400">{r.orderId || r.id}</td>
                                <td className="p-4 font-medium text-gray-900">{r.userName}</td>
                                <td className="p-4 text-sm text-gray-500">{r.userEmail || '-'}</td>
                                <td className="p-4 text-sm text-gray-500">{r.userPhone || '-'}</td>
                                <td className="p-4 text-sm text-gray-500">{r.userOrg || r.affiliation || '-'}</td>
                                <td className="p-4 text-sm text-gray-500">{r.licenseNumber || '-'}</td>
                                <td className="p-4 text-sm text-gray-500">{displayTier(r.tier)}</td>
                                <td className="p-4 text-sm font-medium text-[#1b4d77]">{(r.amount || 0).toLocaleString()}원</td>
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
                                    <div className="flex items-center gap-2">
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
                                            onClick={(e) => handlePrintClick(e, r)}
                                            variant="secondary"
                                            className="px-2 py-1 text-xs h-auto bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                                            title="인쇄"
                                        >
                                            <Printer size={14} />
                                        </EregiButton>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <EregiButton
                                        onClick={(e) => handleDeleteRegistration(e, r)}
                                        variant="secondary"
                                        className="px-2 py-1 text-xs h-auto bg-red-50 border-red-200 hover:bg-red-100 text-red-600"
                                        title="삭제"
                                    >
                                        🗑️ 삭제
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

            {/* Print Preview Modal */}
            <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>명찰 미리보기 (Badge Preview)</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-6 bg-gray-100 rounded-xl min-h-[400px]">
                        {selectedReg && kadd_2026.badge && (
                            <div ref={badgeRef} className="shadow-2xl">
                                <BadgeTemplate
                                    data={{
                                        registrationId: selectedReg.id,
                                        name: selectedReg.userName || '',
                                        org: selectedReg.userOrg || selectedReg.affiliation || '',
                                        category: displayTier(selectedReg.tier) || selectedReg.categoryName || '참가자'
                                    }}
                                    config={kadd_2026.badge as BadgeConfig}
                                />
                            </div>
                        )}
                        {!kadd_2026.badge && <p className="text-red-500">배지 설정이 없습니다. (No Badge Config)</p>}
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <EregiButton onClick={() => setShowPrintModal(false)} variant="secondary">
                            취소
                        </EregiButton>
                        <PrintHandler
                            contentRef={badgeRef}
                            triggerButton={
                                <EregiButton variant="primary" className="bg-purple-600 hover:bg-purple-700 text-white">
                                    <Printer className="w-4 h-4 mr-2" />
                                    인쇄하기
                                </EregiButton>
                            }
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RegistrationListPage;
