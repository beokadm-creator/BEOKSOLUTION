import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, writeBatch, doc, deleteDoc, query, orderBy, Timestamp, setDoc, where, limit, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAdminStore } from '../../store/adminStore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { Plus, Trash2, RefreshCw, Upload, Users, Search, Settings, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Grade {
    id: string;
    name: string;
    code: string;
}

interface Member {
    id: string;
    societyId: string;
    name: string;
    code: string; // License Number or ID
    expiryDate: string; // YYYY-MM-DD
    grade: string; // Grade Code
    createdAt: Timestamp;
    used?: boolean;
    usedBy?: string;
    usedAt?: Timestamp;
}

export default function MemberManagerPage() {
    const { selectedSocietyId } = useAdminStore();
    const [members, setMembers] = useState<Member[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Single Add State
    const [newName, setNewName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [newExpiry, setNewExpiry] = useState('');
    const [newGrade, setNewGrade] = useState('');

    // Bulk Add State
    const [bulkData, setBulkData] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Grade Settings State
    const [newGradeName, setNewGradeName] = useState('');
    const [newGradeCode, setNewGradeCode] = useState('');

    // Determine Society ID
    const getSocietyId = () => {
        if (selectedSocietyId) return selectedSocietyId;
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') return parts[0];
        if (hostname === 'localhost' || hostname === '127.0.0.1') return 'kap'; 
        return null;
    };

    const targetId = getSocietyId();

    const fetchGrades = async () => {
        if (!targetId) return;
        try {
            const snapshot = await getDocs(collection(db, 'societies', targetId, 'settings', 'grades', 'list'));
            // If empty, set defaults? No, let user add them.
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));
            setGrades(list);
            if (list.length > 0 && !newGrade) setNewGrade(list[0].code);
        } catch (error) {
            console.error("Error fetching grades:", error);
        }
    };

    const fetchMembers = async () => {
        if (!targetId) return;
        setLoading(true);
        try {
            // [Fix-Step 347] Realign Admin DB Paths to Sub-collection
            // Old: collection(db, 'members') with where clause
            // New: collection(db, 'societies', targetId, 'members')
            
            // INDEX ERROR FIX: Remove DB-level sorting to avoid composite index requirement
            const q = collection(db, 'societies', targetId, 'members');
            
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
            
            // Client-side sorting (Newest first)
            list.sort((a, b) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });
            
            setMembers(list);
        } catch (error) {
            console.error("Error fetching members:", error);
            toast.error("회원 목록을 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (targetId) {
            fetchGrades();
            fetchMembers();
        }
    }, [targetId]);

    const handleAddGrade = async () => {
        if (!targetId) return;
        if (!newGradeName || !newGradeCode) {
            toast.error("등급 이름과 코드를 입력해주세요.");
            return;
        }
        try {
            await setDoc(doc(db, 'societies', targetId, 'settings', 'grades', 'list', newGradeCode), {
                name: newGradeName,
                code: newGradeCode
            });
            toast.success("등급이 추가되었습니다.");
            setNewGradeName('');
            setNewGradeCode('');
            fetchGrades();
        } catch (e) {
            toast.error("등급 추가 실패");
        }
    };

    const handleDeleteGrade = async (gradeId: string) => {
        if (!targetId) return;
        if (!window.confirm("이 등급을 삭제하시겠습니까?")) return;
        try {
            await deleteDoc(doc(db, 'societies', targetId, 'settings', 'grades', 'list', gradeId));
            toast.success("등급이 삭제되었습니다.");
            fetchGrades();
        } catch (e) {
            toast.error("삭제 실패");
        }
    };

    const handleSingleAdd = async () => {
        if (!targetId) return;
        if (!newName || !newCode || !newExpiry || !newGrade) {
            toast.error("모든 필드를 입력해주세요.");
            return;
        }

        try {
            // [Fix-Step 347] Use subcollection path
            await addDoc(collection(db, 'societies', targetId, 'members'), {
                societyId: targetId,
                name: newName.trim(),
                code: newCode.trim(),
                expiryDate: newExpiry,
                grade: newGrade,
                used: false,
                createdAt: Timestamp.now()
            });
            toast.success("회원이 추가되었습니다.");
            setNewName('');
            setNewCode('');
            fetchMembers();
        } catch (error) {
            console.error("Error adding member:", error);
            toast.error("추가 실패");
        }
    };

    const handleBulkUpload = async () => {
        toast.error("CSV/Excel 업로드 기능은 더 이상 지원되지 않습니다. (Purged)");
    };

    // [Fix-Step 257] Fix Delete Logic (Root Collection)
    const handleDelete = async (id: string) => {
        if (!targetId) return;
        if (!window.confirm("정말 삭제하시겠습니까? (This action cannot be undone)")) return;

        try {
            // [Fix-Step 347] Correct Path: doc(db, 'societies', targetId, 'members', id)
            await deleteDoc(doc(db, 'societies', targetId, 'members', id));
            toast.success("삭제되었습니다.");
            fetchMembers();
        } catch (error) {
            console.error("Error deleting member:", error);
            toast.error("삭제 실패");
        }
    };

    // [New] Reset Member Status
    const handleResetMember = async (id: string) => {
        if (!targetId) return;
        if (!window.confirm("이 회원의 '사용됨(Used)' 상태를 초기화하시겠습니까? 다시 등록에 사용할 수 있게 됩니다.")) return;

        try {
            const memberRef = doc(db, 'societies', targetId, 'members', id);
            await updateDoc(memberRef, {
                used: false,
                usedBy: deleteField(),
                usedAt: deleteField()
            });
            toast.success("회원 상태가 초기화되었습니다.");
            fetchMembers();
        } catch (error) {
            console.error("Error resetting member:", error);
            toast.error("초기화 실패");
        }
    };

    // Filtering
    const filteredMembers = members.filter(m => 
        m.name.includes(searchTerm) || m.code.includes(searchTerm)
    );

    const isExpired = (dateStr: string) => {
        const today = new Date().toISOString().split('T')[0];
        return dateStr < today;
    };
    
    const getGradeName = (code: string) => grades.find(g => g.code === code)?.name || code;

    if (!targetId) return <div className="p-10 text-center">Society ID not found.</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8 pb-20">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                    <Users className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">학회 정회원 인증 관리</h1>
                    <p className="text-gray-500 mt-1">회원가 할인을 위한 인증 데이터베이스(Whitelist)를 관리합니다.</p>
                </div>
            </div>

            <Tabs defaultValue="list" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-8">
                    <TabsTrigger value="list">회원 목록 ({members.length})</TabsTrigger>
                    <TabsTrigger value="add">개별 추가</TabsTrigger>
                    <TabsTrigger value="bulk">일괄 등록 (Excel/CSV)</TabsTrigger>
                    <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-2"/>등급 설정</TabsTrigger>
                </TabsList>

                {/* Tab 1: List */}
                <TabsContent value="list" className="space-y-4">
                    <div className="flex justify-between items-center gap-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="이름 또는 면허번호 검색..." 
                                className="pl-8" 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="icon" onClick={fetchMembers} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>이름</TableHead>
                                    <TableHead>인증코드 (면허번호)</TableHead>
                                    <TableHead>등급</TableHead>
                                    <TableHead>유효기간</TableHead>
                                    <TableHead>상태</TableHead>
                                    <TableHead>사용자 (Used By)</TableHead>
                                    <TableHead>사용일 (Used At)</TableHead>
                                    <TableHead className="text-right">관리</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMembers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center h-32 text-gray-500">
                                            등록된 인증 코드가 없습니다. (SocietyID: <span className="font-mono font-bold">{targetId}</span>)
                                            <br/>
                                            <span className="text-xs text-slate-400">데이터가 보이지 않으면 관리자에게 문의하세요.</span>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredMembers.map((member) => (
                                        <TableRow key={member.id}>
                                            <TableCell className="font-medium">{member.name}</TableCell>
                                            <TableCell className="font-mono text-xs">{member.code}</TableCell>
                                            <TableCell><Badge variant="secondary">{getGradeName(member.grade)}</Badge></TableCell>
                                            <TableCell>{member.expiryDate}</TableCell>
                                            <TableCell>
                                                {member.used ? (
                                                    <Badge variant="destructive">사용 완료</Badge>
                                                ) : isExpired(member.expiryDate) ? (
                                                    <Badge variant="outline" className="text-orange-500 border-orange-200 bg-orange-50">기간 만료</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">사용 가능</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-gray-500 font-mono">
                                                {member.usedBy || '-'}
                                            </TableCell>
                                            <TableCell className="text-xs text-gray-500">
                                                {member.usedAt ? new Date(member.usedAt.seconds * 1000).toLocaleString() : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {member.used && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleResetMember(member.id)}
                                                        className="text-orange-400 hover:text-orange-600 mr-1"
                                                        title="사용 상태 초기화 (Reset)"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handleDelete(member.id)}
                                                    className="text-gray-400 hover:text-red-600"
                                                    title="삭제 (Delete)"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                {/* Tab 2: Manual Add */}
                <TabsContent value="add">
                    <Card>
                        <CardHeader>
                            <CardTitle>회원 개별 추가</CardTitle>
                            <CardDescription>한 명의 회원을 직접 입력하여 추가합니다.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 max-w-md">
                            <div className="space-y-2">
                                <Label>등급 (Grade)</Label>
                                <select 
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newGrade}
                                    onChange={e => setNewGrade(e.target.value)}
                                >
                                    <option value="">등급 선택...</option>
                                    {grades.map(g => (
                                        <option key={g.id} value={g.code}>{g.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>이름 (Name)</Label>
                                <Input 
                                    placeholder="홍길동" 
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>인증코드 (면허번호/회원번호)</Label>
                                <Input 
                                    placeholder="12345" 
                                    value={newCode}
                                    onChange={e => setNewCode(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>유효기간 (Expiry Date)</Label>
                                <Input 
                                    type="date" 
                                    value={newExpiry}
                                    onChange={e => setNewExpiry(e.target.value)}
                                />
                            </div>
                            <Button onClick={handleSingleAdd} className="w-full mt-4">
                                <Plus className="w-4 h-4 mr-2" /> 추가하기
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 3: Bulk Upload */}
                <TabsContent value="bulk">
                    <Card>
                        <CardHeader>
                            <CardTitle>일괄 등록 (Bulk Upload)</CardTitle>
                            <CardDescription>
                                엑셀이나 메모장에서 데이터를 복사하여 붙여넣으세요. <br/>
                                형식: <code>이름,인증코드,유효기간(YYYY-MM-DD)</code> (콤마 또는 탭으로 구분)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>일괄 적용할 등급 선택</Label>
                                <select 
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newGrade}
                                    onChange={e => setNewGrade(e.target.value)}
                                >
                                    <option value="">등급 선택...</option>
                                    {grades.map(g => (
                                        <option key={g.id} value={g.code}>{g.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-slate-50 p-4 rounded text-xs font-mono text-slate-600 border border-dashed border-slate-300 mb-2">
                                예시:<br/>
                                홍길동,1001,2026-12-31<br/>
                                김철수,1002,2026-12-31<br/>
                                이영희	1003	2026-12-31
                            </div>
                            <Textarea 
                                placeholder="여기에 데이터를 붙여넣으세요..." 
                                rows={10}
                                value={bulkData}
                                onChange={e => setBulkData(e.target.value)}
                                className="font-mono text-sm"
                            />
                            <Button onClick={handleBulkUpload} disabled={isProcessing} className="w-full">
                                {isProcessing ? (
                                    <>처리 중...</>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        일괄 등록 실행
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 4: Settings (Grades) */}
                <TabsContent value="settings">
                    <Card>
                        <CardHeader>
                            <CardTitle>회원 등급 정의</CardTitle>
                            <CardDescription>우리 학회의 회원 등급(정회원, 준회원 등)을 정의합니다.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="flex gap-4 mb-6">
                                <div className="flex-1">
                                    <Label>등급 이름 (예: 정회원)</Label>
                                    <Input value={newGradeName} onChange={e => setNewGradeName(e.target.value)} placeholder="정회원" />
                                </div>
                                <div className="flex-1">
                                    <Label>등급 코드 (영문, 예: regular)</Label>
                                    <Input value={newGradeCode} onChange={e => setNewGradeCode(e.target.value)} placeholder="regular" />
                                </div>
                                <div className="flex items-end">
                                    <Button onClick={handleAddGrade}><Plus className="w-4 h-4 mr-2"/>추가</Button>
                                </div>
                             </div>

                             <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>등급 이름</TableHead>
                                            <TableHead>등급 코드</TableHead>
                                            <TableHead className="text-right">관리</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {grades.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-gray-500">등록된 등급이 없습니다.</TableCell>
                                            </TableRow>
                                        ) : (
                                            grades.map(g => (
                                                <TableRow key={g.id}>
                                                    <TableCell>{g.name}</TableCell>
                                                    <TableCell className="font-mono text-xs">{g.code}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteGrade(g.id)}>
                                                            <Trash2 className="w-4 h-4 text-red-500" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                             </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
