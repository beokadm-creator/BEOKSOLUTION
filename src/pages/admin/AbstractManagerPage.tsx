import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAdminStore } from '../../store/adminStore';
import { useAbstracts } from '../../hooks/useAbstracts';
import { fixBrokenSubmissions } from '../../utils/dataFixer';
import { Submission, ConferenceUser, Registration } from '../../types/schema';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Download, FileSpreadsheet, Trash2, Wrench } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { utils, writeFile } from 'xlsx';

export default function AbstractManagerPage() {
    const { selectedConferenceId, availableConferences } = useAdminStore();
    console.log('[AbstractManager] RENDER - selectedConferenceId:', selectedConferenceId);

    const { fetchAllSubmissions, judgeSubmission, deleteAbstractAsAdmin } = useAbstracts(selectedConferenceId || undefined);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(false);
    const [societies, setSocieties] = useState<Array<{ id: string; name?: { ko?: string; en?: string }; [key: string]: unknown }>>([]);
    const [users, setUsers] = useState<ConferenceUser[]>([]);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const prevConferenceIdRef = useRef<string | null>(null);

    // Optimize lookups with Maps
    const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
    const regMap = useMemo(() => new Map(registrations.map(r => [r.id, r])), [registrations]);
    const regByUserIdMap = useMemo(() => new Map(registrations.map(r => [r.userId, r])), [registrations]);

    // Judging State
    const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
    const [judgeAction, setJudgeAction] = useState<'accepted_oral' | 'accepted_poster' | 'rejected' | null>(null);
    const [comment, setComment] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const fetchContextData = useCallback(async () => {
        if (!selectedConferenceId) return;
        try {
            // Registrations
            const regsSnap = await getDocs(collection(db, `conferences/${selectedConferenceId}/registrations`));
            setRegistrations(regsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Registration)));

            // Users - Try to fetch from both locations and merge
            // Priority 1: Conference-local users (for backward compatibility)
            const confUsersSnap = await getDocs(collection(db, `conferences/${selectedConferenceId}/users`));
            const confUsers = new Map(confUsersSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as ConferenceUser]));

            // Priority 2: Global users collection (primary source for members)
            // Fetch users referenced in registrations
            const userIds = regsSnap.docs
                .map(d => d.data().userId)
                .filter((id): id is string => !!id && !confUsers.has(id));

            const globalUsers = new Map<string, ConferenceUser>();
            if (userIds.length > 0) {
                // Fetch in batches
                for (const uid of userIds) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            globalUsers.set(uid, {
                                id: uid,
                                uid: uid,
                                name: userData.name || userData.userName || '',
                                email: userData.email || '',
                                phone: userData.phone || userData.phoneNumber || '',
                                country: userData.country || 'KR',
                                isForeigner: userData.isForeigner || false,
                                organization: userData.organization || userData.affiliation || '',
                                tier: userData.tier || 'MEMBER',
                                authStatus: userData.authStatus || { emailVerified: false, phoneVerified: false },
                                createdAt: userData.createdAt || { seconds: 0, nanoseconds: 0 },
                                updatedAt: userData.updatedAt || { seconds: 0, nanoseconds: 0 }
                            } as ConferenceUser);
                        }
                    } catch (e) {
                        console.warn(`Failed to fetch user ${uid}:`, e);
                    }
                }
            }

            // Merge: global users override conference-local users
            const mergedUsers = new Map([...confUsers]);
            globalUsers.forEach((user, uid) => {
                mergedUsers.set(uid, user);
            });

            setUsers(Array.from(mergedUsers.values()));
        } catch (e) {
            console.error("Failed to fetch context data:", e);
        }
    }, [selectedConferenceId]);

    const loadSubmissions = useCallback(async () => {
        setLoading(true);
        const data = await fetchAllSubmissions();
        console.log("[AbstractManager] Fetched submissions:", data.length);
        setSubmissions(data);
        setLoading(false);
    }, [fetchAllSubmissions]);

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        // Prevent multiple executions for the same conference
        if (selectedConferenceId === prevConferenceIdRef.current) {
            console.log('[AbstractManager] Skipping - same conference ID');
            return;
        }

        // [Step 405] Debug conference selection
        console.log("[AbstractManager] Conference ID:", selectedConferenceId);
        if (selectedConferenceId) {
            prevConferenceIdRef.current = selectedConferenceId;
            void loadSubmissions();
            fetchContextData();
        } else {
            // [Debug] Auto-select first available for testing
            console.log("[AbstractManager] No conference selected, waiting for conference selection");
        }

        // Fetch Societies for Excel Export
        const fetchSocieties = async () => {
            try {
                const snap = await getDocs(collection(db, 'societies'));
                setSocieties(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.error("Failed to fetch societies:", e);
            }
        };
        fetchSocieties();
    }, [selectedConferenceId]); // Intentionally omit loadSubmissions and fetchContextData to prevent infinite loop
    /* eslint-enable react-hooks/exhaustive-deps */

    const handleJudgeClick = (sub: Submission, action: 'accepted_oral' | 'accepted_poster' | 'rejected') => {
        setSelectedSub(sub);
        setJudgeAction(action);
        setComment(sub.reviewerComment || '');
        setIsDialogOpen(true);
    };

    const confirmJudge = async () => {
        if (!selectedSub || !judgeAction) return;

        const success = await judgeSubmission(selectedSub.id, judgeAction, comment);
        if (success) {
            toast.success('심사 결과가 저장되었습니다.');
            setIsDialogOpen(false);
            loadSubmissions();
        } else {
            toast.error('심사 저장 실패');
        }
    };

    const getStatusBadge = (status?: string) => {
        switch (status) {
            case 'accepted_oral':
                return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200 px-3 py-1 shadow-none">Oral Accepted</Badge>;
            case 'accepted_poster':
                return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 px-3 py-1 shadow-none">Poster Accepted</Badge>;
            case 'rejected':
                return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 shadow-none">Rejected</Badge>;
            default:
                return <Badge variant="secondary" className="bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 shadow-none">Under Review</Badge>;
        }
    };

    const handleDeleteAbstract = async (sub: Submission) => {
        if (!window.confirm('정말 삭제하시겠습니까? 첨부파일도 함께 영구 삭제됩니다.')) return;
        
        const success = await deleteAbstractAsAdmin(sub);
        if (success) {
            toast.success('초록이 삭제되었습니다.');
            setSubmissions(prev => prev.filter(s => s.id !== sub.id));
        } else {
            toast.error('삭제 실패');
        }
    };

    const getSubmitterInfo = (sub: Submission) => {
        let user: ConferenceUser | undefined;
        let reg: Registration | undefined;
        let isMember = false;

        // 1. userId -> users
        if (sub.userId) {
            user = userMap.get(sub.userId);
            if (user) isMember = true;
        }

        // 2. registrationId -> registrations
        if (!user && sub.registrationId) {
            reg = regMap.get(sub.registrationId);
        }

        // 3. Fallback: submitterId
        if (!user && !reg && sub.submitterId) {
            // Try users first
            user = userMap.get(sub.submitterId);
            if (user) {
                isMember = true;
            } else {
                // Try registrations
                reg = regMap.get(sub.submitterId);
            }
        }
        
        // Additional: If user found but reg not found, try to find reg by userId
        if (user && !reg) {
             reg = regByUserIdMap.get(user.id);
        }

        // If no user and no reg, we can't show info
        if (!user && !reg) return <div className="text-red-400 text-xs mt-3 pt-3 border-t border-gray-100">정보 매핑 실패 ({sub.submitterId})</div>;
        
        // Fallback display values
        // Use intersection type to access potential legacy fields
        const regTyped = reg as Registration & { name?: string; email?: string; affiliation?: string };
        const name = user?.name || regTyped?.name || regTyped?.userName || 'Unknown'; 
        const affiliation = user?.organization || regTyped?.affiliation || '소속 없음';
        const email = user?.email || regTyped?.email || regTyped?.userEmail || '';
        
        return (
            <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
                <div className="flex items-center gap-2 text-gray-700 flex-wrap">
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        {reg?.receiptNumber || '미등록'}
                    </span>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" 
                          style={{backgroundColor: isMember ? '#dcfce7' : '#fef3c7', color: isMember ? '#166534' : '#92400e'}}>
                        {isMember ? '회원' : '비회원'}
                    </span>
                    <a 
                        href={reg ? `/admin/registrations/${reg.id}` : '#'} 
                        className="font-medium hover:underline hover:text-blue-600 flex items-center gap-1"
                        target="_blank" rel="noreferrer"
                    >
                        {name}
                        <span className="text-gray-400 font-normal">({affiliation})</span>
                    </a>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-500">{email}</span>
                </div>
            </div>
        );
    };

    const handleDownloadExcel = () => {
        if (submissions.length === 0) {
            toast.error("다운로드할 데이터가 없습니다.");
            return;
        }

        const excelData = submissions.map((sub, index) => {
            // [Step 422-D] Society Name Mapping
            const targetConf = availableConferences.find(c => c.id === selectedConferenceId);
            const targetSoc = societies.find(s => s.id === targetConf?.societyId);
            const societyName = targetSoc?.name?.ko || targetSoc?.name || '';

            return {
                'No': index + 1,
                '학회명': societyName,
                '제목(국문)': sub.title?.ko || '',
                '제목(영문)': sub.title?.en || '',
                '분야': sub.field || '',
                '발표타입': sub.type || '',
                '저자': sub.authors?.map(a => `${a.name}${a.isPresenter ? '(발표자)' : ''}`).join(', ') || '',
                '발표자 이메일': sub.authors?.find(a => a.isPresenter)?.email || '',
                '소속': sub.authors?.find(a => a.isPresenter)?.affiliation || '',
                '획득 점수': (sub as Submission & { score?: number; reviewerScore?: number }).score || (sub as Submission & { score?: number; reviewerScore?: number }).reviewerScore || '',
                '상태': sub.reviewStatus || 'submitted',
                '심사의견': sub.reviewerComment || '',
                '제출일': sub.submittedAt ? new Date(sub.submittedAt.seconds * 1000).toLocaleString() : '',
                '파일링크': sub.fileUrl || ''
            };
        });

        const ws = utils.json_to_sheet(excelData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "초록목록");
        writeFile(wb, `초록목록_${selectedConferenceId || 'all'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDataRecovery = async () => {
        if (!selectedConferenceId) return;
        if (!window.confirm("데이터 복구(초록 연결 보정)를 실행하시겠습니까? \n이메일과 이름을 기반으로 비회원 초록을 등록 정보와 재연결합니다.")) return;

        const toastId = toast.loading("데이터 복구 중...");
        try {
            const result = await fixBrokenSubmissions(selectedConferenceId);
            
            if (result.success) {
                toast.success(`복구 완료: ${result.fixedCount}건 수정됨`, { id: toastId });
                console.log("Fix logs:", result.logs);
                if (result.fixedCount && result.fixedCount > 0) {
                     loadSubmissions();
                }
            } else {
                toast.error("복구 실패", { id: toastId });
                console.error(result.error);
            }
        } catch (e) {
            toast.error("오류 발생", { id: toastId });
            console.error(e);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">초록 심사 관리</h1>
                <div className="flex gap-2">
                    <Button onClick={handleDataRecovery} variant="outline" size="sm" className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50">
                        <Wrench className="w-4 h-4" />
                        데이터 복구
                    </Button>
                    <Button onClick={handleDownloadExcel} variant="outline" size="sm" className="gap-2">
                        <FileSpreadsheet className="w-4 h-4" />
                        엑셀 다운로드
                    </Button>
                    <Button onClick={loadSubmissions} variant="outline" size="sm">
                        새로고침
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead className="w-12 text-center">
                                {/* Bulk Action Checkbox Placeholder */}
                                <div className="w-4 h-4 border rounded border-gray-300 mx-auto"></div>
                            </TableHead>
                            <TableHead className="py-4 pl-6 w-[400px]">제목 / 저자</TableHead>
                            <TableHead className="py-4">분야 / 타입</TableHead>
                            <TableHead className="py-4">파일</TableHead>
                            <TableHead className="py-4">상태</TableHead>
                            <TableHead className="py-4 pr-6 text-right">관리</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                                    로딩 중...
                                </TableCell>
                            </TableRow>
                        ) : submissions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                                    접수된 초록이 없습니다.
                                </TableCell>
                            </TableRow>
                        ) : (
                            submissions.map((sub) => (
                                <TableRow key={sub.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <TableCell className="align-top py-6 text-center">
                                        <div className="w-4 h-4 border rounded border-gray-300 mx-auto mt-1 cursor-pointer hover:border-blue-500"></div>
                                    </TableCell>
                                    <TableCell className="py-6 pl-6 align-top">
                                        <div className="font-bold text-gray-900 text-lg leading-snug mb-1">{sub.title.ko}</div>
                                        <div className="text-sm text-gray-500 font-medium mb-2">{sub.title.en}</div>
                                        <div className="flex items-center gap-2 text-sm text-[#003366] font-semibold bg-blue-50 inline-flex px-2 py-1 rounded">
                                            <span>{sub.authors.find(a => a.isPresenter)?.name}</span>
                                            <span className="text-xs text-blue-400 font-normal border-l border-blue-200 pl-2 ml-1">Presentation Author</span>
                                        </div>
                                        {getSubmitterInfo(sub)}
                                    </TableCell>
                                    <TableCell className="py-6 align-top">
                                        <div className="space-y-2">
                                            <Badge variant="outline" className="border-gray-300 text-gray-600 block w-fit">{sub.field}</Badge>
                                            <Badge variant="outline" className="border-gray-300 text-gray-600 block w-fit">{sub.type}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-6 align-top">
                                        {sub.fileUrl && (
                                            <Button variant="ghost" size="sm" asChild className="h-8 text-gray-500 hover:text-[#003366] hover:bg-blue-50">
                                                <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer">
                                                    <Download className="w-4 h-4 mr-1.5" />
                                                    Download
                                                </a>
                                            </Button>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-6 align-top">
                                        {getStatusBadge(sub.reviewStatus)}
                                    </TableCell>
                                    <TableCell className="py-6 pr-6 align-top text-right">
                                        <div className="flex flex-col gap-2 items-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 w-24 justify-start text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800 bg-white"
                                                onClick={() => handleJudgeClick(sub, 'accepted_oral')}
                                            >
                                                <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span> 구두 승인
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 w-24 justify-start text-blue-700 border-blue-200 hover:bg-blue-50 hover:text-blue-800 bg-white"
                                                onClick={() => handleJudgeClick(sub, 'accepted_poster')}
                                            >
                                                <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span> 포스터 승인
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 w-24 justify-start text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800 bg-white"
                                                onClick={() => handleJudgeClick(sub, 'rejected')}
                                            >
                                                <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span> 반려
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-24 justify-start text-gray-500 hover:bg-red-50 hover:text-red-600 mt-2"
                                                onClick={() => handleDeleteAbstract(sub)}
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" /> 삭제
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>심사 결과 저장</DialogTitle>
                        <DialogDescription>
                            선택한 초록에 대한 심사 결과를 저장합니다.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">결과:</span>
                            {judgeAction === 'accepted_oral' && <Badge className="bg-green-600 hover:bg-green-700">구두 발표 승인</Badge>}
                            {judgeAction === 'accepted_poster' && <Badge className="bg-blue-600 hover:bg-blue-700">포스터 발표 승인</Badge>}
                            {judgeAction === 'rejected' && <Badge variant="destructive">반려 (Rejected)</Badge>}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="reviewer-comment" className="text-sm font-medium">심사 의견 (선택사항)</label>
                            <Textarea
                                id="reviewer-comment"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="심사 의견을 입력하세요..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
                        <Button onClick={confirmJudge}>확인 및 저장</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}