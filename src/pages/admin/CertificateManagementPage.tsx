import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    collection, getDocs, query, where, Timestamp, orderBy as fbOrderBy,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase';
import { Loader2, Search, Award, Ban, ShieldCheck, RefreshCw, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AdminCertificateDownloader } from '../../components/admin/conference/AdminCertificateDownloader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import type { CertificateRecord, CertificateStatus } from '../../types/schema';
import toast from 'react-hot-toast';

interface EligibleAttendee {
    id: string;
    sourceType: 'registration' | 'external_attendee';
    name: string;
    email?: string;
    organization?: string;
    isCheckedIn: boolean;
    badgeIssued?: boolean;
}

const CertificateManagementPage: React.FC = () => {
    const { cid } = useParams<{ cid: string }>();
    const confId = cid || null;

    // ─── Shared state ────────────────────────────────────────────────────
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // ─── Tab 1: 발급 현황 ────────────────────────────────────────────────
    const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
    const [certSearch, setCertSearch] = useState('');

    // ─── Tab 2: 수동 발급 ────────────────────────────────────────────────
    const [eligibleAttendees, setEligibleAttendees] = useState<EligibleAttendee[]>([]);
    const [eligibleSearch, setEligibleSearch] = useState('');

    // ─── Fetch all data ──────────────────────────────────────────────────
    useEffect(() => {
        if (!confId) return;

        let isMounted = true;
        const fetchData = async () => {
            setLoading(true);
            try {
                            const certsSnap = await getDocs(
                    query(collection(db, `conferences/${confId}/certificates`), fbOrderBy('createdAt', 'desc'))
                );
                const certs = certsSnap.docs.map(d => d.data() as CertificateRecord);

                const regsSnap = await getDocs(
                    query(
                        collection(db, `conferences/${confId}/registrations`),
                        where('status', '==', 'PAID')
                    )
                );
                const regs = regsSnap.docs.map(d => d.data());

                const extSnap = await getDocs(
                    query(
                        collection(db, `conferences/${confId}/external_attendees`),
                        where('deleted', '==', false)
                    )
                );
                const exts = extSnap.docs.map(d => d.data());

                const issuedSourceIds = new Set(
                    certs
                        .filter(c => c.status === 'ISSUED' || c.status === 'REISSUED')
                        .map(c => c.sourceId)
                );

                const eligible: EligibleAttendee[] = [];

                for (let i = 0; i < regsSnap.docs.length; i++) {
                    const d = regsSnap.docs[i];
                    const r = regs[i];
                    const isCheckedIn = !!(r.isCheckedIn || r.badgeIssued);
                    if (!isCheckedIn) continue;
                    if (issuedSourceIds.has(d.id)) continue;
                    const name = r.userName || r.userInfo?.name || '';
                    if (!name) continue;
                    eligible.push({
                        id: d.id,
                        sourceType: 'registration',
                        name,
                        email: r.userEmail || r.userInfo?.email,
                        organization: r.userOrg || r.affiliation || r.userInfo?.affiliation,
                        isCheckedIn: !!r.isCheckedIn,
                        badgeIssued: !!r.badgeIssued,
                    });
                }

                for (let i = 0; i < extSnap.docs.length; i++) {
                    const d = extSnap.docs[i];
                    const e = exts[i];
                    const isCheckedIn = !!(e.isCheckedIn || e.badgeIssued);
                    if (!isCheckedIn) continue;
                    if (issuedSourceIds.has(d.id)) continue;
                    if (!e.name) continue;
                    eligible.push({
                        id: d.id,
                        sourceType: 'external_attendee',
                        name: e.name,
                        email: e.email,
                        organization: e.organization,
                        isCheckedIn: !!e.isCheckedIn,
                        badgeIssued: !!e.badgeIssued,
                    });
                }

                if (isMounted) {
                    setCertificates(certs);
                    setEligibleAttendees(eligible);
                }
            } catch (error) {
                console.error('Failed to fetch certificate data:', error);
                toast.error('데이터를 불러오는데 실패했습니다.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [confId]);

    // ─── Actions ─────────────────────────────────────────────────────────
    const handleRevoke = async (cert: CertificateRecord) => {
        const reason = prompt(`${cert.attendeeName} 님의 수료증(${cert.certificateNumber})을 폐기하시겠습니까?\n사유를 입력하세요 (선택):`);
        if (reason === null) return;
        if (!confId) return;

        setIsProcessing(true);
        try {
            const functions = getFunctions();
            const revokeFn = httpsCallable(functions, 'revokeCertificate');
            const result = await revokeFn({
                confId,
                certificateId: cert.id,
                reason: reason || undefined,
            }) as { data: { success: boolean; status: string } };

            if (result.data.success) {
                toast.success(`${cert.certificateNumber} 폐기 처리 완료`);
                setCertificates(prev => prev.map(c =>
                    c.id === cert.id
                        ? { ...c, status: 'REVOKED' as CertificateStatus, revokedAt: Timestamp.now() }
                        : c
                ));
                setEligibleAttendees(prev => [{
                    id: cert.sourceId,
                    sourceType: cert.sourceType,
                    name: cert.attendeeName,
                    email: cert.attendeeEmail,
                    organization: cert.attendeeOrganization,
                    isCheckedIn: true,
                }, ...prev]);
            }
        } catch (error: unknown) {
            console.error('Revoke failed:', error);
            const msg = error instanceof Error ? error.message : '폐기 처리 실패';
            toast.error(msg);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleIssue = async (attendee: EligibleAttendee) => {
        if (!confirm(`${attendee.name} 님에게 수료증을 발급하시겠습니까?`)) return;
        if (!confId) return;

        setIsProcessing(true);
        try {
            const functions = getFunctions();
            const issueFn = httpsCallable(functions, 'issueCertificate');
            const result = await issueFn({ confId, regId: attendee.id }) as {
                data: { success: boolean; certificateId?: string; certificateNumber?: string; message?: string };
            };

            if (result.data.success) {
                const certNum = result.data.certificateNumber || '발급완료';
                toast.success(`${attendee.name} 님에게 ${certNum} 발급 완료`);
                setEligibleAttendees(prev => prev.filter(a => a.id !== attendee.id));
                setCertificates(prev => [{
                    id: result.data.certificateId || '',
                    conferenceId: confId,
                    sourceType: attendee.sourceType,
                    sourceId: attendee.id,
                    certificateNumber: certNum,
                    verificationToken: '',
                    attendeeName: attendee.name,
                    attendeeEmail: attendee.email,
                    attendeeOrganization: attendee.organization,
                    status: 'ISSUED',
                    issuedAt: Timestamp.now(),
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                }, ...prev]);
            } else {
                toast(result.data.message || '이미 발급된 수료증이 있습니다.', { icon: 'ℹ️' });
            }
        } catch (error: unknown) {
            console.error('Issue failed:', error);
            const msg = error instanceof Error ? error.message : '발급 처리 실패';
            toast.error(msg);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReissue = async (cert: CertificateRecord) => {
        const reason = prompt(`${cert.attendeeName} 님의 수료증(${cert.certificateNumber})을 재발급하시겠습니까?\n사유를 입력하세요 (선택):`);
        if (reason === null) return;
        if (!confId) return;

        setIsProcessing(true);
        try {
            const functions = getFunctions();
            const reissueFn = httpsCallable(functions, 'reissueCertificate');
            const result = await reissueFn({
                confId,
                certificateId: cert.id,
                reason: reason || undefined,
            }) as {
                data: { success: boolean; newCertificateId?: string; newCertificateNumber?: string; message?: string };
            };

            if (result.data.success) {
                const newCertNum = result.data.newCertificateNumber || '재발급완료';
                toast.success(`${cert.certificateNumber} → ${newCertNum} 재발급 완료`);

                setCertificates(prev => [
                    {
                        id: result.data.newCertificateId || '',
                        conferenceId: confId,
                        sourceType: cert.sourceType,
                        sourceId: cert.sourceId,
                        certificateNumber: newCertNum,
                        verificationToken: '',
                        attendeeName: cert.attendeeName,
                        attendeeEmail: cert.attendeeEmail,
                        attendeeOrganization: cert.attendeeOrganization,
                        status: 'ISSUED',
                        issuedAt: Timestamp.now(),
                        previousCertificateId: cert.id,
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                    },
                    ...prev.map(c =>
                        c.id === cert.id
                            ? { ...c, status: 'REISSUED' as CertificateStatus, reissuedAt: Timestamp.now(), supersededById: result.data.newCertificateId || '' }
                            : c
                    ),
                ]);
            } else {
                toast(result.data.message || '재발급에 실패했습니다.', { icon: 'ℹ️' });
            }
        } catch (error: unknown) {
            console.error('Reissue failed:', error);
            const msg = error instanceof Error ? error.message : '재발급 처리 실패';
            toast.error(msg);
        } finally {
            setIsProcessing(false);
        }
    };

    // ─── Filtered lists ──────────────────────────────────────────────────
    const filteredCerts = useMemo(() => {
        const term = certSearch.trim().toLowerCase();
        if (!term) return certificates;
        return certificates.filter(c =>
            c.attendeeName.toLowerCase().includes(term) ||
            c.certificateNumber.toLowerCase().includes(term) ||
            (c.attendeeEmail || '').toLowerCase().includes(term)
        );
    }, [certificates, certSearch]);

    const filteredEligible = useMemo(() => {
        const term = eligibleSearch.trim().toLowerCase();
        if (!term) return eligibleAttendees;
        return eligibleAttendees.filter(a =>
            a.name.toLowerCase().includes(term) ||
            (a.email || '').toLowerCase().includes(term) ||
            (a.organization || '').toLowerCase().includes(term)
        );
    }, [eligibleAttendees, eligibleSearch]);

    // ─── Render helpers ──────────────────────────────────────────────────
    const statusBadge = (status: CertificateStatus) => {
        if (status === 'ISSUED') {
            return (
                <span className="px-2 py-0.5 rounded text-xs font-bold border bg-green-50 text-green-700 border-green-100">
                    발급됨
                </span>
            );
        }
        if (status === 'REISSUED') {
            return (
                <span className="px-2 py-0.5 rounded text-xs font-bold border bg-amber-50 text-amber-700 border-amber-100">
                    재발급됨
                </span>
            );
        }
        return (
            <span className="px-2 py-0.5 rounded text-xs font-bold border bg-red-50 text-red-700 border-red-100">
                폐기됨
            </span>
        );
    };

    const formatDate = (ts?: Timestamp | null) => {
        if (!ts?.seconds) return '-';
        return new Date(ts.seconds * 1000).toLocaleString('ko-KR');
    };

    if (!confId) {
        return (
            <div className="p-8 text-red-600 font-bold border border-red-400 bg-red-50 m-4 rounded">
                잘못된 학술대회 경로입니다.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center">
                <Loader2 className="animate-spin w-8 h-8 text-blue-600 mb-4" />
                <div className="text-gray-500 text-sm font-mono">데이터를 불러오는 중...</div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">수료증 관리</h1>

            <Tabs defaultValue="status" className="space-y-6">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="status">
                        발급 현황 ({certificates.length})
                    </TabsTrigger>
                    <TabsTrigger value="issue">
                        수동 발급 ({eligibleAttendees.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="status">
                    <div className="mb-4">
                        <div className="relative w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                placeholder="이름, 수료증 번호, 이메일 검색"
                                value={certSearch}
                                onChange={e => setCertSearch(e.target.value)}
                                className="w-full p-2 pl-9 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d80c6] text-sm"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
                        <table className="w-full text-left min-w-[700px]">
                            <thead className="bg-[#f0f5fa] border-b border-[#e1ecf6]">
                                <tr>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm">수료증 번호</th>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm">이름</th>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm">이메일</th>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm">소속</th>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm">상태</th>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm">발급일</th>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm text-center">다운로드</th>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCerts.map(cert => (
                                    <tr key={cert.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-mono text-xs text-gray-500">
                                            {cert.certificateNumber}
                                            {cert.previousCertificateId && (
                                                <span className="ml-1.5 text-[10px] text-amber-600 border border-amber-200 bg-amber-50 px-1 rounded">재발급</span>
                                            )}
                                        </td>
                                        <td className="p-4 font-medium text-gray-900">{cert.attendeeName}</td>
                                        <td className="p-4 text-sm text-gray-500">{cert.attendeeEmail || '-'}</td>
                                        <td className="p-4 text-sm text-gray-500">{cert.attendeeOrganization || '-'}</td>
                                        <td className="p-4">{statusBadge(cert.status)}</td>
                                        <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                                            {formatDate(cert.issuedAt)}
                                        </td>
                                        <td className="p-4 text-center text-sm text-gray-500">
                                            {(cert.downloadCount ?? 0) > 0 && (
                                                <span className="inline-flex items-center gap-1 text-gray-600">
                                                    <Download className="w-3 h-3" />
                                                    {cert.downloadCount}
                                                </span>
                                            )}
                                            {(cert.downloadCount ?? 0) === 0 && <span className="text-gray-300">-</span>}
                                        </td>
                                        <td className="p-4 text-center whitespace-nowrap">
                                            {cert.status === 'ISSUED' && (
                                                <div className="flex items-center justify-center gap-1">
                                                    <AdminCertificateDownloader
                                                        confId={cid || ''}
                                                        ui={{
                                                            name: cert.attendeeName,
                                                            aff: cert.attendeeOrganization || '',
                                                            license: cert.attendeeLicenseNumber,
                                                            amount: cert.attendeeAmount
                                                        }}
                                                        certificateId={cert.id}
                                                        certificateNumber={cert.certificateNumber}
                                                        verificationToken={cert.verificationToken || ''}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleReissue(cert)}
                                                        disabled={isProcessing}
                                                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-3 py-1 text-xs"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                                        재발급
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRevoke(cert)}
                                                        disabled={isProcessing}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1 text-xs"
                                                    >
                                                        <Ban className="w-3.5 h-3.5 mr-1" />
                                                        폐기
                                                    </Button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredCerts.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-gray-500">
                                            발급된 수료증이 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex gap-4 text-sm">
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            발급: {certificates.filter(c => c.status === 'ISSUED').length}건
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                            <div className="w-2 h-2 bg-amber-500 rounded-full" />
                            재발급됨: {certificates.filter(c => c.status === 'REISSUED').length}건
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                            폐기: {certificates.filter(c => c.status === 'REVOKED').length}건
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="issue">
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <div className="text-sm text-blue-700">
                            체크인 완료 또는 명찰 발급된 참석자 중 <strong>수료증이 아직 발급되지 않은 대상</strong>만 표시됩니다.
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="relative w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                placeholder="이름, 이메일, 소속 검색"
                                value={eligibleSearch}
                                onChange={e => setEligibleSearch(e.target.value)}
                                className="w-full p-2 pl-9 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d80c6] text-sm"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
                        <table className="w-full text-left min-w-[600px]">
                            <thead className="bg-[#f0f5fa] border-b border-[#e1ecf6]">
                                <tr>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm">이름</th>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm">이메일</th>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm">소속</th>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm">출처</th>
                                    <th className="p-4 font-bold text-[#002244] whitespace-nowrap text-sm text-center">발급</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEligible.map(attendee => (
                                    <tr key={`${attendee.sourceType}-${attendee.id}`} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-medium text-gray-900">{attendee.name}</td>
                                        <td className="p-4 text-sm text-gray-500">{attendee.email || '-'}</td>
                                        <td className="p-4 text-sm text-gray-500">{attendee.organization || '-'}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                                                attendee.sourceType === 'external_attendee'
                                                    ? 'bg-purple-50 text-purple-700 border-purple-100'
                                                    : 'bg-blue-50 text-blue-700 border-blue-100'
                                            }`}>
                                                {attendee.sourceType === 'external_attendee' ? '외부참석자' : '등록자'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleIssue(attendee)}
                                                disabled={isProcessing}
                                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1 text-xs"
                                            >
                                                <Award className="w-3.5 h-3.5 mr-1" />
                                                발급
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredEligible.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-500">
                                            발급 대상이 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default CertificateManagementPage;
