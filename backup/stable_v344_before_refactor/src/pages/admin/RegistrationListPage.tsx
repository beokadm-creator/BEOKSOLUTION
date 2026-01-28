import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExcel } from '../../hooks/useExcel';
import toast from 'react-hot-toast';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, limit, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader2 } from 'lucide-react';

// Define the root-level registration type based on PaymentSuccessHandler
interface RootRegistration {
    id: string; // orderId
    originalRegId: string;
    slug: string;
    societyId: string;
    conferenceId: string;
    userId: string;
    userName: string;
    userEmail: string;
    userPhone: string;
    grade: string;
    amount: number;
    status: string; // 'PAID'
    paymentKey?: string;
    licenseNumber?: string; // Added
    paymentType?: string; // Added (e.g., '카드', '계좌이체')
    method?: string; // Fallback for payment method
    createdAt: Timestamp;
    badgeIssued?: boolean;
    badgeIssuedAt?: Timestamp;
}

const statusToKorean = (status: string) => {
    switch (status) {
        case 'PAID': return '결제완료';
        case 'PENDING': return '대기';
        case 'REFUNDED': return '환불완료';
        case 'REFUND_REQUESTED': return '환불요청';
        case 'CANCELED': return '취소됨';
        default: return status;
    }
};

const RegistrationListPage: React.FC = () => {
    // [Fix-Step 150] BYPASS STRICT HOOK & MANUAL RESOLVE
    // const { slug } = useConference(); // REMOVED
    const { slug } = useParams<{ slug: string }>(); // Use Router Params directly
    const navigate = useNavigate();

    const { exportToExcel, processing: exporting } = useExcel();

    const [registrations, setRegistrations] = useState<RootRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [searchName, setSearchName] = useState('');

    // [Fix-Step 150] Smart Slug Auto-Resolution (Manual)
    const [activeSlug, setActiveSlug] = useState<string | null>(slug || null);
    const [status, setStatus] = useState<string>("Initializing...");
    const societyId = 'kap'; // Hardcoded for now, or fetch from Auth context if possible

    // Auto-Resolve Slug if missing
    useEffect(() => {
        if (slug) {
            setActiveSlug(slug);
            setStatus(`URL Slug Found: ${slug}`);
            return;
        }

        const resolveSlug = async () => {
            setStatus("HOOK BYPASSED. Searching for active conference...");
            try {
                // Try to find ANY conference for this society (or system-wide fallback)
                // Assuming 'kap' is the default society for this admin view
                console.log("🔍 Auto-detecting conference...");
                const q = query(collection(db, 'conferences'), limit(1));
                const snap = await getDocs(q);
                
                if (!snap.empty) {
                    const found = snap.docs[0].data().slug;
                    console.log("✅ Found active slug:", found);
                    setActiveSlug(found);
                    setStatus(`Auto-Resolved: ${found}`);
                } else {
                    setError("No active conferences found in system.");
                    setStatus("Resolution Failed: No conferences found.");
                }
            } catch (e: any) {
                console.error("Auto-Resolve Failed:", e);
                setError("Failed to auto-resolve conference.");
                setStatus(`Resolution Error: ${e.message}`);
            }
        };

        resolveSlug();
    }, [slug]);

    // Fetch Data from Root 'registrations' collection
    useEffect(() => {
        const loadData = async () => {
            if (!activeSlug) {
                // Wait for resolution
                return;
            }
            
            setLoading(true);
            setError(null);
            
            try {
                console.log("Fetching registrations for:", activeSlug);
                const q = query(
                    collection(db, 'registrations'), 
                    where('slug', '==', activeSlug)
                );
                
                const snap = await getDocs(q);
                // @ts-ignore
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as RootRegistration[];
                
                // Sort by date desc (client side)
                data.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
                
                setRegistrations(data);
            } catch (err: any) {
                console.error("Admin List Error:", err);
                setError(err.message + " (Check Console for Link)");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [activeSlug]);

    // Action: Issue Badge Manual
    const handleIssueBadge = async (e: React.MouseEvent, reg: RootRegistration) => {
        e.stopPropagation();
        if (!confirm(`${reg.userName} 님의 명찰을 발급 처리하시겠습니까?`)) return;
        
        try {
            await updateDoc(doc(db, 'registrations', reg.id), {
                badgeIssued: true,
                badgeIssuedAt: Timestamp.now()
            });
            await addDoc(collection(db, `registrations/${reg.id}/logs`), {
                type: 'BADGE_ISSUED', timestamp: Timestamp.now(), method: 'MANUAL_ADMIN_LIST'
            });
            toast.success("명찰 발급 처리 완료");
            // Refresh local state ideally, or rely on next fetch
            setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, badgeIssued: true } : r));
        } catch (e: any) {
            console.error(e);
            toast.error("처리 실패");
        }
    };

    const filteredData = useMemo(() => {
        return registrations.filter(r => {
            const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
            const matchesName = r.userName.toLowerCase().includes(searchName.toLowerCase());
            return matchesStatus && matchesName;
        });
    }, [registrations, filterStatus, searchName]);

    const handleExport = () => {
        const data = filteredData.map(r => ({
            '주문번호': r.id,
            '이름': r.userName,
            '이메일': r.userEmail || '-',
            '전화번호': r.userPhone || '-',
            '면허번호': r.licenseNumber || '-',
            '등급': r.grade,
            '결제금액': r.amount,
            '결제수단': r.paymentType || r.method || '카드',
            '상태': statusToKorean(r.status),
            '등록일': new Date(r.createdAt.seconds * 1000).toLocaleDateString()
        }));
        exportToExcel(data, `Registrants_${activeSlug}_${new Date().toISOString().slice(0,10)}`);
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
                    placeholder="이름 검색 (Search Name)" 
                    value={searchName} 
                    onChange={e => setSearchName(e.target.value)} 
                    className="p-2 border rounded w-64"
                />
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)} 
                    className="p-2 border rounded"
                >
                    <option value="ALL">전체 상태 (All Status)</option>
                    <option value="PAID">결제완료 (PAID)</option>
                    <option value="REFUNDED">환불완료 (REFUNDED)</option>
                </select>
                <button 
                    onClick={handleExport} 
                    disabled={exporting}
                    className="ml-auto bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                    {exporting ? 'Exporting...' : '엑셀 다운로드 (Excel)'}
                </button>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded shadow overflow-hidden overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 font-medium text-gray-600 whitespace-nowrap">주문번호</th>
                            <th className="p-4 font-medium text-gray-600 whitespace-nowrap">이름</th>
                            <th className="p-4 font-medium text-gray-600 whitespace-nowrap">이메일</th>
                            <th className="p-4 font-medium text-gray-600 whitespace-nowrap">전화번호</th>
                            <th className="p-4 font-medium text-gray-600 whitespace-nowrap">면허번호</th>
                            <th className="p-4 font-medium text-gray-600 whitespace-nowrap">등급</th>
                            <th className="p-4 font-medium text-gray-600 whitespace-nowrap">결제금액</th>
                            <th className="p-4 font-medium text-gray-600 whitespace-nowrap">결제수단</th>
                            <th className="p-4 font-medium text-gray-600 whitespace-nowrap">상태</th>
                            <th className="p-4 font-medium text-gray-600 whitespace-nowrap">명찰/알림</th>
                            <th className="p-4 font-medium text-gray-600 whitespace-nowrap">등록일</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredData.map(r => (
                            <tr 
                                key={r.id} 
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => navigate(`/admin/conference/registrations/${r.id}`)}
                            >
                                <td className="p-4 font-mono text-xs text-gray-500">{r.id}</td>
                                <td className="p-4 font-medium text-gray-900">{r.userName}</td>
                                <td className="p-4 text-sm text-gray-600">{r.userEmail || '-'}</td>
                                <td className="p-4 text-sm text-gray-600">{r.userPhone || '-'}</td>
                                <td className="p-4 text-sm text-gray-600">{r.licenseNumber || '-'}</td>
                                <td className="p-4 text-sm text-gray-600">{r.grade}</td>
                                <td className="p-4 text-sm font-medium text-blue-600">{r.amount.toLocaleString()}원</td>
                                <td className="p-4 text-sm text-gray-600">{r.paymentType || r.method || '카드'}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        r.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                        {statusToKorean(r.status)}
                                    </span>
                                </td>
                                <td className="p-4">
                                    {r.badgeIssued ? (
                                        <span className="text-green-600 font-bold text-sm">✅ 발급완료</span>
                                    ) : (
                                        r.status === 'PAID' && (
                                            <button 
                                                onClick={(e) => handleIssueBadge(e, r)}
                                                className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-200"
                                            >
                                                명찰 발급
                                            </button>
                                        )
                                    )}
                                </td>
                                <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                                    {new Date(r.createdAt.seconds * 1000).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                        {filteredData.length === 0 && (
                            <tr><td colSpan={10} className="p-8 text-center text-gray-500">등록된 내역이 없습니다. (No records found)</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RegistrationListPage;
