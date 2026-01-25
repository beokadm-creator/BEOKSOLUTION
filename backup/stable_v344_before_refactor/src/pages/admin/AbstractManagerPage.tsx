import React, { useEffect, useState } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { useAdminStore } from '../../store/adminStore';
import { useAbstracts } from '../../hooks/useAbstracts';
import { Submission } from '../../types/schema';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { utils, writeFile } from 'xlsx';

export default function AbstractManagerPage() {
    const { selectedConferenceId, availableConferences } = useAdminStore();
    const { fetchAllSubmissions, judgeSubmission } = useAbstracts(selectedConferenceId || '');
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(false);
    const [societies, setSocieties] = useState<any[]>([]);

    // Judging State
    const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
    const [judgeAction, setJudgeAction] = useState<'accepted_oral' | 'accepted_poster' | 'rejected' | null>(null);
    const [comment, setComment] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        // [Step 405] Debug conference selection
        console.log("[AbstractManager] Conference ID:", selectedConferenceId);
        if (selectedConferenceId) {
            loadSubmissions();
        } else {
            // [Debug] Auto-select first available for testing
            console.log("[AbstractManager] No conference selected, using default '2026spring'");
            loadSubmissionsForConference('2026spring');
        }

        // Fetch Societies for Excel Export
        const fetchSocieties = async () => {
            try {
                const db = getFirestore();
                const snap = await getDocs(collection(db, 'societies'));
                setSocieties(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.error("Failed to fetch societies:", e);
            }
        };
        fetchSocieties();
    }, [selectedConferenceId]);

    const loadSubmissionsForConference = async (confId: string) => {
        setLoading(true);
        try {
            const { fetchAllSubmissions } = useAbstracts(confId);
            const data = await fetchAllSubmissions();
            setSubmissions(data);
        } catch (e) {
            console.error("[AbstractManager] Load error:", e);
        } finally {
            setLoading(false);
        }
    };

    const loadSubmissions = async () => {
        setLoading(true);
        const data = await fetchAllSubmissions();
        console.log("[AbstractManager] Fetched submissions:", data.length);
        setSubmissions(data);
        setLoading(false);
    };

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
                '획득 점수': (sub as any).score || (sub as any).reviewerScore || '',
                '상태': sub.reviewStatus || 'submitted',
                '심사의견': sub.reviewerComment || '',
                '제출일': sub.submittedAt ? new Date((sub.submittedAt as any).seconds * 1000).toLocaleString() : '',
                '파일링크': sub.fileUrl || ''
            };
        });

        const ws = utils.json_to_sheet(excelData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "초록목록");
        writeFile(wb, `초록목록_${selectedConferenceId || 'all'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">초록 심사 관리</h1>
                <div className="flex gap-2">
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
                                <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                                    로딩 중...
                                </TableCell>
                            </TableRow>
                        ) : submissions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                                    접수된 초록이 없습니다.
                                </TableCell>
                            </TableRow>
                        ) : (
                            submissions.map((sub) => (
                                <TableRow key={sub.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <TableCell className="py-6 pl-6 align-top">
                                        <div className="font-bold text-gray-900 text-lg leading-snug mb-1">{sub.title.ko}</div>
                                        <div className="text-sm text-gray-500 font-medium mb-2">{sub.title.en}</div>
                                        <div className="flex items-center gap-2 text-sm text-[#003366] font-semibold bg-blue-50 inline-flex px-2 py-1 rounded">
                                            <span>{sub.authors.find(a => a.isPresenter)?.name}</span>
                                            <span className="text-xs text-blue-400 font-normal border-l border-blue-200 pl-2 ml-1">Presentation Author</span>
                                        </div>
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
                            <label className="text-sm font-medium">심사 의견 (선택사항)</label>
                            <Textarea
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